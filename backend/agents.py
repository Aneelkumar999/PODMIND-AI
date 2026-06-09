import time
import json
import os
from typing import List, TypedDict

import google.generativeai as genai
from openai import OpenAI
from dotenv import load_dotenv
from langgraph.graph import END, StateGraph

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ENABLE_LLM = os.getenv("ENABLE_LLM", "true").lower() == "true"

# Initialize Models
gemini_model = None
openai_client = None

if ENABLE_LLM:
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-flash-latest")
    
    if OPENAI_API_KEY:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Compatibility bridge for existing code that uses 'model'
model = gemini_model

def call_llm(prompt, timeout=10):
    if not gemini_model and not openai_client:
        return None
    
    # Priority 1: Try OpenAI
    if openai_client:
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a Kubernetes SRE expert agent."},
                    {"role": "user", "content": prompt}
                ],
                timeout=timeout
            )
            return response.choices[0].message.content
        except Exception as e:
            # If quota exceeded or other OpenAI error, we log it and move to fallback
            print(f"OpenAI Error: {str(e)}. Falling back to Gemini...")
            pass

    # Priority 2: Fallback to Gemini
    if gemini_model:
        for attempt in range(2):
            try:
                response = gemini_model.generate_content(
                    prompt,
                    request_options={"timeout": timeout},
                )
                return response.text
            except Exception as e:
                if "429" in str(e):
                    time.sleep(2)
                    continue
                return None
    return None


class AgentState(TypedDict, total=False):
    metrics: dict
    cpu_analysis: str
    memory_analysis: str
    storage_analysis: str
    log_io_analysis: str
    dependency_map: List[dict]
    root_cause: dict
    final_insights: str
    recommendations: List[str]
    anomaly_timeline: List[dict]
    incident_timeline: List[dict]
    forecasting: List[dict]
    remediation: List[dict]


def _pods(metrics):


    return metrics.get("pods", [])


def _short_name(pod):
    return pod.get("labels", {}).get("app") or pod.get("name", "unknown")


def _llm_or_fallback(prompt, fallback):
    res = call_llm(prompt, timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "8")))
    return res if res else fallback


def _rank_pods(metrics, key):
    return sorted(_pods(metrics), key=lambda pod: pod.get(key, 0), reverse=True)


def _pod_by_name(metrics):
    return {pod.get("name"): pod for pod in _pods(metrics)}


def _pvc_by_name(metrics):
    return {pvc.get("name"): pvc for pvc in metrics.get("pvcs", [])}


def _impacted_by_root(root_name, dependencies):
    reverse = {}
    for dep in dependencies:
        reverse.setdefault(dep.get("target"), set()).add(dep.get("source"))

    direct = list(reverse.get(root_name, set()))
    
    impacted_all = []
    seen = {root_name}
    queue = list(reverse.get(root_name, set()))
    
    while queue:
        current = queue.pop(0)
        if not current or current in seen:
            continue
        seen.add(current)
        impacted_all.append(current)
        queue.extend(reverse.get(current, set()))
    
    indirect = [p for p in impacted_all if p not in direct]
    
    return {
        "direct": direct,
        "indirect": indirect,
        "all": impacted_all
    }


def _root_cause_score(pod, metrics, dependencies):
    pvc_map = _pvc_by_name(metrics)
    mounted_pvc_latency = max(
        [pvc_map.get(pvc_name, {}).get("estimated_latency_ms", 0) for pvc_name in pod.get("pvc_mounts", [])] or [0]
    )
    disk_total = pod.get("disk_read_kbps", 0) + pod.get("disk_write_kbps", 0)
    network_total = pod.get("network_rx_kbps", 0) + pod.get("network_tx_kbps", 0)
    impact_data = _impacted_by_root(pod.get("name"), dependencies)
    impacted_count = len(impact_data["all"])

    score = pod.get("risk_score", 0) * 0.55
    score += min(20, pod.get("restarts", 0) * 8)
    score += 18 if pod.get("cpu_millicores", 0) > 300 else 0
    score += 18 if pod.get("memory_mib", 0) > 700 else 0
    score += 18 if disk_total > 600 else 0
    score += 10 if network_total > 600 else 0
    score += 18 if mounted_pvc_latency > 35 else 0
    score += min(15, impacted_count * 5)

    app = _short_name(pod)
    for event in metrics.get("events", []):
        if app in event.get("pod", "") or app in event.get("message", "") or pod.get("name") in event.get("pod", ""):
            score += 10 if event.get("severity") == "critical" else 5

    return min(100, round(score))


