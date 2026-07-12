import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement, installFakeBrowserEnvironment } from './fake-dom.ts';
import { sampleFeedPayload, flushMicrotasks } from './fixtures.ts';

test('falls back to a cached feed when a later fetch fails', async () => {
  const container = new FakeElement('div');
  container.dataset.tenantId = 't-3';

  let callCount = 0;
  const { fakeDocument } = installFakeBrowserEnvironment(async () => {
    callCount += 1;
    if (callCount === 1) {
      return { ok: true, status: 200, json: async () => sampleFeedPayload() };
    }
    return { ok: false, status: 503, json: async () => ({}) };
  });
  fakeDocument.register(container);

  // First "page view": successful fetch, populates the localStorage cache.
  await import('../src/embed.ts?first');
  await flushMicrotasks();
  assert.equal(container.children.length, 1, 'expected the first render to succeed');

  // Second "page view": fetch fails, should fall back to the cached
  // response from the first import rather than rendering nothing.
  await import('../src/embed.ts?second');
  await flushMicrotasks();
  assert.equal(container.children.length, 1, 'expected the cache fallback to render the same item');
});
