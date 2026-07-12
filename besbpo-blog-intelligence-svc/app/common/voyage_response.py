"""Pure parsing of a Voyage AI embeddings API response body. Same
rationale as anthropic_response.py — no httpx dependency, so this is
independently testable in an environment without httpx installed.
"""
from __future__ import annotations


def extract_embedding(data: dict) -> list[float]:
    """Extracts the first embedding vector from a Voyage API response
    body (OpenAI-compatible shape):

        {"data": [{"embedding": [0.1, 0.2, ...], "index": 0}], ...}

    Raises ValueError if the response contains no embedding data — this
    is the "shape was unexpected" case; a non-200 status is handled
    separately, before this function is ever called (see
    embedding_client.py).
    """
    items = data.get("data", [])
    if not items:
        raise ValueError("Voyage API response contained no embedding data")
    return items[0].get("embedding", [])