def _root_cause_evidence(pod, metrics, dependencies):
    pvc_map = _pvc_by_name(metrics)
    evidence = []
    disk_total = round(pod.get("disk_read_kbps", 0) + pod.get("disk_write_kbps", 0), 2)
    network_total = round(pod.get("network_rx_kbps", 0) + pod.get("network_tx_kbps", 0), 2)
    impact_data = _impacted_by_root(pod.get("name"), dependencies)
    impacted = impact_data["all"]

    if pod.get("risk_score", 0) >= 45:
        evidence.append(f"Risk score is elevated at {pod.get('risk_score')}/100.")
    if pod.get("cpu_millicores", 0) > 300:
        evidence.append(f"CPU is above spike threshold at {pod.get('cpu_millicores')}m.")
    if pod.get("memory_mib", 0) > 700:
        evidence.append(f"Memory pressure is high at {pod.get('memory_mib')}Mi.")
    if pod.get("restarts", 0) > 0:
        evidence.append(f"Container restarted {pod.get('restarts')} time(s).")
    if disk_total > 600:
        evidence.append(f"Disk I/O is high at {disk_total} KB/s.")
    if network_total > 600:
        evidence.append(f"Network flow is high at {network_total} KB/s.")
    for pvc_name in pod.get("pvc_mounts", []):
        pvc = pvc_map.get(pvc_name)
        if pvc and pvc.get("estimated_latency_ms", 0) > 35:
            evidence.append(f"Mounted PVC {pvc_name} latency is {pvc.get('estimated_latency_ms')}ms.")
    if impacted:
        evidence.append(f"Dependency graph shows {len(impacted)} upstream workload(s) may be impacted.")

    app = _short_name(pod)
    for event in metrics.get("events", []):
        if app in event.get("pod", "") or app in event.get("message", "") or pod.get("name") in event.get("pod", ""):
            evidence.append(event.get("message", "Related event detected."))

    if not evidence:
        evidence.append("No dominant anomaly is present; selected as the highest current risk candidate.")
    return evidence


