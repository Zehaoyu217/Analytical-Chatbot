# Setup

## Prerequisites
- Python 3.13 (via `uv`)
- Node.js v22+
- Ollama v0.18+ (for local LLM)

## Quick Start

```bash
# Terminal 1: Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Ollama (if using local LLM)
ollama serve
```

Open http://localhost:5173. Upload a CSV, ask a question.

## First Time Setup

```bash
# Backend
cd backend
uv venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r sandbox-requirements.txt

# Frontend
cd frontend
npm install
```

## Models

```bash
ollama pull qwen3:8b     # Fast, good for development
ollama pull qwen3:32b    # Slower, better quality
```

For cloud LLMs:
```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
```

## Config

Edit `config/config.yaml`:
- `llm.provider` / `llm.model` -- Which LLM to use
- `data.duckdb_path` -- Where DuckDB stores data
- `sandbox.timeout_seconds` -- Max code execution time
- `sandbox.allowed_packages` -- Packages available in sandbox

## Verify

```bash
curl http://localhost:8000/api/health        # Backend health
curl http://localhost:8000/api/datasets       # List datasets
curl http://localhost:8000/api/models         # Available models
```
