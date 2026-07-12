"""Thin async wrapper around Anthropic's Messages API
(POST https://api.anthropic.com/v1/messages), used by the tagging, SEO,
and summarisation services to get a real LLM proposal instead of the
Phase 0 deterministic heuristic.

Deliberately thin: response parsing lives in anthropic_response.py (a
pure module with no httpx dependency, so it's independently testable —
see tests/test_llm_client.py). The HTTP plumbing in this file (the actual
network call) could not be executed in the environment this was authored
in (no httpx installed, no network) — see the platform root README's
verification methodology note.
"""
from __future__ import annotations

import httpx

from app.common.anthropic_response import extract_text
from app.common.retry import HttpStatusError, RetryOptions, is_retryable_http_error, with_retry

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class LLMClient:
    def __init__(self, api_key: str, model: str, timeout_seconds: float = 15.0):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    async def generate_text(self, prompt: str, max_tokens: int = 1024) -> str:
        """Sends `prompt` as a single user message and returns the
        concatenated text content of the response. Retries transient
        failures (network errors, 5xx) up to 3 times; a 4xx (bad request,
        auth failure) is not retried.
        """

        async def attempt() -> str:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    ANTHROPIC_API_URL,
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": ANTHROPIC_VERSION,
                        "content-type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "max_tokens": max_tokens,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                if response.status_code != 200:
                    raise HttpStatusError(
                        f"Anthropic API returned {response.status_code}: {response.text[:200]}",
                        response.status_code,
                    )
                return extract_text(response.json())

        return await with_retry(
            attempt,
            RetryOptions(max_attempts=3, base_delay_seconds=0.5, is_retryable=is_retryable_http_error),
        )