def _build_incident_timeline(metrics, root_cause, dependencies, anomaly_timeline):
    timeline = []
    root_pod = root_cause.get("pod")
    root_app = root_cause.get("app", "cluster")
    impact_data = root_cause.get("blast_radius", {})
    impacted = impact_data.get("all", [])
    collected_at = metrics.get("collected_at", "now")

    # Start with T-minus events to simulate evolution
    timeline.append({
        "offset": "T-05m",
        "phase": "baseline",
        "severity": "healthy",
        "title": "Cluster baseline established",
        "description": "Resource consumption patterns within normal operational bounds.",
        "pod": None,
    })

    if root_cause.get("severity") != "healthy":
        # Simulate the start of the issue
        timeline.append({
            "offset": "T-02m",
            "phase": "anomaly",
            "severity": "warning",
            "title": f"Initial {root_app} drift detected",
            "description": f"Minor variance in resource signatures observed for {root_app}.",
            "pod": root_pod,
        })

    timeline.append({
        "offset": "T+00s",
        "phase": "discovery",
        "severity": "info",
        "title": "Telemetry snapshot collected",
        "description": f"Full cluster state captured including pod, PVC, and network signals.",
        "pod": None,
    })

    highest_risk = sorted(_pods(metrics), key=lambda pod: pod.get("risk_score", 0), reverse=True)[:3]
    if highest_risk:
        timeline.append({
            "offset": "T+05s",
            "phase": "detection",
            "severity": highest_risk[0].get("risk_level", "healthy"),
            "title": "Risk model evaluation",
            "description": "Evaluated all workloads. Primary concern: " + f"{_short_name(highest_risk[0])} ({highest_risk[0].get('risk_score', 0)}/100)",
            "pod": highest_risk[0].get("name"),
        })

    if root_pod:
        timeline.append({
            "offset": "T+10s",
            "phase": "correlation",
            "severity": root_cause.get("severity", "info"),
            "title": "Root cause isolated",
            "description": root_cause.get("summary", ""),
            "pod": root_pod,
        })

    if impacted:
        timeline.append({
            "offset": "T+15s",
            "phase": "impact",
            "severity": root_cause.get("severity", "warning"),
            "title": "Blast radius mapping complete",
            "description": f"Identified {len(impacted)} downstream services in the potential impact path.",
            "pod": root_pod,
        })

    # Add specific metric-based events from the evidence
    for index, item in enumerate(root_cause.get("evidence", [])[:2]):
        timeline.append({
            "offset": f"T+{20 + index * 5:02d}s",
            "phase": "evidence",
            "severity": root_cause.get("severity", "info"),
            "title": "Metric anomaly attached",
            "description": item,
            "pod": root_pod,
        })

    if root_cause.get("severity") in ("critical", "warning"):
        timeline.append({
            "offset": "T+30s",
            "phase": "response",
            "severity": root_cause.get("severity", "warning"),
            "title": "Remediation plan generated",
            "description": f"Actionable steps compiled to stabilize {root_app} and protect dependent services.",
            "pod": root_pod,
        })
    else:
        timeline.append({
            "offset": "T+25s",
            "phase": "response",
            "severity": "healthy",
            "title": "Continuous monitoring active",
            "description": "No immediate remediation required. Cluster remains within healthy thresholds.",
            "pod": root_pod,
        })

    return timeline




def cpu_agent(state: AgentState):
    metrics = state["metrics"]
    top = _rank_pods(metrics, "cpu_millicores")[:3]
    fallback = "CPU pressure is concentrated in " + ", ".join(
        f"{_short_name(pod)} ({pod.get('cpu_millicores', 0)}m)" for pod in top
    )
    prompt = f"""
Analyze Kubernetes CPU telemetry across namespaces. Identify spikes, bursty workloads,
and pods likely to cause node-level contention.

Metrics: {json.dumps(_pods(metrics))}

Return concise operator-facing findings.
"""
    return {"cpu_analysis": _llm_or_fallback(prompt, fallback)}


def memory_agent(state: AgentState):
    metrics = state["metrics"]
    top = _rank_pods(metrics, "memory_mib")[:3]
    risky = [pod for pod in top if pod.get("memory_mib", 0) >= 700]
    fallback = "Memory usage is highest in " + ", ".join(
        f"{_short_name(pod)} ({pod.get('memory_mib', 0)}Mi)" for pod in top
    )
    if risky:
        fallback += ". Leak risk is elevated for " + ", ".join(_short_name(pod) for pod in risky)
    prompt = f"""
Analyze Kubernetes memory telemetry for leaks, runaway caches, and restart risk.

Metrics: {json.dumps(_pods(metrics))}

Return concise operator-facing findings.
"""
    return {"memory_analysis": _llm_or_fallback(prompt, fallback)}


def storage_agent(state: AgentState):
    metrics = state["metrics"]
    storage_hotspots = sorted(
        _pods(metrics),
        key=lambda pod: pod.get("disk_read_kbps", 0) + pod.get("disk_write_kbps", 0),
        reverse=True,
    )[:3]
    pvc_summary = metrics.get("pvcs", [])
    fallback = "Storage pressure is highest in " + ", ".join(
        f"{_short_name(pod)} ({round(pod.get('disk_read_kbps', 0) + pod.get('disk_write_kbps', 0), 2)} KB/s)"
        for pod in storage_hotspots
    )
    if pvc_summary:
        fallback += f". PVC telemetry: {json.dumps(pvc_summary)}"
    prompt = f"""
Analyze pod disk and PVC telemetry. Link PVC latency or IOPS to pod restarts and
identify storage bottlenecks.

Pods: {json.dumps(_pods(metrics))}
PVCs: {json.dumps(pvc_summary)}

Return concise operator-facing findings.
"""
    return {"storage_analysis": _llm_or_fallback(prompt, fallback)}


