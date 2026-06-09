# PodMind AI Demo

PodMind AI is a hackathon prototype for Kubernetes pod resource discovery and AI-assisted anomaly analysis.

## Demo Flow

1. Start the backend in simulation mode:

```bash
cd backend
python -m venv venv
./venv/bin/pip install -r requirements.txt
SIMULATE_METRICS=true ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

2. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

3. Present this path:

- Open the telemetry dashboard and show live polling.
- Switch from `Baseline State` to `Database Stress`.
- Run `Analyze Cluster`.
- Show the AI findings, recommendations, anomaly timeline, and topology view.

## Environment

- `SIMULATE_METRICS=true` gives a reliable offline demo.
- `GEMINI_API_KEY` enables Gemini-backed language output.
- `ENABLE_LLM=false` disables external model calls for a fully offline presentation.
- Without Gemini access, deterministic fallback insights still work.
- `VITE_API_BASE` can override the frontend API URL. Default: `http://localhost:8000/api/v1`.

## Production Build

```bash
npm run build
```
