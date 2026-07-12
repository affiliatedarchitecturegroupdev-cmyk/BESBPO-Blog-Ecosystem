import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAnalyticsSummary,
  sortTenantsByFeedReads,
  sortDivisionsByFeedReads,
  formatClickThroughRate,
  type TenantSummary,
  type DivisionSummary,
} from './analytics-api.ts';

test('sortTenantsByFeedReads orders by feed_reads descending', () => {
  const tenants: TenantSummary[] = [
    { tenant_id: 't-1', name: 'Low', build_time_dispatches: 0, feed_reads: 10, click_throughs: 1 },
    { tenant_id: 't-2', name: 'High', build_time_dispatches: 0, feed_reads: 100, click_throughs: 5 },
    { tenant_id: 't-3', name: 'Mid', build_time_dispatches: 0, feed_reads: 50, click_throughs: 2 },
  ];
  const sorted = sortTenantsByFeedReads(tenants);
  assert.deepEqual(sorted.map((t) => t.name), ['High', 'Mid', 'Low']);
});

test('sortTenantsByFeedReads does not mutate the input array', () => {
  const tenants: TenantSummary[] = [
    { tenant_id: 't-1', name: 'A', build_time_dispatches: 0, feed_reads: 1, click_throughs: 0 },
    { tenant_id: 't-2', name: 'B', build_time_dispatches: 0, feed_reads: 2, click_throughs: 0 },
  ];
  const original = [...tenants];
  sortTenantsByFeedReads(tenants);
  assert.deepEqual(tenants, original);
});

test('sortDivisionsByFeedReads orders by feed_reads descending', () => {
  const divisions: DivisionSummary[] = [
    { division: 'low', published_articles: 1, feed_reads: 5, click_throughs: 0 },
    { division: 'high', published_articles: 1, feed_reads: 500, click_throughs: 10 },
  ];
  const sorted = sortDivisionsByFeedReads(divisions);
  assert.deepEqual(sorted.map((d) => d.division), ['high', 'low']);
});

test('formatClickThroughRate computes a percentage to one decimal place', () => {
  assert.equal(formatClickThroughRate(200, 25), '12.5%');
});

test('formatClickThroughRate returns an em dash for zero reads, not NaN/Infinity', () => {
  assert.equal(formatClickThroughRate(0, 0), '—');
});

test('formatClickThroughRate handles a 100% rate', () => {
  assert.equal(formatClickThroughRate(10, 10), '100.0%');
});

test('fetchAnalyticsSummary falls back to fixture data when env vars are unset', async () => {
  // SYNDICATION_API_BASE_URL/SYNDICATION_ADMIN_JWT are not set in this test
  // environment, so this exercises the fixture-fallback path for real —
  // no fetch mocking needed for this specific case.
  const result = await fetchAnalyticsSummary();
  assert.equal(result.source, 'fixture');
  assert.ok(result.summary.tenants.length > 0, 'expected the fixture to have at least one tenant');
  assert.ok(result.summary.divisions.length > 0, 'expected the fixture to have at least one division');
});
