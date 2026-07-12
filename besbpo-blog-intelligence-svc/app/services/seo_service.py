"""SEO metadata proposal service (Doc-03 Section 6).

Phase 5: calls a real LLM when configured, falling back to Phase 0's
deterministic truncation/templating otherwise or on failure — see
tagging_service.py's module docstring for the full rationale, which
applies identically here.
"""
from __future__ import annotations

import logging

from app.common.llm_client import LLMClient
from app.config import get_settings
from app.models import FieldSource, SeoProposal
from app.services.seo_prompts import build_seo_prompt, parse_seo_response

logger = logging.getLogger(__name__)

_META_TITLE_MAX = 60
_META_DESCRIPTION_MAX = 155


async def propose_seo_meta(article_id: str, title: str, excerpt: str | None, body_mdx: str) -> SeoProposal:
    settings = get_settings()

    if settings.llm_api_key:
        try:
            return await _propose_seo_meta_llm(article_id, title, excerpt, body_mdx, settings)
        except Exception as exc:  # noqa: BLE001 - deliberately broad: any LLM failure falls back
            logger.warning(
                "LLM SEO generation failed for article %s, falling back to heuristic: %s", article_id, exc
            )

    return _propose_seo_meta_heuristic(article_id, title, excerpt, body_mdx)


async def _propose_seo_meta_llm(
    article_id: str, title: str, excerpt: str | None, body_mdx: str, settings
) -> SeoProposal:
    client = LLMClient(api_key=settings.llm_api_key, model=settings.llm_model)
    prompt = build_seo_prompt(title, excerpt, body_mdx)
    raw_response = await client.generate_text(prompt, max_tokens=256)
    meta_title, meta_description = parse_seo_response(raw_response)

    return SeoProposal(
        article_id=article_id,
        meta_title=meta_title,
        meta_description=meta_description,
        og_title=meta_title,
        og_description=meta_description,
        source=FieldSource.AI_PROPOSED,
    )


def _propose_seo_meta_heuristic(
    article_id: str, title: str, excerpt: str | None, body_mdx: str
) -> SeoProposal:
    """Phase 0's deterministic truncation/templating. Kept as the fallback
    path, unchanged from Phase 0 so its existing behaviour/tests stay valid.
    """
    meta_title = _truncate(title, _META_TITLE_MAX)

    description_source = excerpt or _first_paragraph(body_mdx)
    meta_description = _truncate(description_source, _META_DESCRIPTION_MAX)

    return SeoProposal(
        article_id=article_id,
        meta_title=meta_title,
        meta_description=meta_description,
        og_title=meta_title,
        og_description=meta_description,
        source=FieldSource.AI_PROPOSED,
    )


def _first_paragraph(body_mdx: str) -> str:
    for block in body_mdx.split("\n\n"):
        stripped = block.strip()
        if stripped and not stripped.startswith("#"):
            return stripped
    return ""


def _truncate(text: str, max_len: int) -> str:
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rsplit(" ", 1)[0] + "…"
