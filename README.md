# PodMind AI

  PodMind AI is an AI-driven Kubernetes resource discovery and dependency intelligence dashboard. It goes beyond traditional monitoring by collecting pod-level telemetry, analyzing resource behavior with
  multiple AI agents, identifying root causes, mapping dependencies, and generating actionable recommendations for operators.

  This project was built for the theme:

  **Beyond monitoring: AI agents for real-time pod resource discovery and dependency mapping**
  
# BACKEND URL:https://podmind-ai.onrender.com
  ---

  ## Problem Statement

  Modern Kubernetes, K3s, MicroK8s, Minikube, and other container orchestration environments can run many pods across multiple namespaces. Operators can access raw metrics, but it is difficult to answer
  questions such as:

  - Which pod is causing CPU or memory spikes?
  - Are PVC I/O patterns linked to pod restarts?
  - Which services are influencing each other?
  - What is the likely root cause of an incident?
  - Which workloads need optimization first?

  PodMind AI solves this by combining real-time pod telemetry, dependency inference, AI analysis, root-cause detection, and a rich dashboard.

  ---

  ## Key Features

  - Real-time pod resource discovery
  - CPU, memory, disk I/O, network, PVC, restart, and namespace telemetry
  - Multi-agent AI analysis framework
  - Pod risk scoring
  - Root cause analysis engine
  - Incident timeline generation
  - Dependency graph visualization
  - PVC-aware topology mapping
  - Simulation scenarios for reliable demos
  - AI-generated recommendations
  - FastAPI backend
  - React dashboard frontend

  ---

  ## System Architecture

  ```text
  Kubernetes / Simulation Metrics
          |
          v
  FastAPI Backend Collector
          |
          v
  Risk Scoring + Multi-Agent Analysis
          |
          v
  Root Cause + Dependency + Timeline Engine
          |
          v
  React Dashboard

  ———

  ## Tech Stack

  ### Backend

  - Python
  - FastAPI
  - Kubernetes Python Client
  - LangGraph
  - Google Gemini API support
  - Uvicorn

  ### Frontend

  - React
  - Vite
  - TypeScript
  - Tailwind CSS
  - Recharts
  - React Flow
  - Framer Motion
  - Lucide Icons
  - Axios

  ———

  ## Project Structure

  podmind-ai/
  ├── backend/
  │   ├── main.py
  │   ├── k8s_client.py
  │   ├── agents.py
  │   └── .env
  │
  ├── frontend/
  │   ├── src/
  │   │   ├── App.tsx
  │   │   ├── components/
  │   │   │   ├── MetricsDashboard.tsx
  │   │   │   ├── DependencyGraph.tsx
  │   │   │   └── AIInsights.tsx
  │   │   └── main.tsx
  │   ├── package.json
  │   └── vite.config.ts
  │
  ├── simulation/
  │   └── scenarios.json
  │
  └── docs/
      └── implementation_plan.md

  ———

  ## Main Modules

  ### 1. Backend API

  The backend is built with FastAPI and exposes APIs for metrics, scenario control, health checks, and AI analysis.

  Main file:

  backend/main.py

  Important endpoints:

  GET  /api/v1/health
  GET  /api/v1/metrics
  POST /api/v1/scenario
  POST /api/v1/analyze

  ———

  ### 2. Kubernetes Metrics Collector

  The Kubernetes collector gathers pod and PVC data from a real cluster when available.

  Main file:

  backend/k8s_client.py

  Collected signals include:

  - Pod name
  - Namespace
  - Status
  - CPU usage
  - Memory usage
  - Disk read/write
  - Network RX/TX
  - PVC mounts
  - PVC latency
  - PVC IOPS
  - Restart count
  - Risk score
  - Risk reasons

  If Kubernetes is not available, the system can run in simulation mode.

  ———

  ### 3. Multi-Agent AI Engine

  The analysis engine uses multiple specialized agents.

  Main file:

  backend/agents.py

  Agents include:

  - CPU Agent
  - Memory Agent
  - Storage/PVC Agent
  - Log/IO Agent
  - Dependency Agent
  - Root Cause Agent
  - Orchestrator Agent

  Each agent focuses on one part of the operational picture. The orchestrator combines all findings into recommendations.

  ———

  ## Dashboard Views

  ### 1. Telemetry Dashboard

  The telemetry dashboard shows live resource metrics.

  It includes:

  - Total CPU usage
  - Total memory usage
  - Disk I/O
  - Network traffic
  - Top risk pod
  - CPU distribution chart
  - Memory chart
  - Disk and PVC activity chart
  - Network flow chart
  - Pod-level table

  The pod table shows:

  - Pod identity
  - Namespace
  - Status
  - CPU
  - Memory
  - I/O
  - Risk score
  - Risk level
  - Risk reasons

  ———

  ### 2. Dependency Graph

  The dependency graph visualizes service relationships.

  It shows:

  - Pods as nodes
  - PVCs as storage nodes
  - Pod-to-pod dependencies
  - Pod-to-PVC dependencies
  - Root-cause pod highlighting
  - Risk-based node colors

  Example inferred relationships:

  frontend-svc -> backend-api
  backend-api -> postgres-db
  backend-api -> redis-cache
  worker-node -> postgres-db
  postgres-db -> db-storage-pvc

  ———

  ### 3. AI Analytics

  The AI Analytics screen shows the intelligence layer.

  It includes:

  - Root cause analysis
  - RCA confidence score
  - Evidence behind the root cause
  - Impacted pods
  - Contributing metrics
  - AI agent findings
  - Strategic recommendations
  - Incident timeline
  - Anomaly timeline

  ———

  ## Implemented Intelligence Features

  ### Pod Risk Score

  Each pod receives a risk score from 0 to 100.

  The score is calculated using:

  - CPU pressure
  - Memory pressure
  - Disk I/O
  - Network I/O
  - Restart count
  - PVC latency
  - Pod status

  Risk levels:

  0-44   Healthy
  45-74  Warning
  75-100 Critical

  ———

  ### Root Cause Analysis

  The root cause engine identifies the most likely faulty pod.

  It uses:

  - Pod risk score
  - CPU and memory spikes
  - Disk and network pressure
  - PVC latency
  - Restart count
  - Related events
  - Dependency impact

  Example output:

  Root Cause: postgres-db
  Confidence: 100%
  Reason: High PVC latency, disk write pressure, memory pressure, CPU spike, and pod restarts.
  Impacted Pods: backend-api, worker-node, frontend-svc

  ———

  ### Incident Timeline

  The incident timeline explains the incident flow from detection to response.

  Timeline phases include:

  - Discovery
  - Detection
  - Correlation
  - Storage check
  - Impact analysis
  - Evidence attachment
  - Recommended response

  Example:

  T+00s Telemetry snapshot collected
  T+05s Risk model ranked pod candidates
  T+10s postgres-db selected as root cause
  T+15s PVC dependency checked
  T+20s Blast radius estimated
  T+25s Anomaly evidence attached
  T+50s Recommended response generated

  ———

  ## Simulation Scenarios

  The project supports simulation mode for reliable hackathon demos.

  Available scenarios:

  ### 1. Baseline State

  Normal cluster behavior.

  ### 2. Database Stress

  Simulates:

  - High PostgreSQL CPU
  - High PostgreSQL memory
  - High disk writes
  - PVC latency
  - Database restarts
  - Worker I/O correlation

  ### 3. Memory Leak

  Simulates:

  - Backend API memory growth
  - Increased network traffic
  - Memory leak risk

  ———

  ## Running The Project

  ### Backend

  Go to the backend directory:

  cd backend

  Start the backend in simulation mode:

  SIMULATE_METRICS=true ENABLE_LLM=false ./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8001

  Backend runs at:

  http://127.0.0.1:8001

  Health check:

  http://127.0.0.1:8001/api/v1/health

  ———

  ### Frontend

  Go to the frontend directory:

  cd frontend

  Install dependencies if needed:

  npm install

  Start the frontend:

  npm run dev -- --host 127.0.0.1

  Frontend runs at:

  http://127.0.0.1:5173

  ———

  ## API Examples

  ### Health Check

  curl http://127.0.0.1:8001/api/v1/health

  ### Get Metrics

  curl http://127.0.0.1:8001/api/v1/metrics

  ### Change Scenario

  curl -X POST http://127.0.0.1:8001/api/v1/scenario \
    -H "Content-Type: application/json" \
    -d '{"scenario":"db_stress"}'

  ### Run AI Analysis

  curl -X POST http://127.0.0.1:8001/api/v1/analyze \
    -H "Content-Type: application/json" \
    -d '{"namespace":"all"}'

  ———

  ## Demo Flow

  For a hackathon presentation:

  1. Open the dashboard.
  2. Show the baseline telemetry.
  3. Switch to Database Stress.
  4. Show CPU, memory, disk, PVC, and risk score changes.
  5. Click Analyze Cluster.
  6. Show the root cause card.
  7. Show the incident timeline.
  8. Open the dependency graph.
  9. Show the highlighted root-cause pod.
  10. Explain the recommendations.

  Suggested demo message:

  PodMind AI does not only monitor Kubernetes metrics. It explains what is happening, identifies the likely root cause, maps affected services, and recommends what operators should do next.

  ———

  ## Why This Project Matters

  Traditional monitoring tools show raw metrics. PodMind AI converts raw telemetry into operational intelligence.

  It helps operators:

  - Detect anomalies faster
  - Understand service dependencies
  - Identify root causes
  - Reduce debugging time
  - Prevent downtime
  - Make better optimization decisions

  ———

  ## Future Enhancements

  - Prometheus integration
  - WebSocket-based real-time streaming
  - AI ChatOps assistant
  - Exportable incident report
  - Kubernetes YAML remediation suggestions
  - Namespace and workload explorer
  - Historical trend storage
  - Alert delivery through Slack, email, or Teams
  - Real eBPF-based network dependency tracing
  - Production deployment on K3s or MicroK8s

  ———

  ## Hackathon Positioning

  PodMind AI fits the theme:

  Beyond monitoring: AI agents for real-time pod resource discovery and dependency mapping

  The project demonstrates:

  - Real-time pod discovery
  - Multi-agent AI analysis
  - Dependency mapping
  - Root-cause detection
  - PVC and I/O correlation
  - Incident timeline generation
  - Operator-focused recommendations
  - A working dashboard prototype

  ———

  ## Team

  Team Seekers

  ———

  ## License

  This project is built for hackathon and educational use.
