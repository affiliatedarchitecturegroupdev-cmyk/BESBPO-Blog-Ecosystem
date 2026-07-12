"""Pure retry-with-exponential-backoff helper, deliberately mirroring
besbpo-blog-cms-api's src/common/retry.ts and besbpo-blog-syndication-svc's
internal/retry/retry.go — same shape (max attempts, doubling base delay,
an is_retryable predicate, an injectable sleep for tests) so the retry
story reads the same way in all three languages this platform uses for
outbound service calls. Used by llm_client.py and embedding_client.py to
retry transient failures calling Anthropic/Voyage AI.

Zero third-party dependencies (asyncio/random/dataclasses/typing only),
so — unlike almost everything else in this service, which needs httpx/
pydantic that aren't installed in the environment this was authored in —
this module was genuinely executed and tested, not just reviewed. See
tests/test_retry.py and the platform root README's verification
methodology note.
"""
from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional, TypeVar

T = TypeVar("T")
SleepFn = Callable[[float], Awaitable[None]]


async def _default_sleep(seconds: float) -> None:
    await asyncio.sleep(seconds)


@dataclass
class RetryOptions:
    max_attempts: int = 3
    base_delay_seconds: float = 0.2
    is_retryable: Optional[Callable[[Exception], bool]] = None
    sleep: Optional[SleepFn] = None


async def with_retry(fn: Callable[[], Awaitable[T]], options: Optional[RetryOptions] = None) -> T:
    """Calls fn up to options.max_attempts times, with exponential backoff
    (plus up to ~30% jitter) between attempts. Stops early on success, on
    a non-retryable exception (per is_retryable), or once max_attempts is
    exhausted — in which case the last exception is re-raised.
    """
    opts = options or RetryOptions()
    max_attempts = opts.max_attempts if opts.max_attempts >= 1 else 1
    sleep = opts.sleep or _default_sleep

    last_exc: Optional[Exception] = None
    for attempt in range(1, max_attempts + 1):
        try:
            return await fn()
        except Exception as exc:  # noqa: BLE001 - intentionally broad; re-raised below if not retried
            last_exc = exc
            attempts_remain = attempt < max_attempts
            retryable = opts.is_retryable is None or opts.is_retryable(exc)
            if not attempts_remain or not retryable:
                raise
            delay = opts.base_delay_seconds * (2 ** (attempt - 1))
            jitter = random.uniform(0, delay * 0.3)
            await sleep(delay + jitter)

    # Unreachable (the loop above always returns or raises), but keeps
    # type checkers satisfied that every path returns T or raises.
    assert last_exc is not None
    raise last_exc


class HttpStatusError(Exception):
    """Carries an HTTP status code so is_retryable callbacks can make a
    status-aware decision (retry 5xx/network errors, don't retry 4xx)
    without re-implementing status extraction at every call site."""

    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def is_retryable_http_error(exc: Exception) -> bool:
    """Retry 5xx and network-level errors (no HttpStatusError at all —
    e.g. a connection failure); don't retry 4xx (a bad request/auth
    failure won't fix itself by trying again)."""
    if isinstance(exc, HttpStatusError):
        return exc.status_code >= 500
    return True
