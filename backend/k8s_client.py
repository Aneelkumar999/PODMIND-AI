from kubernetes import client, config
import random
import os
from datetime import datetime, timezone

def _parse_cpu_to_millicores(cpu_str):
    if not cpu_str:
        return 0
    if cpu_str.endswith('n'):
        return int(cpu_str[:-1]) / 1000000
    if cpu_str.endswith('u'):
        return int(cpu_str[:-1]) / 1000
    if cpu_str.endswith('m'):
        return int(cpu_str[:-1])
    return float(cpu_str) * 1000

def _parse_memory_to_mib(mem_str):
    if not mem_str:
        return 0
    units = {
        'Ki': 1 / 1024,
        'Mi': 1,
        'Gi': 1024,
        'Ti': 1024 * 1024,
        'K': 1 / 1000,
        'M': 1,
        'G': 1000,
    }
    for unit, factor in units.items():
        if mem_str.endswith(unit):
            return float(mem_str[:-len(unit)]) * factor
    return float(mem_str) / (1024 * 1024)

def _namespace_matches_all(namespace):
    return namespace in ("", "*", "all", "all-namespaces")

def _risk_level(score):
    if score >= 75:
        return "critical"
    if score >= 45:
        return "warning"
    return "healthy"

def _calculate_pod_risk(pod, pvc_map=None):
    pvc_map = pvc_map or {}
    disk_total = pod.get("disk_read_kbps", 0) + pod.get("disk_write_kbps", 0)
    network_total = pod.get("network_rx_kbps", 0) + pod.get("network_tx_kbps", 0)
    pvc_latency = max(
        [pvc_map.get(pvc_name, {}).get("estimated_latency_ms", 0) for pvc_name in pod.get("pvc_mounts", [])] or [0]
    )

    score = 0
    score += min(25, (pod.get("cpu_millicores", 0) / 600) * 25)
    score += min(25, (pod.get("memory_mib", 0) / 1000) * 25)
    score += min(15, (disk_total / 1200) * 15)
    score += min(10, (network_total / 800) * 10)
    score += min(20, pod.get("restarts", 0) * 10)
    score += min(15, (pvc_latency / 80) * 15)
    if pod.get("status") != "Running":
        score += 20

    reasons = []
    if pod.get("cpu_millicores", 0) > 300:
        reasons.append("CPU spike")
    if pod.get("memory_mib", 0) > 700:
        reasons.append("memory pressure")
    if disk_total > 600:
        reasons.append("heavy disk I/O")
    if network_total > 600:
        reasons.append("network burst")
    if pod.get("restarts", 0) > 0:
        reasons.append("container restarts")
    if pvc_latency > 35:
        reasons.append("PVC latency")
    if pod.get("status") != "Running":
        reasons.append("not running")
    if not reasons:
        reasons.append("within thresholds")

    rounded_score = round(min(100, score))
    return {
        "risk_score": rounded_score,
        "risk_level": _risk_level(rounded_score),
        "risk_reasons": reasons
    }

def get_k8s_metrics(namespace="all"):
    # Check if we should simulate (either by env var or if kube config fails)
    simulate = os.getenv("SIMULATE_METRICS", "false").lower() == "true"
    
    if not simulate:
        try:
            try:
                config.load_kube_config()
            except:
                config.load_incluster_config()
        except Exception as e:
            print(f"Failed to load Kube config, falling back to simulation: {e}")
            simulate = True

    if simulate:
        return get_simulated_metrics(namespace, "healthy")

    v1 = client.CoreV1Api()
    custom_api = client.CustomObjectsApi()

    # Get Pods
    try:
        pods = v1.list_pod_for_all_namespaces() if _namespace_matches_all(namespace) else v1.list_namespaced_pod(namespace)
    except Exception as e:
        print(f"Failed to list pods, falling back to simulation: {e}")
        return get_simulated_metrics(namespace, "healthy")

    pod_list = []

    # Get Metrics (requires metrics-server)
    try:
        if _namespace_matches_all(namespace):
            pod_metrics = custom_api.list_cluster_custom_object(
                group="metrics.k8s.io",
                version="v1beta1",
                plural="pods"
            )
        else:
            pod_metrics = custom_api.list_namespaced_custom_object(
                group="metrics.k8s.io",
                version="v1beta1",
                namespace=namespace,
                plural="pods"
            )
        metrics_map = {
            (m['metadata'].get('namespace'), m['metadata']['name']): m['containers']
            for m in pod_metrics.get('items', [])
        }
    except Exception as e:
        print(f"Metrics API error: {e}")
        metrics_map = {}

    for pod in pods.items:
        pod_name = pod.metadata.name
        pod_namespace = pod.metadata.namespace
        status = pod.status.phase
        
        # Calculate resources
        cpu_usage = 0
        mem_usage = 0
        
        if (pod_namespace, pod_name) in metrics_map:
            for container in metrics_map[(pod_namespace, pod_name)]:
                cpu_usage += _parse_cpu_to_millicores(container['usage'].get('cpu'))
                mem_usage += _parse_memory_to_mib(container['usage'].get('memory'))

        labels = pod.metadata.labels or {}
        pvc_mounts = []
        for volume in pod.spec.volumes or []:
            if volume.persistent_volume_claim:
                pvc_mounts.append(volume.persistent_volume_claim.claim_name)

        pod_list.append({
            "name": pod_name,
            "namespace": pod_namespace,
            "status": status,
            "cpu_millicores": round(cpu_usage, 2),
            "memory_mib": round(mem_usage, 2),
            "network_rx_kbps": 0,
            "network_tx_kbps": 0,
            "disk_read_kbps": 0,
            "disk_write_kbps": 0,
            "pvc_mounts": pvc_mounts,
            "labels": labels,
            "restarts": sum(c.restart_count for c in pod.status.container_statuses) if pod.status.container_statuses else 0,
            "creation_timestamp": pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None
        })

    pvcs = v1.list_persistent_volume_claim_for_all_namespaces() if _namespace_matches_all(namespace) else v1.list_namespaced_persistent_volume_claim(namespace)
    pvc_list = []
    for pvc in pvcs.items:
        pvc_list.append({
            "name": pvc.metadata.name,
            "namespace": pvc.metadata.namespace,
            "status": pvc.status.phase,
            "capacity": pvc.status.capacity.get('storage') if pvc.status.capacity else "unknown",
            "estimated_iops": 0,
            "estimated_latency_ms": 0
        })

    pvc_map = {pvc["name"]: pvc for pvc in pvc_list}
    for pod in pod_list:
        pod.update(_calculate_pod_risk(pod, pvc_map))

    return {
        "pods": pod_list,
        "pvcs": pvc_list,
        "namespace": namespace,
        "is_simulated": False,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "events": []
    }

