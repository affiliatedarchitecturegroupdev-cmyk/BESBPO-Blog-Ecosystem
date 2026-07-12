"""Executable tests for app.common.retry — uses stdlib unittest
deliberately (not pytest, which isn't installed in the environment this
was authored in) specifically so these can be genuinely run:

    python3 -m unittest tests.test_retry -v

Every case here mirrors one already verified for real in the TypeScript
(besbpo-blog-cms-api/src/common/retry.spec.ts) and reviewed-but-untested
Go (besbpo-blog-syndication-svc/internal/retry/retry_test.go) equivalents.
"""
import asyncio
import unittest

from app.common.retry import HttpStatusError, RetryOptions, is_retryable_http_error, with_retry


async def instant_sleep(_seconds: float) -> None:
    return None


class WithRetryTests(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_succeeds_immediately_without_retrying(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            return "ok"

        result = self.run_async(with_retry(fn, RetryOptions(sleep=instant_sleep)))
        self.assertEqual(result, "ok")
        self.assertEqual(calls, 1)

    def test_retries_until_success(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            if calls < 3:
                raise RuntimeError("transient")
            return "recovered"

        result = self.run_async(with_retry(fn, RetryOptions(max_attempts=5, sleep=instant_sleep)))
        self.assertEqual(result, "recovered")
        self.assertEqual(calls, 3)

    def test_exhausts_max_attempts_then_raises_last_error(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            raise RuntimeError("always fails")

        with self.assertRaises(RuntimeError) as ctx:
            self.run_async(with_retry(fn, RetryOptions(max_attempts=3, sleep=instant_sleep)))
        self.assertEqual(str(ctx.exception), "always fails")
        self.assertEqual(calls, 3)

    def test_stops_immediately_when_not_retryable(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            raise HttpStatusError("bad request", 400)

        with self.assertRaises(HttpStatusError):
            self.run_async(
                with_retry(
                    fn,
                    RetryOptions(max_attempts=5, sleep=instant_sleep, is_retryable=is_retryable_http_error),
                )
            )
        self.assertEqual(calls, 1)

    def test_retries_a_5xx_up_to_max_attempts(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            raise HttpStatusError("server error", 503)

        with self.assertRaises(HttpStatusError):
            self.run_async(
                with_retry(
                    fn,
                    RetryOptions(max_attempts=3, sleep=instant_sleep, is_retryable=is_retryable_http_error),
                )
            )
        self.assertEqual(calls, 3)

    def test_backoff_delays_increase(self):
        delays = []

        async def recording_sleep(seconds: float) -> None:
            delays.append(seconds)

        async def fn():
            raise RuntimeError("x")

        with self.assertRaises(RuntimeError):
            self.run_async(
                with_retry(
                    fn,
                    RetryOptions(max_attempts=4, base_delay_seconds=0.01, sleep=recording_sleep),
                )
            )

        self.assertEqual(len(delays), 3)
        self.assertLess(delays[0], delays[1])
        self.assertLess(delays[1], delays[2])

    def test_max_attempts_one_means_no_retries(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            raise RuntimeError("x")

        with self.assertRaises(RuntimeError):
            self.run_async(with_retry(fn, RetryOptions(max_attempts=1, sleep=instant_sleep)))
        self.assertEqual(calls, 1)

    def test_max_attempts_below_one_treated_as_one(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            raise RuntimeError("x")

        with self.assertRaises(RuntimeError):
            self.run_async(with_retry(fn, RetryOptions(max_attempts=0, sleep=instant_sleep)))
        self.assertEqual(calls, 1)


class IsRetryableHttpErrorTests(unittest.TestCase):
    def test_5xx_is_retryable(self):
        self.assertTrue(is_retryable_http_error(HttpStatusError("x", 500)))
        self.assertTrue(is_retryable_http_error(HttpStatusError("x", 503)))

    def test_4xx_is_not_retryable(self):
        self.assertFalse(is_retryable_http_error(HttpStatusError("x", 400)))
        self.assertFalse(is_retryable_http_error(HttpStatusError("x", 404)))

    def test_plain_network_error_is_retryable(self):
        self.assertTrue(is_retryable_http_error(ConnectionError("ECONNREFUSED")))


if __name__ == "__main__":
    unittest.main()
