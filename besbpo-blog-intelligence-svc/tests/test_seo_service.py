"""Tests the deterministic heuristic fallback directly — see
test_tagging_service.py's docstring for why (needs pydantic to import,
not installed here; reviewed not executed). Compare with
tests/test_seo_prompts.py for the genuinely executable LLM-path tests.
"""
from app.services.seo_service import _propose_seo_meta_heuristic


def test_meta_title_truncated_to_limit():
    long_title = "A" * 100
    proposal = _propose_seo_meta_heuristic(article_id="a1", title=long_title, excerpt=None, body_mdx="Body text.")
    assert len(proposal.meta_title) <= 60


def test_meta_description_falls_back_to_first_paragraph_when_no_excerpt():
    proposal = _propose_seo_meta_heuristic(
        article_id="a1",
        title="Title",
        excerpt=None,
        body_mdx="# Heading\n\nThis is the first real paragraph used as a fallback description.",
    )
    assert "first real paragraph" in proposal.meta_description