def log_io_agent(state: AgentState):
    metrics = state["metrics"]
    events = metrics.get("events", [])
    network_hotspots = sorted(
        _pods(metrics),
        key=lambda pod: pod.get("network_rx_kbps", 0) + pod.get("network_tx_kbps", 0),
        reverse=True,
    )[:3]
    fallback = "Network and log/IO indicators are elevated in " + ", ".join(
        f"{_short_name(pod)} ({round(pod.get('network_rx_kbps', 0) + pod.get('network_tx_kbps', 0), 2)} KB/s)"
        for pod in network_hotspots
    )
    if events:
        fallback += ". Event stream: " + "; ".join(event.get("message", "") for event in events)
    prompt = f"""
Analyze Kubernetes network, log, and IO signals. Detect correlated bursts,
restart indicators, and noisy services.

Pods: {json.dumps(_pods(metrics))}
Events: {json.dumps(events)}

Return concise operator-facing findings.
"""
    return {"log_io_analysis": _llm_or_fallback(prompt, fallback)}


def dependency_agent(state: AgentState):
    metrics = state["metrics"]
    pods = _pods(metrics)
    dependencies = []
    by_app = {pod.get("labels", {}).get("app"): pod for pod in pods}

    inferred_pairs = [
        ("frontend-svc", "backend-api", "request-flow"),
        ("backend-api", "auth-provider", "auth-call"),
        ("backend-api", "postgres-db", "database"),
        ("backend-api", "redis-cache", "cache"),
        ("worker-node", "postgres-db", "pvc-io"),
    ]
    for source, target, dep_type in inferred_pairs:
        if source in by_app and target in by_app:
            dependencies.append({
                "source": by_app[source]["name"],
                "target": by_app[target]["name"],
                "type": dep_type,
                "confidence": 0.82,
            })

    for pod in pods:
        for mounted_pvc in pod.get("pvc_mounts", []):
            pvc = next((item for item in metrics.get("pvcs", []) if item.get("name") == mounted_pvc), None)
            if pvc:
                dependencies.append({
                    "source": pod["name"],
                    "target": mounted_pvc,
                    "type": "pvc-mount",
                    "confidence": 0.96,
                })

    prompt = f"""
Infer dependencies between Kubernetes pods from labels, naming, PVC mounts,
and correlated resource behavior.

Pods: {json.dumps(pods)}
PVCs: {json.dumps(metrics.get('pvcs', []))}

Return only JSON with this schema:
[{{"source": "pod-a", "target": "pod-b", "type": "labels|naming|correlated|pvc-mount", "confidence": 0.0}}]
"""
    if model:
        try:
            text = call_llm(
                prompt,
                timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "8")),
            )
            start = text.find("[")
            end = text.rfind("]") + 1
            parsed = json.loads(text[start:end])
            if parsed:
                dependencies = parsed
        except Exception:
            pass

    return {"dependency_map": dependencies}


