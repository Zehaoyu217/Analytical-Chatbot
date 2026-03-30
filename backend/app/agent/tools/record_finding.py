"""record_finding tool — writes a key insight into the persistent findings bulletin.

This tool is the agent's mechanism for durably recording discoveries that MUST
survive context compaction. Unlike regular tool output (which gets truncated after
~10 turns), findings recorded here are injected into EVERY subsequent agent turn.
"""
from __future__ import annotations

import logging

from langchain_core.tools import tool

from app.agent.context import current_session_id

logger = logging.getLogger(__name__)


@tool
def record_finding(finding: str, phase: str = "") -> str:
    """Record an important insight into the persistent findings bulletin.

    Findings are injected into every subsequent agent turn — they NEVER get compacted
    away, even in 150+ tool call sessions. Use this liberally — every call is cheap.

    Call it for:
    - A key statistical result: "GDP correlation with unemployment: -0.73 (strong negative)"
    - A data quality note: "gdp column is in trillions, not billions — do NOT multiply by 1000"
    - A model result: "Ridge regression beats linear (R2=0.81 vs 0.74) — use ridge"
    - A variable shape: "df_features: 1247 rows, 14 columns after lag transforms"
    - A decision made: "Excluded 2008-2009 from training set (financial crisis outlier)"
    - An error already tried: "LIMIT 1000 needed — full dataset causes memory error"

    Args:
        finding: The insight to record. Be specific — include numbers and column names.
        phase: Optional phase label, e.g. "EDA", "Modeling", "Visualization".
    """
    session_id = current_session_id.get()
    if not session_id:
        return f"Finding noted (no session): {finding}"

    try:
        from app.agent.persistent_state import _persistent_store
        ps = _persistent_store.load(session_id)
        entry = f"[{phase}] {finding}" if phase else finding
        ps.findings.append(entry)
        _persistent_store.save(session_id, ps)
        logger.info("record_finding: session=%s, entry=%s", session_id, entry[:80])
        return f"Finding recorded: {entry}"
    except Exception as e:
        logger.warning("record_finding failed: %s", e)
        return f"Finding noted (storage error): {finding}"
