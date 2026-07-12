"""Auto-tagging service (Doc-03 Section 6).

Phase 5: calls a real LLM (Anthropic Claude, via app/common/llm_client.py)
when configured, falling back to the Phase 0 deterministic keyword-overlap
heuristic when it isn't — no LLM_API_KEY set, or the LLM call fails even
after retries. This mirrors besbpo-blog-web's fixture-fallback philosophy:
the service should always return something reasonable rather than error
out, whether or not a real API key is configured.

Every path returns source=ai_proposed regardless of whether the LLM or
the heuristic produced it — the human-approval gate downstream
(besbpo-blog-cms-api's ArticlesService.transition) doesn't distinguish
between them, and shouldn't have to.
"""
from __future__ import annotations

import logging

from app.common.llm_client import LLMClient
from app.config import get_settings
from app.models import FieldSource, TaggingProposal
from app.services.tagging_prompts import build_tagging_prompt, parse_tagging_response

logger = logging.getLogger(__name__)


async def suggest_tags(article_id: str, title: str, body_mdx: str, known_divisions: list[str]) -> TaggingProposal:
    settings = get_settings()

    if settings.llm_api_key:
        try:
            return await _suggest_tags_llm(article_id, title, body_mdx, known_divisions, settings)
        except Exception as exc:  # noqa: BLE001 - deliberately broad: any LLM failure falls back
            logger.warning(
                "LLM tagging failed for article %s, falling back to heuristic: %s", article_id, exc
            )

    return _suggest_tags_heuristic(article_id, title, body_mdx, known_divisions)


async def _suggest_tags_llm(
    article_id: str, title: str, body_mdx: str, known_divisions: list[str], settings
) -> TaggingProposal:
    client = LLMClient(api_key=settings.llm_api_key, model=settings.llm_model)
    prompt = build_tagging_prompt(title, body_mdx, known_divisions)
    raw_response = await client.generate_text(prompt, max_tokens=512)
    division_tags, free_form_tags, confidence = parse_tagging_response(raw_response, known_divisions)

    return TaggingProposal(
        article_id=article_id,
        division_tags=division_tags,
        free_form_tags=free_form_tags,
        source=FieldSource.AI_PROPOSED,
        confidence=confidence,
    )


def _suggest_tags_heuristic(
    article_id: str, title: str, body_mdx: str, known_divisions: list[str]
) -> TaggingProposal:
    """Phase 0's deterministic keyword-overlap heuristic. Kept as the
    fallback path — see the module docstring — and unchanged from Phase 0
    so its existing behaviour/tests stay valid.
    """
    haystack = f"{title}\n{body_mdx}".lower()

    matched_divisions = [
        division
        for division in known_divisions
        if division.replace("-", " ") in haystack or division in haystack
    ]

    confidence = min(0.95, 0.3 + 0.15 * len(matched_divisions)) if matched_divisions else 0.2

    return TaggingProposal(
        article_id=article_id,
        division_tags=matched_divisions,
        free_form_tags=_extract_candidate_keywords(haystack),
        source=FieldSource.AI_PROPOSED,
        confidence=confidence,
    )


def _extract_candidate_keywords(haystack: str, limit: int = 5) -> list[str]:
    """Very naive keyword candidate extractor (word-frequency, stopword-free).
    Only used by the heuristic fallback path — the LLM path gets free-form
    tags directly from the model's response.
    """
    stopwords = {
        "the", "and", "for", "with", "that", "this", "from", "have", "will",
        "are", "was", "were", "our", "their", "its", "into", "over", "under",
    }
    words = [w.strip(".,!?():;\"'") for w in haystack.split()]
    freq: dict[str, int] = {}
    for w in words:
        if len(w) < 5 or w in stopwords:
            continue
        freq[w] = freq.get(w, 0) + 1
    ranked = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)
    return [w for w, _ in ranked[:limit]]