def root_cause_agent(state: AgentState):
    metrics = state["metrics"]
    dependencies = state.get("dependency_map", [])
    pods = _pods(metrics)

    if not pods:
        return {
            "root_cause": {
                "pod": None,
                "app": "unknown",
                "namespace": "unknown",
                "confidence": 0,
                "severity": "healthy",
                "summary": "No pods are available for root-cause analysis.",
                "evidence": [],
                "blast_radius": {"direct": [], "indirect": [], "all": []},
                "contributing_metrics": {},
            }
        }

    ranked = sorted(
        pods,
        key=lambda pod: _root_cause_score(pod, metrics, dependencies),
        reverse=True,
    )
    candidate = ranked[0]
    score = _root_cause_score(candidate, metrics, dependencies)
    blast_radius = _impacted_by_root(candidate.get("name"), dependencies)
    severity = "critical" if score >= 75 else "warning" if score >= 45 else "healthy"
    app = _short_name(candidate)

    if severity == "healthy":
        summary = f"No dominant root cause detected. {app} is only the highest current risk candidate."
    else:
        summary = f"{app} is the most likely root cause because its resource pressure aligns with dependency impact signals."

    # Use LLM to infer business impact if available
    business_impact = "User-facing services may experience latency or intermittent failures."
    if model and severity != "healthy":
        prompt = f"""
Given the root cause pod '{candidate.get('name')}' (App: {app}) and its blast radius:
Directly impacted: {', '.join(blast_radius['direct']) or 'None'}
Indirectly impacted: {', '.join(blast_radius['indirect']) or 'None'}

Describe the potential BUSINESS impact in 1-2 concise sentences. Focus on user experience and business operations.
"""
        try:
            res = call_llm(
                prompt,
                timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "8")),
            )
            if res:
                business_impact = res.strip()
        except:
            pass

    return {
        "root_cause": {
            "pod": candidate.get("name"),
            "app": app,
            "namespace": candidate.get("namespace", "default"),
            "confidence": score,
            "severity": severity,
            "summary": summary,
            "business_impact": business_impact,
            "evidence": _root_cause_evidence(candidate, metrics, dependencies),
            "blast_radius": blast_radius,
            "contributing_metrics": {
                "cpu_millicores": candidate.get("cpu_millicores", 0),
                "memory_mib": candidate.get("memory_mib", 0),
                "disk_kbps": round(candidate.get("disk_read_kbps", 0) + candidate.get("disk_write_kbps", 0), 2),
                "network_kbps": round(candidate.get("network_rx_kbps", 0) + candidate.get("network_tx_kbps", 0), 2),
                "restarts": candidate.get("restarts", 0),
                "risk_score": candidate.get("risk_score", 0),
            },
        }
    }


def forecasting_agent(state: AgentState):
    metrics = state["metrics"]
    pods = _pods(metrics)
    predictions = []

    for pod in pods:
        app = _short_name(pod)
        risk_score = pod.get("risk_score", 0)
        cpu = pod.get("cpu_millicores", 0)
        memory = pod.get("memory_mib", 0)
        restarts = pod.get("restarts", 0)

        if risk_score > 40:
            if cpu > 250:
                predictions.append({
                    "pod": pod["name"],
                    "app": app,
                    "type": "CPU Exhaustion",
                    "probability": "High",
                    "time_horizon": "12-18 minutes",
                    "description": f"{app} CPU usage is trending toward node-level contention thresholds."
                })
            if memory > 600:
                predictions.append({
                    "pod": pod["name"],
                    "app": app,
                    "type": "OOM Risk",
                    "probability": "Critical",
                    "time_horizon": "8-15 minutes",
                    "description": f"{app} memory slope indicates a potential leak or cache runaway."
                })
            if restarts > 0:
                predictions.append({
                    "pod": pod["name"],
                    "app": app,
                    "type": "CrashLoopBackOff",
                    "probability": "Medium",
                    "time_horizon": "Next 5 minutes",
                    "description": f"Recurrent restarts in {app} suggest persistent readiness failure."
                })

    if model and not predictions:
        prompt = f"""
Analyze the current Kubernetes pod metrics and predict potential resource bottlenecks or failures in the next 30-60 minutes.
Metrics: {json.dumps(pods)}

Return only JSON list of predictions with schema:
[{{"pod": "name", "app": "app", "type": "Memory|CPU|Disk|Network", "probability": "Low|Medium|High|Critical", "time_horizon": "X minutes", "description": "..."}}]
"""
        try:
            text = call_llm(
                prompt,
                timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "8")),
            )
            start = text.find("[")
            end = text.rfind("]") + 1
            parsed = json.loads(text[start:end])
            if parsed:
                predictions.extend(parsed)
        except:
            pass

    return {"forecasting": predictions[:5]}


