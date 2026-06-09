# Implementation Plan: PodMind AI - Real-Time Pod Resource Discovery

## Background & Motivation
The objective of this hackathon project (ABB Accelerator - Theme 2) is to build an AI-driven automation solution for single-node container orchestration environments (like Minikube). The system must collect, analyze, and correlate real-time resource consumption (CPU, RAM, Disk, PVC, Network) to map interdependencies, detect anomalies, and generate actionable insights beyond simple monitoring.

## Scope & Impact
We will build a fully functional prototype consisting of:
1.  **Live Environment:** A Minikube single-node cluster serving as the target environment.
2.  **Data Collector:** A backend service that pulls live metrics directly from the Kubernetes API and Metrics Server.
3.  **Multi-Agent AI:** A LangGraph-based workflow utilizing Google Gemini to analyze different domains (compute, storage, dependencies).
4.  **Dashboard:** A real-time web interface displaying metrics, dependency graphs, and AI-generated NLP insights.

## Proposed Solution
-   **Infrastructure:** Minikube with `metrics-server` enabled. We will deploy sample bursty workloads to generate interesting data.
-   **Backend:** Python with FastAPI.
    -   *Data Ingestion:* Uses the `kubernetes` Python client to fetch live Pod, Node, and PVC metrics.
    -   *AI Engine:* `langgraph` framework utilizing `google-generativeai`.
        -   **Resource Agent:** Analyzes CPU/Memory spikes.
        -   **Storage Agent:** Analyzes PVC/IO activity.
        -   **Dependency Agent:** Infers relationships based on labels, owner references, and correlated resource spikes.
        -   **Orchestrator/Summarizer Agent:** Aggregates findings into human-readable alerts and optimization recommendations.
-   **Frontend:** React (via Vite) with Recharts for telemetry visualization and a custom DAG viewer (like React Flow) for dependency mapping.

## Alternatives Considered
-   **AI Framework:** Pure Python routing vs. LangGraph. We chose LangGraph for robust state management and better orchestration of multiple specialized agents.
-   **Metrics Source:** Simulated vs. Live Kubernetes Metrics. We chose Live Metrics to ensure a highly realistic and impactful prototype demo.

## Implementation Plan

### Phase 1: Local Cluster & Infrastructure Setup
-   Initialize Minikube and enable `metrics-server`.
-   Deploy sample microservices (e.g., an app that causes CPU spikes, and another that performs heavy PVC I/O) to generate test data.
-   Verify `kubectl top pods` works.

### Phase 2: Data Ingestion Backend
-   Set up a new Python FastAPI project (`backend`).
-   Integrate the `kubernetes` Python client.
-   Create API endpoints to stream real-time metrics (CPU, Memory, pod states, PVC bindings) from the cluster.

### Phase 3: Multi-Agent AI System (LangGraph)
-   Integrate LangGraph and the Gemini API.
-   Define state schema for the agent graph.
-   Implement the specialized agents (Resource, Storage, Dependency).
-   Build the graph workflow: Ingest metrics -> Route to specialized agents -> Aggregate insights -> Return to backend.

### Phase 4: Frontend Dashboard
-   Set up a React Vite project (`frontend`).
-   Create a real-time dashboard layout.
-   Implement charts (Recharts) for CPU/Memory/Storage.
-   Implement a dependency topology view.
-   Create a dedicated pane for live "AI Insights & Recommendations".

## Verification & Testing
-   **Stress Test:** Execute load generation scripts on specific pods.
-   **Metric Correlation:** Verify that the AI system successfully identifies when a PVC-heavy pod correlates with CPU degradation on the node.
-   **Dashboard Latency:** Ensure frontend updates seamlessly via polling or WebSockets.
