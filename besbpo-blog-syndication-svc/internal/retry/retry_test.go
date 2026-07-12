package retry

import (
	"context"
	"errors"
	"testing"
	"time"
)

func instantSleep(_ context.Context, _ time.Duration) error { return nil }

func TestDo_SucceedsImmediatelyWithoutRetrying(t *testing.T) {
	calls := 0
	err := Do(context.Background(), Options{Sleep: instantSleep}, func() error {
		calls++
		return nil
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if calls != 1 {
		t.Fatalf("expected exactly 1 call, got %d", calls)
	}
}

func TestDo_RetriesUntilSuccess(t *testing.T) {
	calls := 0
	err := Do(context.Background(), Options{MaxAttempts: 5, Sleep: instantSleep}, func() error {
		calls++
		if calls < 3 {
			return errors.New("transient")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("expected eventual success, got %v", err)
	}
	if calls != 3 {
		t.Fatalf("expected exactly 3 calls, got %d", calls)
	}
}

func TestDo_ExhaustsMaxAttemptsThenReturnsLastError(t *testing.T) {
	calls := 0
	wantErr := errors.New("always fails")
	err := Do(context.Background(), Options{MaxAttempts: 3, Sleep: instantSleep}, func() error {
		calls++
		return wantErr
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected the last error to be returned, got %v", err)
	}
	if calls != 3 {
		t.Fatalf("expected exactly 3 calls, got %d", calls)
	}
}

func TestDo_StopsImmediatelyWhenNotRetryable(t *testing.T) {
	calls := 0
	err := Do(context.Background(), Options{
		MaxAttempts: 5,
		Sleep:       instantSleep,
		IsRetryable: func(error) bool { return false },
	}, func() error {
		calls++
		return errors.New("non-retryable")
	})
	if err == nil {
		t.Fatal("expected an error")
	}
	if calls != 1 {
		t.Fatalf("expected exactly 1 call (no retries), got %d", calls)
	}
}

func TestDo_RetriesWhenRetryablePredicateReturnsTrue(t *testing.T) {
	calls := 0
	err := Do(context.Background(), Options{
		MaxAttempts: 3,
		Sleep:       instantSleep,
		IsRetryable: func(error) bool { return true },
	}, func() error {
		calls++
		return errors.New("retryable")
	})
	if err == nil {
		t.Fatal("expected an error after exhausting attempts")
	}
	if calls != 3 {
		t.Fatalf("expected exactly 3 calls, got %d", calls)
	}
}

func TestDo_BackoffDelaysIncrease(t *testing.T) {
	var delays []time.Duration
	calls := 0
	_ = Do(context.Background(), Options{
		MaxAttempts: 4,
		BaseDelay:   10 * time.Millisecond,
		Sleep: func(_ context.Context, d time.Duration) error {
			delays = append(delays, d)
			return nil
		},
	}, func() error {
		calls++
		return errors.New("x")
	})

	if len(delays) != 3 { // 4 attempts -> 3 inter-attempt sleeps
		t.Fatalf("expected 3 recorded delays, got %d", len(delays))
	}
	if !(delays[0] < delays[1] && delays[1] < delays[2]) {
		t.Fatalf("expected strictly increasing delays, got %v", delays)
	}
}

func TestDo_MaxAttemptsOneMeansNoRetries(t *testing.T) {
	calls := 0
	err := Do(context.Background(), Options{MaxAttempts: 1, Sleep: instantSleep}, func() error {
		calls++
		return errors.New("x")
	})
	if err == nil {
		t.Fatal("expected an error")
	}
	if calls != 1 {
		t.Fatalf("expected exactly 1 call, got %d", calls)
	}
}

func TestDo_MaxAttemptsBelowOneTreatedAsOne(t *testing.T) {
	calls := 0
	_ = Do(context.Background(), Options{MaxAttempts: 0, Sleep: instantSleep}, func() error {
		calls++
		return errors.New("x")
	})
	if calls != 1 {
		t.Fatalf("expected MaxAttempts<1 to behave like MaxAttempts=1 (1 call), got %d", calls)
	}
}

func TestDo_StopsWhenContextCancelledDuringSleep(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0

	err := Do(ctx, Options{
		MaxAttempts: 5,
		Sleep: func(ctx context.Context, _ time.Duration) error {
			cancel() // simulate cancellation happening while "sleeping"
			return ctx.Err()
		},
	}, func() error {
		calls++
		return errors.New("retryable")
	})

	if err == nil {
		t.Fatal("expected an error when context is cancelled during backoff")
	}
	if calls != 1 {
		t.Fatalf("expected exactly 1 call before cancellation stopped further retries, got %d", calls)
	}
}