def remediation_agent(state: AgentState):
    root_cause = state.get("root_cause", {})
    metrics = state["metrics"]
    remediations = []

    if root_cause.get("severity") in ("critical", "warning"):
        pod_name = root_cause.get("pod")
        app = root_cause.get("app")
        
        # Rule-based remediation
        metrics_data = root_cause.get("contributing_metrics", {})
        
        if metrics_data.get("memory_mib", 0) > 700:
            remediations.append({
                "action": f"Increase memory limits for {app}",
                "reason": "High memory pressure and potential leak detected.",
                "patch": f"""
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {app}
spec:
  template:
    spec:
      containers:
      - name: {app}
        resources:
          limits:
            memory: "1Gi"
"""
            })
            
        if metrics_data.get("cpu_millicores", 0) > 300:
            remediations.append({
                "action": f"Scale {app} horizontally",
                "reason": "CPU usage is above horizontal scaling threshold.",
                "patch": f"""
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {app}-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {app}
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
"""
            })

    if model and not remediations and root_cause.get("severity") != "healthy":
        prompt = f"""
Given the root cause pod '{root_cause.get('pod')}' and its contributing metrics: {json.dumps(root_cause.get('contributing_metrics'))}
Suggest 2 Kubernetes remediation actions.

Return only JSON list with schema:
[{{"action": "Action Name", "reason": "Why...", "patch": "YAML patch content"}}]
"""
        try:
            text = call_llm(
                prompt,
                timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "8")),
            )
            start = text.find("[")
            end = text.rfind("]") + 1
            parsed = json.loads(text[start:end])
            if parsed:
                remediations.extend(parsed)
        except:
            pass

    return {"remediation": remediations[:3]}


def aggregator_agent(state: AgentState):


    metrics = state["metrics"]
    recommendations = []
    timeline = []
    root_cause = state.get("root_cause", {})

    if root_cause.get("severity") in ("critical", "warning"):
        recommendations.append(
            f"Start remediation with {root_cause.get('app')} before changing downstream services."
        )
        timeline.append({
            "severity": root_cause.get("severity"),
            "pod": root_cause.get("pod"),
            "message": f"Root-cause engine selected {root_cause.get('app')} with {root_cause.get('confidence')}% confidence",
        })


    for pod in _pods(metrics):
        app = _short_name(pod)
        if pod.get("risk_score", 0) >= 75:
            recommendations.append(f"Treat {app} as a critical-risk workload before scaling dependent services.")
            timeline.append({"severity": "critical", "pod": pod["name"], "message": f"{app} risk score reached {pod.get('risk_score')}/100"})
        elif pod.get("risk_score", 0) >= 45:
            recommendations.append(f"Watch {app}; its risk score is elevated at {pod.get('risk_score')}/100.")
        if pod.get("cpu_millicores", 0) > 300:
            recommendations.append(f"Add CPU limits or horizontal scaling for {app}.")
            timeline.append({"severity": "critical", "pod": pod["name"], "message": f"{app} crossed CPU spike threshold"})
        if pod.get("memory_mib", 0) > 700:
            recommendations.append(f"Inspect heap/cache growth in {app}; memory leak risk is high.")
            timeline.append({"severity": "warning", "pod": pod["name"], "message": f"{app} memory is above leak-risk threshold"})
        if pod.get("restarts", 0) > 0:
            recommendations.append(f"Correlate {app} restarts with PVC and dependency pressure before redeploying.")
            timeline.append({"severity": "critical", "pod": pod["name"], "message": f"{app} restarted {pod.get('restarts')} time(s)"})
        if pod.get("disk_write_kbps", 0) > 500:
            recommendations.append(f"Move {app} to a faster storage class or reduce synchronous writes.")
            timeline.append({"severity": "warning", "pod": pod["name"], "message": f"{app} has heavy write throughput"})

    for event in metrics.get("events", []):
        timeline.append(event)

    if not recommendations:
        recommendations.append("Cluster is within demo thresholds; continue watching memory slope, PVC latency, and network bursts.")

    incident_timeline = _build_incident_timeline(
        metrics,
        root_cause,
        state.get("dependency_map", []),
        timeline,
    )

    prompt = f"""
Summarize the cluster state from specialized agent findings:
CPU: {state.get('cpu_analysis')}
Memory: {state.get('memory_analysis')}
Storage: {state.get('storage_analysis')}
Log/IO: {state.get('log_io_analysis')}
Dependencies: {json.dumps(state.get('dependency_map', []))}
Root Cause: {json.dumps(root_cause)}

Provide actionable optimization, alerting, and short-horizon forecasting guidance.
"""
    fallback = "\n".join([
        state.get("cpu_analysis", ""),
        state.get("memory_analysis", ""),
        state.get("storage_analysis", ""),
        state.get("log_io_analysis", ""),
        "Root cause: " + root_cause.get("summary", ""),
        "Recommended actions: " + " ".join(recommendations),
    ])
    return {
        "final_insights": _llm_or_fallback(prompt, fallback),
        "recommendations": recommendations,
        "anomaly_timeline": timeline,
        "incident_timeline": incident_timeline,
    }


