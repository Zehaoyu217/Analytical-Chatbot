"""Hierarchical skill registry — discovers skills from folder structure.

Skills live in folders under the skills directory. Each folder must contain a
SKILL.yaml file (preferred) or SKILL.md (legacy fallback).

SKILL.yaml schema:
  skill_name: str                    # display name
  skill_description: str             # one-line catalog description
  content: |                         # full skill content (literal block)
    ...markdown / code...
  sub_skills:                        # optional — L1 skills that have L2 children
    - path: parent/child             # load_skill() path
      description: str
      when: str                      # conditions that should trigger loading this sub-skill

Sub-skills are sub-folders within a skill folder, each with their own SKILL.yaml.
The agent sees all top-level skill names + descriptions by default (via system prompt),
and calls load_skill() to get full content. After loading an L1 skill it decides
whether to load specific L2 sub-skills for detailed templates.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.config import get_config

logger = logging.getLogger(__name__)


class SkillRegistry:
    """Discovers and loads skills from the hierarchical folder structure."""

    def __init__(self, skills_dir: str):
        self._dir = Path(skills_dir)
        self._cache: dict[str, dict[str, Any]] = {}
        self.scan()

    # ── Discovery ────────────────────────────────────────────────────────────

    def scan(self) -> None:
        """Scan the skills directory for skill folders."""
        self._cache.clear()
        if not self._dir.exists():
            return

        for skill_dir in sorted(self._dir.iterdir()):
            if not skill_dir.is_dir() or skill_dir.name.startswith(("_", ".")):
                continue
            skill_file = self._find_skill_file(skill_dir)
            if not skill_file:
                continue

            skill = self._parse_skill(skill_file, skill_dir.name)
            if not skill:
                continue

            # Sub-skills: prefer YAML-declared list, fall back to directory scan
            sub_skills = self._discover_sub_skills(skill_dir, skill_dir.name, skill)
            skill["sub_skills"] = sub_skills
            self._cache[skill_dir.name] = skill

    def _find_skill_file(self, directory: Path) -> Path | None:
        """Return SKILL.yaml (preferred) or SKILL.md (legacy) or None."""
        for name in ("SKILL.yaml", "SKILL.yml", "SKILL.md"):
            candidate = directory / name
            if candidate.exists():
                return candidate
        return None

    def _discover_sub_skills(
        self,
        skill_dir: Path,
        parent_path: str,
        parent_skill: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Build sub-skill catalog entries.

        If the parent YAML declares a ``sub_skills`` list, use those entries
        (they carry ``when`` conditions). Directory scan is used to verify
        existence and fill any gaps not listed in the YAML.
        """
        yaml_declared: dict[str, dict] = {}
        for entry in parent_skill.pop("_raw_sub_skills", []):
            yaml_declared[entry["path"]] = entry

        result: list[dict[str, Any]] = []
        for sub_dir in sorted(skill_dir.iterdir()):
            if not sub_dir.is_dir() or sub_dir.name.startswith(("_", ".")):
                continue
            sub_file = self._find_skill_file(sub_dir)
            if not sub_file:
                continue
            sub_path = f"{parent_path}/{sub_dir.name}"
            sub_parsed = self._parse_skill(sub_file, sub_path)
            if not sub_parsed:
                continue

            entry: dict[str, Any] = {
                "name": sub_parsed["name"],
                "path": sub_path,
                "description": sub_parsed["description"],
            }
            # Merge YAML-declared metadata (description override + when)
            if sub_path in yaml_declared:
                declared = yaml_declared[sub_path]
                entry["description"] = declared.get("description", entry["description"])
                if declared.get("when"):
                    entry["when"] = declared["when"]
            result.append(entry)

        # Also include any YAML-declared sub-skills that don't have a directory yet
        # (useful for forward declarations), marked as unavailable
        for path, declared in yaml_declared.items():
            if not any(e["path"] == path for e in result):
                logger.warning("Sub-skill '%s' declared in YAML but no directory found", path)

        return result

    # ── Parsing ──────────────────────────────────────────────────────────────

    def _parse_skill(self, path: Path, skill_path: str) -> dict[str, Any] | None:
        """Parse a SKILL.yaml or SKILL.md file into a skill dict."""
        if path.suffix in (".yaml", ".yml"):
            return self._parse_skill_yaml(path, skill_path)
        return self._parse_skill_md(path, skill_path)

    def _parse_skill_yaml(self, path: Path, skill_path: str) -> dict[str, Any] | None:
        """Parse a SKILL.yaml file using PyYAML."""
        import yaml  # pyyaml — listed in pyproject.toml
        try:
            data = yaml.safe_load(path.read_text())
        except yaml.YAMLError as exc:
            logger.warning("Failed to parse YAML skill '%s': %s", path, exc)
            return None

        if not isinstance(data, dict):
            return None

        skill: dict[str, Any] = {
            "name": data.get("skill_name", data.get("name", "Unknown Skill")),
            "path": skill_path,
            "description": data.get("skill_description", data.get("description", "")),
            "content": str(data.get("content", "")).strip(),
        }

        # Stash raw sub_skills list so _discover_sub_skills() can merge it
        raw_sub = data.get("sub_skills", [])
        if isinstance(raw_sub, list):
            skill["_raw_sub_skills"] = [
                {
                    "path": entry.get("path", ""),
                    "description": entry.get("description", ""),
                    "when": entry.get("when", ""),
                }
                for entry in raw_sub
                if isinstance(entry, dict)
            ]

        return skill

    def _parse_skill_md(self, path: Path, skill_path: str) -> dict[str, Any] | None:
        """Parse a legacy SKILL.md file (JSON frontmatter or line-based)."""
        import json
        import re

        text = path.read_text().strip()

        # JSON fenced block: ```json ... ```
        m = re.match(r'^```json\s*?\n(.*?)\n```\s*(.*)', text, flags=re.DOTALL)
        if m:
            try:
                meta = json.loads(m.group(1))
                return {
                    "name": meta.get("skill_name", meta.get("name", "Unknown Skill")),
                    "path": skill_path,
                    "description": meta.get("skill_description", meta.get("description", "")),
                    "content": m.group(2).strip(),
                }
            except json.JSONDecodeError:
                pass

        # Raw JSON block at start
        m_raw = re.match(r'^({.*?})\s*\n+(.*)', text, flags=re.DOTALL)
        if m_raw:
            try:
                meta = json.loads(m_raw.group(1))
                return {
                    "name": meta.get("skill_name", meta.get("name", "Unknown Skill")),
                    "path": skill_path,
                    "description": meta.get("skill_description", meta.get("description", "")),
                    "content": m_raw.group(2).strip(),
                }
            except json.JSONDecodeError:
                pass

        # Line-based fallback: line 1 = name, line 2 = description
        lines = text.split("\n")
        if len(lines) < 2:
            return None
        return {
            "name": lines[0].strip(),
            "path": skill_path,
            "description": lines[1].strip(),
            "content": "\n".join(lines[2:]).strip(),
        }

    # ── Public API ────────────────────────────────────────────────────────────

    def list_skills(self) -> list[dict[str, Any]]:
        """Return skill catalog (name + description + sub-skill summaries). No content."""
        if get_config().skills.auto_reload:
            self.scan()
        result = []
        for s in self._cache.values():
            entry: dict[str, Any] = {
                "name": s["name"],
                "path": s["path"],
                "description": s["description"],
            }
            if s.get("sub_skills"):
                entry["sub_skills"] = [
                    {k: v for k, v in sub.items() if k != "content"}
                    for sub in s["sub_skills"]
                ]
            result.append(entry)
        return result

    def get_skill(self, skill_path: str) -> dict[str, Any] | None:
        """Get full skill content by path.

        Args:
            skill_path: Top-level name (e.g. "altair_charts") or
                        sub-skill path (e.g. "altair_charts/bar_chart").
        """
        if get_config().skills.auto_reload:
            self.scan()

        parts = skill_path.strip("/").split("/")
        top = parts[0]

        if top not in self._cache:
            return None

        skill = self._cache[top]

        if len(parts) == 1:
            return skill

        # Sub-skill — read from disk fresh
        sub_path = "/".join(parts)
        sub_dir = self._dir / sub_path
        sub_file = self._find_skill_file(sub_dir)
        if sub_file:
            return self._parse_skill(sub_file, sub_path)
        return None

    def get_catalog_prompt(self) -> str:
        """Generate a prompt-friendly skill catalog injected into the system prompt."""
        skills = self.list_skills()
        if not skills:
            return ""

        lines = ["\n## Available Skills"]
        lines.append(
            "Skills provide detailed instructions and code templates for specific tasks. "
            "Load all relevant L1 skills up front in parallel, then load L2 sub-skills "
            "for the specific chart type / technique you need.\n"
        )

        # Task-specific loading guidance derived from actual skill paths
        skill_paths = {s["path"] for s in skills}
        guidance = []
        if "altair_charts" in skill_paths:
            guidance.append(
                '- **Charts/visualizations**: load the specific sub-skill directly — '
                'e.g. load_skill("altair_charts/bar_chart"). Do NOT load the parent "altair_charts".'
            )
        if "mermaid" in skill_paths:
            guidance.append('- **Diagrams/flowcharts**: load_skill("mermaid")')
        if "tables" in skill_paths:
            guidance.append('- **Styled tables**: load_skill("tables")')
        if "dashboard" in skill_paths:
            guidance.append('- **Dashboards**: load_skill("dashboard")')
        if guidance:
            lines.extend(guidance)
        lines.append("")

        # Skill catalog
        for s in skills:
            lines.append(f"- **{s['path']}**: {s['description']}")
            for sub in s.get("sub_skills", []):
                when_str = f" · _when_: {sub['when']}" if sub.get("when") else ""
                lines.append(f"  - **{sub['path']}**: {sub['description']}{when_str}")

        return "\n".join(lines)


_registry: SkillRegistry | None = None


def get_skill_registry() -> SkillRegistry:
    global _registry
    if _registry is None:
        cfg = get_config()
        _registry = SkillRegistry(cfg.skills.directory)
    return _registry
