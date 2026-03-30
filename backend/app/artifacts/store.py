from __future__ import annotations

import time
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


class Artifact(BaseModel):
    """An artifact produced by the agent — table, chart, diagram, or dashboard component."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    type: Literal["table", "chart", "diagram", "dashboard_component"] = "table"
    title: str = ""
    content: str = ""  # HTML for tables, Vega-Lite JSON for charts, Mermaid string for diagrams
    format: str = "html"  # html, vega-lite, mermaid
    created_at: float = Field(default_factory=time.time)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProgressStep(BaseModel):
    """A step in the agent's execution progress."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    label: str
    status: Literal["pending", "running", "done", "error"] = "pending"
    detail: str = ""  # e.g., first 20+ chars of code being executed
    started_at: float | None = None
    finished_at: float | None = None


class ArtifactStore:
    """In-memory artifact store per session."""

    def __init__(self):
        self._artifacts: dict[str, list[Artifact]] = {}  # session_id -> artifacts
        self._progress: dict[str, list[ProgressStep]] = {}  # session_id -> steps
        self._dashboard: dict[str, list[dict[str, Any]]] = {}  # session_id -> dashboard components

    def add_artifact(self, session_id: str, artifact: Artifact) -> Artifact:
        self._artifacts.setdefault(session_id, []).append(artifact)
        return artifact

    def get_artifacts(self, session_id: str) -> list[Artifact]:
        return self._artifacts.get(session_id, [])

    def get_artifact(self, session_id: str, artifact_id: str) -> Artifact | None:
        for a in self._artifacts.get(session_id, []):
            if a.id == artifact_id:
                return a
        return None

    def update_artifact(
        self, session_id: str, artifact_id: str, **kwargs: Any
    ) -> Artifact | None:
        for a in self._artifacts.get(session_id, []):
            if a.id == artifact_id:
                for k, v in kwargs.items():
                    setattr(a, k, v)
                return a
        return None

    def add_progress_step(self, session_id: str, step: ProgressStep) -> ProgressStep:
        self._progress.setdefault(session_id, []).append(step)
        return step

    def update_progress_step(self, session_id: str, step_id: str, **kwargs) -> ProgressStep | None:
        steps = self._progress.get(session_id, [])
        for step in steps:
            if step.id == step_id:
                for k, v in kwargs.items():
                    setattr(step, k, v)
                return step
        return None

    def get_progress(self, session_id: str) -> list[ProgressStep]:
        return self._progress.get(session_id, [])

    def clear_progress(self, session_id: str) -> None:
        self._progress[session_id] = []

    def add_dashboard_component(self, session_id: str, component: dict[str, Any]) -> None:
        self._dashboard.setdefault(session_id, []).append(component)

    def get_dashboard(self, session_id: str) -> list[dict[str, Any]]:
        return self._dashboard.get(session_id, [])

    def clear_dashboard(self, session_id: str) -> None:
        self._dashboard[session_id] = []


_store: ArtifactStore | None = None


def get_artifact_store() -> ArtifactStore:
    global _store
    if _store is None:
        _store = ArtifactStore()
    return _store
