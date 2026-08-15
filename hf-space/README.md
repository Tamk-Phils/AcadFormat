---
title: AcadFormat AI Gateway
emoji: 🎓
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# AcadFormat AI Gateway Space

Free, zero-expiration OpenAI-compatible API gateway for AcadFormat document parsing and analysis.

## Setup Instructions

1. **Deploy to Hugging Face Spaces**:
   - Go to [Hugging Face Spaces](https://huggingface.co/new-space).
   - Name your Space (e.g. `acadformat-ai-gateway`).
   - Select **Docker** SDK (Blank container).
   - Upload all files from `hf-space/` into your Space repository (`app.py`, `Dockerfile`, `requirements.txt`, `README.md`).

2. **Configure Space Variables (Optional)**:
   - In Space Settings -> Variables and Secrets:
     - `API_KEY`: Secret string to secure your endpoint (optional).
     - `HF_TOKEN`: Your Hugging Face User Access Token (optional, increases rate limits).

3. **Connect to AcadFormat**:
   In your AcadFormat `.env` file (or Vercel / hosting provider environment variables):
   ```env
   CUSTOM_API_URL="https://YOUR-USERNAME-YOUR-SPACE-NAME.hf.space/v1/chat/completions"
   CUSTOM_API_KEY="your-api-key-if-set"
   CUSTOM_MODEL="Qwen/Qwen2.5-7B-Instruct"
   AI_PROVIDER="custom"
   ```