def create_podmind_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("cpu_expert", cpu_agent)
    workflow.add_node("memory_expert", memory_agent)
    workflow.add_node("storage_expert", storage_agent)
    workflow.add_node("log_io_expert", log_io_agent)
    workflow.add_node("dependency_expert", dependency_agent)
    workflow.add_node("root_cause_expert", root_cause_agent)
    workflow.add_node("forecaster", forecasting_agent)
    workflow.add_node("remediator", remediation_agent)
    workflow.add_node("orchestrator", aggregator_agent)

    workflow.set_entry_point("cpu_expert")
    workflow.add_edge("cpu_expert", "memory_expert")
    workflow.add_edge("memory_expert", "storage_expert")
    workflow.add_edge("storage_expert", "log_io_expert")
    workflow.add_edge("log_io_expert", "dependency_expert")
    workflow.add_edge("dependency_expert", "root_cause_expert")
    workflow.add_edge("root_cause_expert", "forecaster")
    workflow.add_edge("forecaster", "remediator")
    workflow.add_edge("remediator", "orchestrator")
    workflow.add_edge("orchestrator", END)

    return workflow.compile()


def _run_agent_sequence(metrics: dict):
    state = {"metrics": metrics}
    for node in (cpu_agent, memory_agent, storage_agent, log_io_agent, dependency_agent, root_cause_agent, forecasting_agent, remediation_agent, aggregator_agent):
        state.update(node(state))
    return state


async def run_podmind_analysis(metrics: dict):
    result = _run_agent_sequence(metrics)
    resource_analysis = "\n\n".join([
        f"CPU Agent: {result.get('cpu_analysis', '')}",
        f"Memory Agent: {result.get('memory_analysis', '')}",
        f"Storage/PVC Agent: {result.get('storage_analysis', '')}",
        f"Log/IO Agent: {result.get('log_io_analysis', '')}",
    ])
    return {
        "resource_analysis": resource_analysis,
        "agent_findings": {
            "cpu": result.get("cpu_analysis", ""),
            "memory": result.get("memory_analysis", ""),
            "storage": result.get("storage_analysis", ""),
            "log_io": result.get("log_io_analysis", ""),
        },
        "root_cause": result.get("root_cause", {}),
        "dependency_map": result.get("dependency_map", []),
        "insights": result.get("final_insights", ""),
        "recommendations": result.get("recommendations", []),
        "anomaly_timeline": result.get("anomaly_timeline", []),
        "incident_timeline": result.get("incident_timeline", []),
        "forecasting": result.get("forecasting", []),
        "remediation": result.get("remediation", []),
    }


