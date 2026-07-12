import { withRetry, HttpStatusError, isRetryableHttpError } from './retry';

// Every case here was also verified by genuinely executing it against the
// real implementation (via tsx, outside Jest) before this spec was
// written, since Jest itself isn't installed in the environment this was
// authored in — see the platform root README's verification methodology
// note. This file exists so `npm test` covers it too once dependencies
// are installed, not as a substitute for that earlier real run.
describe('withRetry', () => {
  const instantSleep = async () => {};

  it('returns the result immediately on first success, without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { sleep: instantSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure until the function succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { maxAttempts: 5, sleep: instantSleep });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once maxAttempts is exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, { maxAttempts: 3, sleep: instantSleep })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops immediately when isRetryable returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new HttpStatusError('bad request', 400));
    await expect(
      withRetry(fn, { maxAttempts: 5, sleep: instantSleep, isRetryable: isRetryableHttpError }),
    ).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx HttpStatusError up to maxAttempts', async () => {
    const fn = jest.fn().mockRejectedValue(new HttpStatusError('server error', 503));
    await expect(
      withRetry(fn, { maxAttempts: 3, sleep: instantSleep, isRetryable: isRetryableHttpError }),
    ).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('applies exponential backoff between attempts', async () => {
    const delays: number[] = [];
    const fn = jest.fn().mockRejectedValue(new Error('x'));

    await expect(
      withRetry(fn, {
        maxAttempts: 4,
        baseDelayMs: 10,
        sleep: async (ms: number) => {
          delays.push(ms);
        },
      }),
    ).rejects.toThrow();

    expect(delays[0]).toBeLessThan(delays[1]);
    expect(delays[1]).toBeLessThan(delays[2]);
  });

  it('makes exactly one attempt when maxAttempts is 1', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('x'));
    await expect(withRetry(fn, { maxAttempts: 1, sleep: instantSleep })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rejects a maxAttempts of 0', async () => {
    const fn = jest.fn();
    await expect(withRetry(fn, { maxAttempts: 0 })).rejects.toThrow('maxAttempts must be at least 1');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('isRetryableHttpError', () => {
  it('treats 5xx as retryable', () => {
    expect(isRetryableHttpError(new HttpStatusError('x', 500))).toBe(true);
    expect(isRetryableHttpError(new HttpStatusError('x', 503))).toBe(true);
  });

  it('treats 4xx as not retryable', () => {
    expect(isRetryableHttpError(new HttpStatusError('x', 400))).toBe(false);
    expect(isRetryableHttpError(new HttpStatusError('x', 404))).toBe(false);
  });

  it('treats a plain network error (no status) as retryable', () => {
    expect(isRetryableHttpError(new Error('ECONNREFUSED'))).toBe(true);
  });
});
