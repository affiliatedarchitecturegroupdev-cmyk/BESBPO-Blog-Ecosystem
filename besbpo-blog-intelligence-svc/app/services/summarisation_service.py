"""Excerpt/summarisation proposal service (Doc-03 Section 6).

Phase 5: calls a real LLM when configured, falling back to Phase 0's
deterministic sentence-boundary truncation otherwise or on failure — see
tagging_service.py's module docstring for the full rationale.
"""
from __future__ import annotations

import logging
import re

from app.common.llm_client import LLMClient
from app.config import get_settings
from app.models import FieldSource, SummarisationProposal
from app.services.summarisation_prompts import build_summarisation_prompt, clean_summarisation_response

logger = logging.getLogger(__name__)

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


async def summarise(article_id: str, body_mdx: str, max_characters: int = 240) -> SummarisationProposal:
    settings = get_settings()

    if settings.llm_api_key:
        try:
            return await _summarise_llm(article_id, body_mdx, max_characters, settings)
        except Exception as exc:  # noqa: BLE001 - deliberately broad: any LLM failure falls back
            logger.warning(
                "LLM summarisation failed for article %s, falling back to heuristic: %s", article_id, exc
            )

    return _summarise_heuristic(article_id, body_mdx, max_characters)


async def _summarise_llm(article_id: str, body_mdx: str, max_characters: int, settings) -> SummarisationProposal:
    client = LLMClient(api_key=settings.llm_api_key, model=settings.llm_model)
    prompt = build_summarisation_prompt(body_mdx, max_characters)
    raw_response = await client.generate_text(prompt, max_tokens=200)
    excerpt = clean_summarisation_response(raw_response, max_characters)

    return SummarisationProposal(article_id=article_id, excerpt=excerpt, source=FieldSource.AI_PROPOSED)


def _summarise_heuristic(article_id: str, body_mdx: str, max_characters: int = 240) -> SummarisationProposal:
    """Phase 0's deterministic sentence-boundary truncation. Kept as the
    fallback path, unchanged from Phase 0 so its existing behaviour/tests
    stay valid.
    """
    plain_text = _strip_markdown(body_mdx)
    sentences = _SENTENCE_SPLIT.split(plain_text.strip())

    excerpt = ""
    for sentence in sentences:
        candidate = (excerpt + " " + sentence).strip() if excerpt else sentence
        if len(candidate) > max_characters:
            break
        excerpt = candidate

    if not excerpt and plain_text:
        excerpt = plain_text[: max_characters - 1].rsplit(" ", 1)[0] + "…"

    return SummarisationProposal(
        article_id=article_id,
        excerpt=excerpt,
        source=FieldSource.AI_PROPOSED,
    )


def _strip_markdown(body_mdx: str) -> str:
    text = re.sub(r"^#+\s*", "", body_mdx, flags=re.MULTILINE)   # headings
    text = re.sub(r"[*_`]", "", text)                             # emphasis/code markers
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)                   # images
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)                # links -> link text
    text = re.sub(r"\n{2,}", " ", text)                            # collapse blank lines
    return re.sub(r"\s+", " ", text).strip()
