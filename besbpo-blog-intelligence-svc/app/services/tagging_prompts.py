"""Pure prompt-building and response-parsing for the tagging service's LLM
path. No dependencies beyond stdlib (json) — testable without httpx or
pydantic installed, unlike almost everything else this module feeds into.
"""
from __future__ import annotations

import json


def build_tagging_prompt(title: str, body_mdx: str, known_divisions: list[str]) -> str:
    divisions_list = ", ".join(known_divisions)
    return (
        "You are tagging an article for a corporate blog syndication platform.\n"
        f"Valid division tags (choose only from this list): {divisions_list}\n\n"
        f"Title: {title}\n\n"
        f"Body:\n{body_mdx}\n\n"
        "Respond with ONLY a JSON object (no other text, no markdown fences) "
        "in exactly this shape:\n"
        '{"division_tags": ["..."], "free_form_tags": ["..."], "confidence": 0.0}\n\n'
        "- division_tags: 1-3 tags from the valid list above that best match the article.\n"
        "- free_form_tags: 0-5 short, lowercase, hyphenated keywords not from the division list.\n"
        "- confidence: your confidence in the division_tags, from 0.0 to 1.0."
    )


def parse_tagging_response(raw_text: str, known_divisions: list[str]) -> tuple[list[str], list[str], float]:
    """Returns (division_tags, free_form_tags, confidence).

    Raises ValueError if the response isn't parseable JSON in roughly the
    expected shape — callers (tagging_service.suggest_tags) should catch
    this and fall back to the deterministic heuristic rather than let a
    malformed LLM response break the request.
    """
    try:
        data = json.loads(_strip_markdown_fences(raw_text))
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM tagging response was not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError("LLM tagging response was not a JSON object")

    raw_division_tags = data.get("division_tags", [])
    if not isinstance(raw_division_tags, list):
        raise ValueError("division_tags was not a list")
    # Only trust divisions the caller told us are valid — an LLM can
    # hallucinate a plausible-sounding division key that doesn't actually
    # exist in the taxonomy.
    known_set = set(known_divisions)
    division_tags = [d for d in raw_division_tags if isinstance(d, str) and d in known_set]

    raw_free_form = data.get("free_form_tags", [])
    free_form_tags = [t for t in raw_free_form if isinstance(t, str)] if isinstance(raw_free_form, list) else []

    confidence_raw = data.get("confidence", 0.5)
    try:
        confidence = float(confidence_raw)
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    return division_tags, free_form_tags, confidence


def _strip_markdown_fences(text: str) -> str:
    """Models sometimes wrap JSON in ```json ... ``` even when explicitly
    told not to. Strip that defensively rather than failing the parse.
    """
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines)
    return stripped.strip()
