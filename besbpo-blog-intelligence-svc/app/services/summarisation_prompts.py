"""Pure prompt-building and response-cleaning for the summarisation
service's LLM path. Unlike tagging/SEO, this doesn't need JSON — the
model is asked to return the excerpt as plain text directly. Same
rationale as the other *_prompts.py modules: stdlib only, testable
without httpx/pydantic installed.
"""
from __future__ import annotations


def build_summarisation_prompt(body_mdx: str, max_characters: int) -> str:
    return (
        "Write a single, plain-text excerpt summarising the following article "
        f"body, suitable for a syndication feed. Maximum {max_characters} "
        "characters. Do not include markdown formatting, headings, or "
        "surrounding quotation marks — respond with ONLY the summary text "
        "itself, nothing else.\n\n"
        f"Article body:\n{body_mdx}"
    )


def clean_summarisation_response(raw_text: str, max_characters: int) -> str:
    """Cleans an LLM-generated excerpt and enforces the length limit, in
    case the model didn't respect it exactly.
    """
    text = raw_text.strip()

    # Strip wrapping quotes if the model added them despite instructions
    # not to.
    if len(text) >= 2 and text[0] in "\"'" and text[-1] == text[0]:
        text = text[1:-1].strip()

    if len(text) <= max_characters:
        return text
    truncated = text[: max_characters - 1].rsplit(" ", 1)[0]
    return (truncated or text[: max_characters - 1]) + "…"
