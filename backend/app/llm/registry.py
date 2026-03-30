from __future__ import annotations

import httpx
from typing import Any

from app.config import get_config


class ModelRegistry:
    """Registry of available LLM models — queries Ollama for real installed models.

    Only tool-capable models are listed. Models without native tool calling
    (e.g., deepseek-r1) are filtered out since the agent requires tool support.
    """

    # Models without native tool calling — excluded from the dropdown
    EXCLUDED_MODELS = {"deepseek-r1", "deepseek-coder", "deepseek-v2"}

    # Cloud models (only shown if API keys are configured)
    CLOUD_MODELS: list[dict[str, Any]] = [
        {"provider": "anthropic", "model": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "local": False},
        {"provider": "openai", "model": "gpt-4o", "name": "GPT-4o", "local": False},
        {"provider": "openai", "model": "gpt-4o-mini", "name": "GPT-4o Mini", "local": False},
    ]

    # OpenRouter free models
    OPENROUTER_MODELS: list[dict[str, Any]] = [
        {"provider": "openrouter", "model": "openai/gpt-oss-120b:free", "name": "GPT-OSS 120B (free)", "local": False},
        {"provider": "openrouter", "model": "nvidia/nemotron-3-super-120b-a12b:free", "name": "Nemotron 3 Super 120B (free)", "local": False},
    ]

    def list_models(self) -> list[dict[str, Any]]:
        import os
        models: list[dict[str, Any]] = []

        # Query Ollama for installed local models
        models.extend(self._get_ollama_models())

        # Add Google Gemini if API key is set
        if os.getenv("GOOGLE_API_KEY"):
            models.append({
                "provider": "google",
                "model": "gemini-2.0-flash",
                "name": "Gemini 2.0 Flash (free)",
                "local": False,
            })

        # Add other cloud models if their API keys are set
        if os.getenv("ANTHROPIC_API_KEY"):
            models.append({"provider": "anthropic", "model": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "local": False})
        if os.getenv("OPENAI_API_KEY"):
            models.append({"provider": "openai", "model": "gpt-4o", "name": "GPT-4o", "local": False})
            models.append({"provider": "openai", "model": "gpt-4o-mini", "name": "GPT-4o Mini", "local": False})

        # OpenRouter free models
        if os.getenv("OPENROUTER_API_KEY"):
            models.extend(self.OPENROUTER_MODELS)

        return models

    def _get_ollama_models(self) -> list[dict[str, Any]]:
        """Fetch actually installed models from Ollama."""
        cfg = get_config()
        base_url = cfg.llm.base_url or "http://localhost:11434"

        try:
            resp = httpx.get(f"{base_url}/api/tags", timeout=3.0)
            resp.raise_for_status()
            data = resp.json()

            models = []
            for m in data.get("models", []):
                name = m.get("name", "")
                # Skip models without native tool calling support
                base_name = name.split(":")[0].lower()
                if any(excluded in base_name for excluded in self.EXCLUDED_MODELS):
                    continue
                size_gb = m.get("size", 0) / (1024 ** 3)
                models.append({
                    "provider": "ollama",
                    "model": name,
                    "name": f"{name} ({size_gb:.1f}GB)",
                    "local": True,
                })
            return models

        except Exception:
            # Ollama not running or unreachable
            return [{"provider": "ollama", "model": "unavailable", "name": "Ollama not running", "local": True}]


_registry: ModelRegistry | None = None


def get_model_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry
