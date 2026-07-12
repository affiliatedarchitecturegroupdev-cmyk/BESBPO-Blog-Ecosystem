"""Tests the deterministic heuristic fallback directly — see
test_tagging_service.py's docstring for why (needs pydantic to import,
not installed here; reviewed not executed). Compare with
tests/test_summarisation_prompts.py for the genuinely executable LLM-path
tests.
"""
from app.services.summarisation_service import _summarise_heuristic


def test_excerpt_respects_max_characters():
    body = "Sentence one is here. Sentence two follows. Sentence three as well. " * 5
    proposal = _summarise_heuristic(article_id="a1", body_mdx=body, max_characters=80)
    assert len(proposal.excerpt) <= 80


def test_strips_markdown_formatting():
    body = "# Title\n\nThis has **bold** and _italic_ and a [link](https://example.com)."
    proposal = _summarise_heuristic(article_id="a1", body_mdx=body, max_characters=240)
    assert "**" not in proposal.excerpt
    assert "[link]" not in proposal.excerpt
    assert "link" in proposal.excerpt