def get_simulated_metrics(namespace="all", scenario="healthy"):
    # Generate realistic sample data for the dashboard demo
    pod_names = ["frontend-svc", "backend-api", "auth-provider", "postgres-db", "redis-cache", "worker-node"]
    pods = []
    event_log = []
    
    pvc_latency = random.uniform(2, 8)
    pvc_iops = random.uniform(120, 280)
    if scenario == "db_stress":
        pvc_latency = random.uniform(45, 90)
        pvc_iops = random.uniform(1200, 1800)

    pvc_list = [{
        "name": "db-storage-pvc",
        "namespace": "data",
        "status": "Bound",
        "capacity": "10Gi",
        "estimated_iops": round(pvc_iops),
        "estimated_latency_ms": round(pvc_latency, 2)
    }]

    for name in pod_names:
        pod_namespace = "production" if name in ("frontend-svc", "backend-api", "auth-provider") else "data"
        
        # Apply namespace filter if not "all"
        if not _namespace_matches_all(namespace) and pod_namespace != namespace:
            continue

        cpu = random.uniform(10, 80)
        mem = random.uniform(50, 150)
        rx = random.uniform(40, 180)
        tx = random.uniform(30, 140)
        read = random.uniform(2, 30)
        write = random.uniform(2, 25)
        restarts = 0
        pvc_mounts = ["db-storage-pvc"] if name == "postgres-db" else []
        
        # Apply Scenario Overrides
        if scenario == "db_stress" and name == "postgres-db":
            cpu = random.uniform(400, 600)
            mem = random.uniform(700, 950)
            read = random.uniform(450, 780)
            write = random.uniform(700, 1100)
            rx = random.uniform(280, 420)
            tx = random.uniform(180, 260)
            restarts = random.randint(1, 3)
            event_log.append({"severity": "critical", "pod": name, "message": "PVC write latency and database restarts rose together"})
        elif scenario in ("leak", "memory_leak") and name == "backend-api":
            mem = 800 + random.uniform(50, 200)
            cpu = random.uniform(150, 250)
            rx = random.uniform(350, 520)
            tx = random.uniform(420, 650)
            event_log.append({"severity": "warning", "pod": name, "message": "Memory slope exceeds baseline and outbound traffic is elevated"})
        elif scenario == "healthy":
            # Baseline spikes
            if random.random() > 0.9:
                cpu *= 2

        if name == "worker-node" and scenario == "db_stress":
            cpu = random.uniform(180, 260)
            read = random.uniform(220, 360)
            write = random.uniform(260, 430)
            event_log.append({"severity": "warning", "pod": name, "message": "Worker I/O appears correlated with postgres PVC pressure"})
        
        pods.append({
            "name": f"{name}-sim",
            "namespace": "production" if name in ("frontend-svc", "backend-api", "auth-provider") else "data",
            "status": "Running",
            "cpu_millicores": round(cpu, 2),
            "memory_mib": round(mem, 2),
            "network_rx_kbps": round(rx, 2),
            "network_tx_kbps": round(tx, 2),
            "disk_read_kbps": round(read, 2),
            "disk_write_kbps": round(write, 2),
            "pvc_mounts": pvc_mounts,
            "labels": {"app": name, "tier": "backend" if "db" in name or "api" in name else "frontend"},
            "restarts": restarts,
            "creation_timestamp": "2026-05-12T00:00:00Z"
        })

    pvc_map = {pvc["name"]: pvc for pvc in pvc_list}
    for pod in pods:
        pod.update(_calculate_pod_risk(pod, pvc_map))
    
    return {
        "pods": pods,
        "pvcs": pvc_list,
        "namespace": namespace,
        "is_simulated": True,
        "scenario": scenario,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "events": event_log
    }
