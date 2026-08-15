import os
import json
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from huggingface_hub import InferenceClient

app = FastAPI(title="AcadFormat AI Gateway Space")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("API_KEY", "")
HF_TOKEN = os.getenv("HF_TOKEN", "")

# Initialize Hugging Face InferenceClient
client = InferenceClient(token=HF_TOKEN if HF_TOKEN else None)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = "Qwen/Qwen2.5-7B-Instruct"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.2
    max_tokens: Optional[int] = 4096

def verify_token(authorization: Optional[str] = Header(None)):
    if API_KEY:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Unauthorized: Missing Bearer token")
        token = authorization.split(" ")[1]
        if token != API_KEY:
            raise HTTPException(status_code=403, detail="Forbidden: Invalid API key")

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "AcadFormat AI Gateway Space",
        "default_model": "Qwen/Qwen2.5-7B-Instruct"
    }

@app.post("/v1/chat/completions")
def chat_completions(req: ChatCompletionRequest, authorization: Optional[str] = Header(None)):
    verify_token(authorization)
    
    model_to_use = req.model if (req.model and "/" in req.model) else "Qwen/Qwen2.5-7B-Instruct"
    formatted_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    
    try:
        response = client.chat_completion(
            messages=formatted_messages,
            model=model_to_use,
            max_tokens=req.max_tokens or 4096,
            temperature=req.temperature or 0.2,
        )
        content = response.choices[0].message.content
        return {
            "id": f"chatcmpl-hf-{os.urandom(4).hex()}",
            "object": "chat.completion",
            "model": model_to_use,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": content
                    },
                    "finish_reason": "stop"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
