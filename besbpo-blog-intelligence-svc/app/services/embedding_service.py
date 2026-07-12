"""Embedding generation service (Doc-03 Sections 6-7).

Phase 5: calls Voyage AI (Anthropic's recommended embeddings partner —
Claude has no first-party embeddings API; see besbpo-blog-architecture's
ADR 0004) when configured, producing real, semantically meaningful
embeddings for the first time. Falls back to the Phase 0 deterministic
hash-based pseudo-embedding when VOYAGE_API_KEY isn't set or the call
fails — that fallback is NOT semantically meaningful (documented in its
own function below) but keeps the API contract and pgvector write path
functional for local dev / CI without secrets configured.

DIMENSION NOTE: the fallback pseudo-embedding and the real Voyage
embedding both respect settings.embedding_dimensions (1024 by default),
so a caller never needs to know which path produced a given vector — but
they are NOT interchangeable in the vector space sense. Re-embed
everything with the real path before relying on similarity search /
recommendations in any environment where the fallback may have been used.
"""
from __future__ import annotations

import hashlib
import logging

from app.common.embedding_client import EmbeddingClient
from app.config import get_settings
from app.models import EmbeddingResponse

logger = logging.getLogger(__name__)

_PLACEHOLDER_MODEL = "phase0-placeholder-hash-embedding"


async def generate_embedding(article_id: str, text: str) -> EmbeddingResponse:
    settings = get_settings()

    if settings.voyage_api_key:
        try:
            return await _generate_embedding_voyage(article_id, text, settings)
        except Exception as exc:  # noqa: BLE001 - deliberately broad: any API failure falls back
            logger.warning(
                "Voyage embedding failed for article %s, falling back to placeholder hash: %s",
                article_id,
                exc,
            )

    return _generate_embedding_placeholder(article_id, text, settings.embedding_dimensions)


async def _generate_embedding_voyage(article_id: str, text: str, settings) -> EmbeddingResponse:
    client = EmbeddingClient(
        api_key=settings.voyage_api_key,
        model=settings.voyage_model,
        output_dimension=settings.embedding_dimensions,
    )
    vector = await client.embed(text, input_type="document")

    if len(vector) != settings.embedding_dimensions:
        # Defensive check: if Voyage's response doesn't match the
        # configured dimension (e.g. EMBEDDING_DIMENSIONS was changed
        # without updating VOYAGE_MODEL's supported output_dimension, or
        # vice versa), fail loudly here rather than silently writing a
        # mismatched vector that would corrupt the pgvector column.
        raise ValueError(
            f"Voyage returned a {len(vector)}-dimension embedding, "
            f"expected {settings.embedding_dimensions} (check EMBEDDING_DIMENSIONS / VOYAGE_MODEL)"
        )

    return EmbeddingResponse(
        article_id=article_id,
        embedding=vector,
        model=settings.voyage_model,
        dimensions=settings.embedding_dimensions,
    )


def _generate_embedding_placeholder(article_id: str, text: str, dimensions: int) -> EmbeddingResponse:
    """Phase 0's deterministic, hash-based pseudo-embedding. NOT
    semantically meaningful — a structural placeholder only, so the API
    contract and pgvector write path can be exercised without a Voyage
    API key. Kept unchanged from Phase 0 (aside from taking `dimensions`
    as a parameter instead of a hardcoded module constant, since that now
    comes from settings.embedding_dimensions).
    """
    vector = _pseudo_embedding(text, dimensions)
    return EmbeddingResponse(
        article_id=article_id,
        embedding=vector,
        model=_PLACEHOLDER_MODEL,
        dimensions=dimensions,
    )


def _pseudo_embedding(text: str, dimensions: int) -> list[float]:
    seed = hashlib.sha256(text.encode("utf-8")).digest()
    values: list[float] = []
    i = 0
    while len(values) < dimensions:
        byte = seed[i % len(seed)]
        values.append((byte / 255.0) * 2 - 1)  # scale to [-1, 1]
        i += 1
    return values
