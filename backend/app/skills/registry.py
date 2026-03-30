"""Hierarchical skill registry — discovers skills from folder structure.

Skills live in folders under the skills directory. Each folder contains a
SKILL.md file with:
  - Line 1: Skill name
  - Line 2: Short description
  - Rest: Full skill content

Sub-skills are sub-folders within a skill folder, each with their own SKILL.md.
The agent sees all top-level skill names + descriptions by default,
and can load individual skills (or sub-skills) on demand.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import get_config


class SkillRegistry:
    """Discovers and loads skills from the hierarchical folder structure."""

    def __init__(self, skills_dir: str):
        self._dir = Path(skills_dir)
        self._cache: dict[str, dict[str, Any]] = {}
        self.scan()

    def scan(self) -> None:
        """Scan the skills directory for skill folders with SKILL.md files."""
        self._cache.clear()
        if not self._dir.exists():
            return

        for skill_dir in sorted(self._dir.iterdir()):
            if not skill_dir.is_dir() or skill_dir.name.startswith(("_", ".")):
                continue
            skill_file = skill_dir / "SKILL.md"
            if not skill_file.exists():
                continue

            skill = self._parse_skill(skill_file, skill_dir.name)
            if skill:
                # Discover sub-skills
                sub_skills = []
                for sub_dir in sorted(skill_dir.iterdir()):
                    if not sub_dir.is_dir() or sub_dir.name.startswith(("_", ".")):
                        continue
                    sub_file = sub_dir / "SKILL.md"
                    if sub_file.exists():
                        sub = self._parse_skill(sub_file, f"{skill_dir.name}/{sub_dir.name}")
                        if sub:
                            sub_skills.append({
                                "name": sub["name"],
                                "path": sub["path"],
                                "description": sub["description"],
                            })
                skill["sub_skills"] = sub_skills
                self._cache[skill_dir.name] = skill

    def _parse_skill(self, path: Path, skill_path: str) -> dict[str, Any] | None:
        """Parse a SKILL.md file. 
        Supports JSON frontmatter matching ```json ... ``` or fallback to line 1=name, line 2=description.
        """
        import json
        import re
        text = path.read_text().strip()

        # 1. Try JSON fenced block
        m = re.match(r'^```json\s*?\n(.*?)\n```\s*(.*)', text, flags=re.DOTALL)
        if m:
            try:
                metadata = json.loads(m.group(1))
                return {
                    "name": metadata.get("skill_name", metadata.get("name", "Unknown Skill")),
                    "path": skill_path,
                    "description": metadata.get("skill_description", metadata.get("description", "No description provided.")),
                    "content": m.group(2).strip(),
                }
            except json.JSONDecodeError:
                pass
        
        # 2. Try raw JSON block at start (assuming it ends before the first markdown heading or empty lines)
        m_raw = re.match(r'^({.*?})\s*\n+(.*)', text, flags=re.DOTALL)
        if m_raw:
            try:
                metadata = json.loads(m_raw.group(1))
                return {
                    "name": metadata.get("skill_name", metadata.get("name", "Unknown Skill")),
                    "path": skill_path,
                    "description": metadata.get("skill_description", metadata.get("description", "No description provided.")),
                    "content": m_raw.group(2).strip(),
                }
            except json.JSONDecodeError:
                pass

        # 3. Fallback to old line-based parsing
        lines = text.split("\n")
        if len(lines) < 2:
            return None

        name = lines[0].strip()
        description = lines[1].strip()
        content = "\n".join(lines[2:]).strip()

        return {
            "name": name,
            "path": skill_path,
            "description": description,
            "content": content,
        }

    def list_skills(self) -> list[dict[str, Any]]:
        """Return skill catalog (name + description + sub-skill names). No content."""
        cfg = get_config()
        if cfg.skills.auto_reload:
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
                    {"name": sub["name"], "path": sub["path"], "description": sub["description"]}
                    for sub in s["sub_skills"]
                ]
            result.append(entry)
        return result

    def get_skill(self, skill_path: str) -> dict[str, Any] | None:
        """Get full skill content by path.

        Args:
            skill_path: Skill folder name (e.g., "visualization") or
                        sub-skill path (e.g., "visualization/interactive_charts").
        """
        cfg = get_config()
        if cfg.skills.auto_reload:
            self.scan()

        parts = skill_path.strip("/").split("/")
        top = parts[0]

        if top not in self._cache:
            return None

        skill = self._cache[top]

        if len(parts) == 1:
            return skill

        # Sub-skill lookup
        sub_path = "/".join(parts)
        for sub in skill.get("sub_skills", []):
            if sub["path"] == sub_path:
                # Read the sub-skill content from disk
                sub_file = self._dir / sub_path / "SKILL.md"
                if sub_file.exists():
                    return self._parse_skill(sub_file, sub_path)
        return None

    def get_catalog_prompt(self) -> str:
        """Generate a prompt-friendly catalog of all available skills."""
        skills = self.list_skills()
        if not skills:
            return ""
        lines = ["\n## Available Skills"]
        lines.append(
            "Use `load_skill(skill_name)` to load detailed instructions before specialized tasks."
        )

        # Build skill-specific guidance from actual skill names
        skill_paths = [s["path"] for s in skills]
        guidance = []
        if "altair_charts" in skill_paths:
            guidance.append('- **Charts/visualizations**: ALWAYS call `load_skill("altair_charts")` FIRST')
        if "mermaid" in skill_paths:
            guidance.append('- **Diagrams/flowcharts**: call `load_skill("mermaid")` first')
        if "tables" in skill_paths:
            guidance.append('- **Styled tables**: call `load_skill("tables")` first')
        if "dashboard" in skill_paths:
            guidance.append('- **Dashboards**: call `load_skill("dashboard")` first')
        if guidance:
            lines.extend(guidance)

        lines.append("")
        for s in skills:
            lines.append(f"- **{s['path']}**: {s['description']}")
            for sub in s.get("sub_skills", []):
                lines.append(f"  - **{sub['path']}**: {sub['description']}")
        return "\n".join(lines)


_registry: SkillRegistry | None = None


def get_skill_registry() -> SkillRegistry:
    global _registry
    if _registry is None:
        cfg = get_config()
        _registry = SkillRegistry(cfg.skills.directory)
    return _registry
