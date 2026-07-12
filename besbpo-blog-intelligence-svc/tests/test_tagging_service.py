"""Tests the deterministic heuristic fallback directly. Like the rest of
this file's Phase 0 predecessor, this needs pydantic (via app.models) to
even import, which isn't installed in the environment this was authored
in — reviewed, not executed. Compare with tests/test_tagging_prompts.py,
which tests the new LLM-path prompt/parsing logic and IS genuinely
executable (stdlib only) — see that file and the platform root README's
verification methodology note.
"""
from app.services.tagging_service import _suggest_tags_heuristic


def test_matches_known_divisions_mentioned_in_body():
    proposal = _suggest_tags_heuristic(
        article_id="a1",
        title="Financing Infrastructure Projects",
        body_mdx="This piece covers construction financing and built-environment partnerships.",
        known_divisions=["construction", "built-environment", "logistics"],
    )
    assert "construction" in proposal.division_tags
    assert "built-environment" in proposal.division_tags
    assert "logistics" not in proposal.division_tags
    assert proposal.source == "ai_proposed"


def test_no_match_still_returns_low_confidence_not_error():
    proposal = _suggest_tags_heuristic(
        article_id="a2",
        title="Team culture update",
        body_mdx="A short note about our culture.",
        known_divisions=["construction", "logistics"],
    )
    assert proposal.division_tags == []
    assert 0.0 <= proposal.confidence <= 1.0
