// Package retry implements a small, dependency-free retry-with-exponential-
// backoff helper for outbound calls to other services. Mirrors
// besbpo-blog-cms-api's src/common/retry.ts deliberately — same shape
// (max attempts, base delay that doubles each attempt, an isRetryable
// predicate, an injectable sleep for tests) — so the same retry story
// reads the same way on both sides of the platform. Currently used by
// GitHubDispatcher (internal/webhook/github_dispatcher.go), which closes
// the retry/backoff gap flagged alongside webhooks.service.ts's equivalent
// TODO on the NestJS side.
package retry

import (
	"context"
	"math/rand"
	"time"
)

// SleepFunc is injectable so tests can run a full backoff sequence
// instantly instead of actually waiting — see retry_test.go.
type SleepFunc func(ctx context.Context, d time.Duration) error

func defaultSleep(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

type Options struct {
	// MaxAttempts is the total number of calls, including the first — not
	// additional retries on top of it. Values < 1 are treated as 1.
	MaxAttempts int
	// BaseDelay is the wait before the 2nd attempt; each subsequent delay
	// doubles. Defaults to 200ms if <= 0.
	BaseDelay time.Duration
	// IsRetryable returns false to stop retrying immediately (e.g. a 4xx
	// that a retry can't fix). A nil IsRetryable means always-retryable.
	IsRetryable func(error) bool
	// Sleep is injectable for tests; defaults to a real timer-based sleep
	// that also respects ctx cancellation.
	Sleep SleepFunc
}

// Do calls fn up to Options.MaxAttempts times, applying exponential
// backoff (with jitter) between attempts, stopping early on success, on a
// non-retryable error (per IsRetryable), or if ctx is cancelled during a
// sleep. Returns the last error if every attempt fails.
func Do(ctx context.Context, opts Options, fn func() error) error {
	maxAttempts := opts.MaxAttempts
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	baseDelay := opts.BaseDelay
	if baseDelay <= 0 {
		baseDelay = 200 * time.Millisecond
	}
	sleep := opts.Sleep
	if sleep == nil {
		sleep = defaultSleep
	}

	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		lastErr = fn()
		if lastErr == nil {
			return nil
		}

		attemptsRemain := attempt < maxAttempts
		retryable := opts.IsRetryable == nil || opts.IsRetryable(lastErr)
		if !attemptsRemain || !retryable {
			return lastErr
		}

		delay := baseDelay * time.Duration(int64(1)<<(attempt-1))
		jitter := time.Duration(rand.Int63n(int64(delay)/3 + 1)) // up to ~33% jitter; +1 avoids Int63n(0) panic
		if err := sleep(ctx, delay+jitter); err != nil {
			return err
		}
	}
	return lastErr
}
