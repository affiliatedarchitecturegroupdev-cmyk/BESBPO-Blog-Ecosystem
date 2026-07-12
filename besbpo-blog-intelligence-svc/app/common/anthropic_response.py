"""Pure parsing of an Anthropic Messages API response body. Deliberately
has NO dependency on httpx (or anything else non-stdlib) so it can be
imported and tested even in an environment where httpx isn't installed —
which is exactly the environment this was authored in. llm_client.py
imports extract_text from here rather than defining it inline, so this
file is the actual thing tests/test_llm_client.py exercises.
"""
from __future__ import annotations


def extract_text(data: dict) -> str:
    """Extracts and concatenates all text blocks from an Anthropic
    Messages API response body, e.g.:

        {"content": [{"type": "text", "text": "hello"}], ...}

    Ignores any non-text content blocks (e.g. tool_use) — this service
    never asks the model to use tools, but stays defensive about it
    rather than assuming content[0] is always a text block.
    """
    content_blocks = data.get("content", [])
    text_parts = [block.get("text", "") for block in content_blocks if block.get("type") == "text"]
    return "".join(text_parts)
