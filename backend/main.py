from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from k8s_client import get_k8s_metrics, get_simulated_metrics
from agents import run_podmind_analysis
import auth
import google.generativeai as genai
from openai import OpenAI
import json
from typing import Optional

load_dotenv()

# Gemini Config
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-flash-latest')
else:
    gemini_model = None

# OpenAI Config
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
else:
    openai_client = None

app = FastAPI(title="PodMind AI API")

# Global state for current scenario
current_scenario = "healthy"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://podmind-ai.vercel.app",
        "https://podmind-ai.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")

class AnalysisRequest(BaseModel):
    namespace: str = "all"

class ScenarioRequest(BaseModel):
    scenario: str

class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None

@app.post("/api/v1/chat")
async def chat_with_ai(req: ChatRequest):
    if not gemini_model and not openai_client:
        return {"response": "AI Chat is currently offline (No API Keys configured)."}

    cluster_context = ""
    if req.context:
        cluster_context = f"Current Cluster Context: {json.dumps(req.context)}"

    system_prompt = """
You are PodMind AI, an intelligent Kubernetes operations assistant.
You help SREs and DevOp engineers understand cluster health, troubleshoot pods, and optimize performance.
Provide a concise, expert response. If referring to pods, use the names provided in the context. Keep the tone helpful and professional.
"""

    prompt = f"{system_prompt}\n\n{cluster_context}\n\nUser Question: {req.message}"

    errors = []
    # Try OpenAI first
    if openai_client:
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"{cluster_context}\n\nUser Question: {req.message}"}
                ],
                timeout=15
            )
            return {"response": response.choices[0].message.content}
        except Exception as e:
            errors.append(f"OpenAI: {str(e)}")

    # Fallback to Gemini
    if gemini_model:
        try:
            response = gemini_model.generate_content(
                prompt,
                request_options={"timeout": float(os.getenv("LLM_TIMEOUT_SECONDS", "10"))}
            )
            return {"response": response.text}
        except Exception as e:
            errors.append(f"Gemini: {str(e)}")

    if errors:
        return {"response": f"AI unavailable. Errors: {'; '.join(errors)}"}
    return {"response": "AI Chat is currently offline (No API Keys configured)."}


@app.get("/api/v1/metrics")
async def get_metrics(namespace: str = "all"):
    try:
        # If we are in simulation mode, use the selected scenario
        if os.getenv("SIMULATE_METRICS", "false").lower() == "true":
            return get_simulated_metrics(namespace, current_scenario)
        
        metrics = get_k8s_metrics(namespace)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/scenario")
async def set_scenario(request: ScenarioRequest):
    global current_scenario
    current_scenario = request.scenario
    return {"status": "success", "scenario": current_scenario}

@app.post("/api/v1/analyze")
async def analyze_cluster(request: AnalysisRequest):
    try:
        if os.getenv("SIMULATE_METRICS", "false").lower() == "true":
            metrics = get_simulated_metrics(request.namespace, current_scenario)
        else:
            metrics = get_k8s_metrics(request.namespace)
            
        analysis = await run_podmind_analysis(metrics)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
