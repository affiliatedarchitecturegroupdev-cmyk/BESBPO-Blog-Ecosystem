"""Pure prompt-building and response-parsing for the SEO service's LLM
path. Same rationale as tagging_prompts.py — stdlib only, testable
without httpx/pydantic installed.
"""
from __future__ import annotations

import json

_META_TITLE_MAX = 60
_META_DESCRIPTION_MAX = 155


def build_seo_prompt(title: str, excerpt: str | None, body_mdx: str) -> str:
    excerpt_line = f"Existing excerpt: {excerpt}\n\n" if excerpt else ""
    return (
        "You are writing SEO metadata for a corporate blog article.\n\n"
        f"Title: {title}\n\n"
        f"{excerpt_line}"
        f"Body:\n{body_mdx}\n\n"
        "Respond with ONLY a JSON object (no other text, no markdown fences) "
        "in exactly this shape:\n"
        '{"meta_title": "...", "meta_description": "..."}\n\n'
        f"- meta_title: at most {_META_TITLE_MAX} characters, compelling, includes the key topic.\n"
        f"- meta_description: at most {_META_DESCRIPTION_MAX} characters, a clear one-sentence summary."
    )


def parse_seo_response(raw_text: str) -> tuple[str, str]:
    """Returns (meta_title, meta_description), each truncated to the SEO
    length limits if the model didn't respect them. Raises ValueError if
    the response isn't parseable JSON in the expected shape.
    """
    try:
        data = json.loads(_strip_markdown_fences(raw_text))
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM SEO response was not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError("LLM SEO response was not a JSON object")

    meta_title = data.get("meta_title")
    meta_description = data.get("meta_description")
    if not isinstance(meta_title, str) or not meta_title.strip():
        raise ValueError("meta_title was missing or empty")
    if not isinstance(meta_description, str) or not meta_description.strip():
        raise ValueError("meta_description was missing or empty")

    return _truncate(meta_title, _META_TITLE_MAX), _truncate(meta_description, _META_DESCRIPTION_MAX)


def _truncate(text: str, max_len: int) -> str:
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rsplit(" ", 1)[0] + "…"


def _strip_markdown_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines)
    return stripped.strip()
