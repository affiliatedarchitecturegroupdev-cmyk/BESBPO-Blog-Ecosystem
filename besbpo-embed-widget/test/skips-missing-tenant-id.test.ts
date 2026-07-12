import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement, installFakeBrowserEnvironment } from './fake-dom.ts';
import { sampleFeedPayload, flushMicrotasks } from './fixtures.ts';

test('skips a container that has no data-tenant-id, without throwing', async () => {
  const container = new FakeElement('div');
  // deliberately no dataset.tenantId set

  let fetchCalled = false;
  const { fakeDocument } = installFakeBrowserEnvironment(async () => {
    fetchCalled = true;
    return { ok: true, status: 200, json: async () => sampleFeedPayload() };
  });
  fakeDocument.register(container);

  await import('../src/embed.ts');
  await flushMicrotasks();

  assert.equal(fetchCalled, false);
  assert.equal(container.children.length, 0);
});
