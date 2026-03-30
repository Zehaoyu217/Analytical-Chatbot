from __future__ import annotations

from functools import lru_cache
from typing import Any

from langchain_core.language_models import BaseChatModel

from app.config import get_config, LLMConfig


def create_chat_model(
    provider: str | None = None,
    model: str | None = None,
    **kwargs: Any,
) -> BaseChatModel:
    """Create a LangChain chat model for the given provider."""
    cfg = get_config().llm
    provider = provider or cfg.provider
    model = model or cfg.model

    # Pop Ollama-specific params before building common dict
    num_predict = kwargs.pop("num_predict", cfg.max_tokens or 8192)

    common = {
        "temperature": kwargs.pop("temperature", cfg.temperature),
        "max_tokens": kwargs.pop("max_tokens", cfg.max_tokens),
        **kwargs,
    }

    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=model,
            base_url=cfg.base_url or "http://localhost:11434",
            num_predict=num_predict,
            num_ctx=32768,
            **common,
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=cfg.api_key,
            base_url=cfg.base_url,
            **common,
        )
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model,
            api_key=cfg.api_key,
            **common,
        )
    elif provider == "openrouter":
        import os
        from langchain_openai import ChatOpenAI
        api_key = cfg.api_key or os.getenv("OPENROUTER_API_KEY")
        return ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "Analytical Chatbot",
            },
            **common,
        )
    elif provider == "google":
        import os
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = cfg.api_key or os.getenv("GOOGLE_API_KEY")
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            **common,
        )
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


def get_chat_model(**kwargs: Any) -> BaseChatModel:
    """Get the default chat model from config."""
    return create_chat_model(**kwargs)
