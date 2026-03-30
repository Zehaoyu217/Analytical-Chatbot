from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class ServerConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]


class AgentConfig(BaseModel):
    mode: str = "single"  # "single" (one agent + skills) or "multi" (orchestrator + sub-agents)
    max_tool_results_kept: int = 10  # Keep full results for latest N tool calls, summarize older


class LLMConfig(BaseModel):
    provider: str = "openrouter"
    model: str = "openai/gpt-oss-120b:free"
    base_url: str | None = None
    api_key: str | None = None
    temperature: float = 0.1
    max_tokens: int = 4096


class DataConfig(BaseModel):
    duckdb_path: str = "./data/analytical.duckdb"
    upload_dir: str = "./data/uploads"
    max_upload_size_mb: int = 500


class SandboxConfig(BaseModel):
    enabled: bool = True
    timeout_seconds: int = 30
    max_memory_mb: int = 2048
    allowed_packages: list[str] = Field(default_factory=lambda: [
        "pandas", "numpy", "matplotlib", "seaborn", "plotly",
        "scipy", "scikit-learn", "statsmodels", "duckdb",
    ])


class SkillsConfig(BaseModel):
    directory: str = "./app/skills"
    auto_reload: bool = True


class AppConfig(BaseModel):
    server: ServerConfig = ServerConfig()
    agent: AgentConfig = AgentConfig()
    llm: LLMConfig = LLMConfig()
    data: DataConfig = DataConfig()
    sandbox: SandboxConfig = SandboxConfig()
    skills: SkillsConfig = SkillsConfig()


def load_config(config_path: str | None = None) -> AppConfig:
    """Load configuration from YAML file, with env var overrides."""
    path = config_path or os.getenv("CONFIG_PATH", "../config/config.yaml")
    config_file = Path(path)

    if config_file.exists():
        with open(config_file) as f:
            raw: dict[str, Any] = yaml.safe_load(f) or {}
    else:
        raw = {}

    # Allow env var overrides for secrets
    if api_key := os.getenv("OPENAI_API_KEY"):
        raw.setdefault("llm", {})["api_key"] = api_key
    if api_key := os.getenv("ANTHROPIC_API_KEY"):
        raw.setdefault("llm", {})["api_key"] = api_key
    if api_key := os.getenv("OPENROUTER_API_KEY"):
        raw.setdefault("llm", {})["api_key"] = api_key

    return AppConfig(**raw)


# Singleton
_config: AppConfig | None = None


def get_config() -> AppConfig:
    global _config
    if _config is None:
        _config = load_config()
    return _config
