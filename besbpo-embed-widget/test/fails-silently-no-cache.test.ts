import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement, installFakeBrowserEnvironment } from './fake-dom.ts';
import { flushMicrotasks } from './fixtures.ts';

test('fails silently (renders nothing) on a fetch error, with no cached fallback available', async () => {
  const container = new FakeElement('div');
  container.dataset.tenantId = 't-2';

  const { fakeDocument } = installFakeBrowserEnvironment(async () => ({
    ok: false,
    status: 500,
    json: async () => ({}),
  }));
  fakeDocument.register(container);

  await import('../src/embed.ts');
  await flushMicrotasks();

  // Doc-02 Section 8: fail silently rather than break the host page.
  assert.equal(container.children.length, 0);
});
