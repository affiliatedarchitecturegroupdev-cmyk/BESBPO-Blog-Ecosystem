// Split into one behaviour per file deliberately: Node's test runner
// executes each matched file in its own process when given a glob (`node
// --test test/*.test.ts`), which sidesteps a real constraint of testing a
// self-executing script like embed.ts — it mutates globalThis on import,
// so cross-test isolation is only reliable at the process boundary, not
// just between `test()` blocks in one file. See fake-dom.ts for the shim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement, installFakeBrowserEnvironment } from './fake-dom.ts';
import { sampleFeedPayload, flushMicrotasks } from './fixtures.ts';

test('renders feed items into the container on a successful fetch', async () => {
  const container = new FakeElement('div');
  container.dataset.tenantId = 't-1';
  container.dataset.maxItems = '6';

  const { fakeDocument } = installFakeBrowserEnvironment(async () => ({
    ok: true,
    status: 200,
    json: async () => sampleFeedPayload(),
  }));
  fakeDocument.register(container);

  await import('../src/embed.ts');
  await flushMicrotasks();

  assert.equal(container.children.length, 1);
  const item = container.children[0];
  assert.equal(item.className, 'besbpo-feed__item');
  const [link, excerpt, attribution] = item.children;
  assert.equal(link.tagName, 'A');
  assert.equal(link.href, 'https://blog.besbpo.co.za/articles/sample');
  assert.equal(link.rel, 'canonical');
  assert.equal(link.textContent, 'Sample Article');
  assert.equal(excerpt.textContent, 'An excerpt.');
  assert.equal(attribution.textContent, 'Originally published by Besbpo Group');
});
