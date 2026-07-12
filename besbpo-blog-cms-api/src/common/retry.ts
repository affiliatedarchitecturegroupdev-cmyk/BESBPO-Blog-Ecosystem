// Pure retry-with-exponential-backoff helper. Deliberately has no NestJS
// dependencies (no decorators, no DI) so it can be unit tested in complete
// isolation and reused anywhere in this codebase that makes an outbound
// call to another service — currently WebhooksService, which closes the
// PHASE 4 TODO it used to carry ("add retry/backoff here").
export interface RetryOptions {
  /** Total attempts, including the first — not additional retries on top of it. */
  maxAttempts?: number;
  /** Delay before the 2nd attempt; each subsequent delay doubles. */
  baseDelayMs?: number;
  /** Return false to stop retrying immediately (e.g. a 4xx that a retry can't fix). Defaults to always-retryable. */
  isRetryable?: (error: unknown) => boolean;
  /** Injectable for tests — defaults to a real setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 200, isRetryable = () => true, sleep = defaultSleep } = options;

  if (maxAttempts < 1) {
    throw new Error('maxAttempts must be at least 1');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const attemptsRemain = attempt < maxAttempts;
      if (!attemptsRemain || !isRetryable(err)) {
        throw err;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * delay * 0.3;
      await sleep(delay + jitter);
    }
  }
  // Unreachable given the loop above always returns or throws, but keeps
  // the compiler satisfied that every path returns or throws.
  throw lastError;
}

/**
 * A tagged error carrying an HTTP status code, so isRetryable callbacks can
 * make a status-aware decision (retry 5xx/network errors, don't retry 4xx)
 * without every caller re-implementing the same status-extraction logic.
 */
export class HttpStatusError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

/** Retry network errors and 5xx; don't retry 4xx (retrying won't fix a bad request/auth/payload). */
export function isRetryableHttpError(err: unknown): boolean {
  if (err instanceof HttpStatusError) {
    return err.status >= 500;
  }
  return true; // no status = a network-level failure (fetch threw), treat as retryable
}
