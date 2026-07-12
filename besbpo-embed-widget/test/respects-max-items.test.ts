import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement, installFakeBrowserEnvironment } from './fake-dom.ts';
import { sampleFeedPayload, flushMicrotasks } from './fixtures.ts';

test('respects data-max-items when requesting the feed', async () => {
  const container = new FakeElement('div');
  container.dataset.tenantId = 't-4';
  container.dataset.maxItems = '2';

  let requestedUrl = '';
  const { fakeDocument } = installFakeBrowserEnvironment(async (url: string) => {
    requestedUrl = url;
    return { ok: true, status: 200, json: async () => sampleFeedPayload({ articles: [] }) };
  });
  fakeDocument.register(container);

  await import('../src/embed.ts');
  await flushMicrotasks();

  assert.match(requestedUrl, /max_items=2/);
  assert.match(requestedUrl, /\/feed\/t-4\?/);
});
