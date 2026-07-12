"""Thin async wrapper around Voyage AI's embeddings API
(POST https://api.voyageai.com/v1/embeddings) — Anthropic's recommended
embeddings partner, since Claude has no first-party embeddings API (see
besbpo-blog-architecture/adr/0004-voyage-embeddings-1024-dimensions.md).

Same design as llm_client.py: response parsing lives in
voyage_response.py (a pure module with no httpx dependency, independently
testable). The HTTP plumbing here could not be executed in the
environment this was authored in — see the platform root README's
verification methodology note.
"""
from __future__ import annotations

import httpx

from app.common.retry import HttpStatusError, RetryOptions, is_retryable_http_error, with_retry
from app.common.voyage_response import extract_embedding

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"


class EmbeddingClient:
    def __init__(self, api_key: str, model: str, output_dimension: int, timeout_seconds: float = 15.0):
        self.api_key = api_key
        self.model = model
        self.output_dimension = output_dimension
        self.timeout_seconds = timeout_seconds

    async def embed(self, text: str, input_type: str = "document") -> list[float]:
        """Returns a single embedding vector for `text`. `input_type`
        should be "document" when embedding article content for storage,
        or "query" when embedding a search query — Voyage prepends a
        different retrieval-tuning prefix internally for each (see
        Voyage's docs on input_type; this wrapper just passes it through).
        Retries transient failures up to 3 times; a 4xx is not retried.
        """

        async def attempt() -> list[float]:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    VOYAGE_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "input": [text],
                        "model": self.model,
                        "input_type": input_type,
                        "output_dimension": self.output_dimension,
                    },
                )
                if response.status_code != 200:
                    raise HttpStatusError(
                        f"Voyage API returned {response.status_code}: {response.text[:200]}",
                        response.status_code,
                    )
                return extract_embedding(response.json())

        return await with_retry(
            attempt,
            RetryOptions(max_attempts=3, base_delay_seconds=0.5, is_retryable=is_retryable_http_error),
        )
