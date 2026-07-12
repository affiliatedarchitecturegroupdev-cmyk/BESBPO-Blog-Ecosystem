import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement, installFakeBrowserEnvironment } from './fake-dom.ts';
import { sampleFeedPayload, flushMicrotasks } from './fixtures.ts';

test('sends an impression beacon after rendering, and a click_through beacon on click', async () => {
  const container = new FakeElement('div');
  container.dataset.tenantId = 't-1';

  const calls: Array<{ url: string; body: string }> = [];

  const { fakeDocument } = installFakeBrowserEnvironment(async (url: string, init) => {
    if (url.includes('/analytics/beacon')) {
      calls.push({ url, body: (init && init.body) || '' });
      return { ok: true, status: 202, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => sampleFeedPayload() };
  });
  fakeDocument.register(container);

  await import('../src/embed.ts');
  await flushMicrotasks();

  // One impression beacon fired for the single rendered article.
  const impressionCalls = calls.filter((c) => c.body.includes('"event_type":"impression"'));
  assert.equal(impressionCalls.length, 1, 'expected exactly one impression beacon after render');

  const impressionPayload = JSON.parse(impressionCalls[0].body);
  assert.equal(impressionPayload.tenant_id, 't-1');
  assert.equal(impressionPayload.article_id, 'a-1');
  assert.equal(impressionPayload.event_type, 'impression');

  // No click_through beacon should have fired yet — simulate the click now.
  assert.equal(calls.some((c) => c.body.includes('click_through')), false, 'no click yet, no click_through beacon yet');

  const renderedLink = container.children[0].children[0];
  assert.equal(renderedLink.tagName, 'A');
  renderedLink.simulateClick();
  await flushMicrotasks();

  const clickCalls = calls.filter((c) => c.body.includes('"event_type":"click_through"'));
  assert.equal(clickCalls.length, 1, 'expected exactly one click_through beacon after the simulated click');

  const clickPayload = JSON.parse(clickCalls[0].body);
  assert.equal(clickPayload.tenant_id, 't-1');
  assert.equal(clickPayload.article_id, 'a-1');
});
