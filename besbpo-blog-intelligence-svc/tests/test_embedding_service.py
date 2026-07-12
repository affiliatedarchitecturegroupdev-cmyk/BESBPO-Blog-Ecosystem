"""Tests the deterministic placeholder fallback directly — see
test_tagging_service.py's docstring for why (needs pydantic to import,
not installed here; reviewed not executed). Compare with
tests/test_voyage_response.py for the genuinely executable Voyage
response-parsing tests.

Dimension updated from the Phase 0 value of 1536 to 1024 — see
besbpo-blog-architecture/adr/0004-voyage-embeddings-1024-dimensions.md
for why (Voyage AI, the actual provider now wired in, defaults to 1024,
not 1536 — that was an unexamined OpenAI-convention holdover).
"""
from app.services.embedding_service import _generate_embedding_placeholder

_DIMENSIONS = 1024


def test_embedding_has_correct_dimensionality():
    response = _generate_embedding_placeholder(article_id="a1", text="Some article text.", dimensions=_DIMENSIONS)
    assert response.dimensions == _DIMENSIONS
    assert len(response.embedding) == _DIMENSIONS


def test_embedding_is_deterministic_for_same_input():
    r1 = _generate_embedding_placeholder(article_id="a1", text="Same text", dimensions=_DIMENSIONS)
    r2 = _generate_embedding_placeholder(article_id="a1", text="Same text", dimensions=_DIMENSIONS)
    assert r1.embedding == r2.embedding
