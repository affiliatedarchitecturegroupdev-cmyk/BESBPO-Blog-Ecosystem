import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TenantAnalyticsTable } from './TenantAnalyticsTable.tsx';
import { DivisionAnalyticsTable } from './DivisionAnalyticsTable.tsx';
import type { TenantSummary, DivisionSummary } from '../lib/analytics-api.ts';

test('TenantAnalyticsTable renders one row per tenant, sorted by feed_reads descending', () => {
  const tenants: TenantSummary[] = [
    { tenant_id: 't-1', name: 'Low Traffic Co', build_time_dispatches: 0, feed_reads: 10, click_throughs: 1 },
    { tenant_id: 't-2', name: 'High Traffic Co', build_time_dispatches: 0, feed_reads: 500, click_throughs: 50 },
  ];

  const html = renderToStaticMarkup(<TenantAnalyticsTable tenants={tenants} />);

  assert.match(html, /<table/);
  const highIndex = html.indexOf('High Traffic Co');
  const lowIndex = html.indexOf('Low Traffic Co');
  assert.ok(highIndex >= 0 && lowIndex >= 0, 'expected both tenant names to appear');
  assert.ok(highIndex < lowIndex, 'expected the higher-traffic tenant to render first');
});

test('TenantAnalyticsTable shows an empty state with no tenants', () => {
  const html = renderToStaticMarkup(<TenantAnalyticsTable tenants={[]} />);
  assert.match(html, /No tenant activity recorded yet/);
  assert.doesNotMatch(html, /<table/);
});

test('TenantAnalyticsTable renders a computed click-through rate cell', () => {
  const tenants: TenantSummary[] = [
    { tenant_id: 't-1', name: 'Example', build_time_dispatches: 0, feed_reads: 200, click_throughs: 25 },
  ];
  const html = renderToStaticMarkup(<TenantAnalyticsTable tenants={tenants} />);
  assert.match(html, /12\.5%/);
});

test('DivisionAnalyticsTable renders one row per division, sorted by feed_reads descending', () => {
  const divisions: DivisionSummary[] = [
    { division: 'consultancy', published_articles: 1, feed_reads: 5, click_throughs: 0 },
    { division: 'logistics', published_articles: 3, feed_reads: 400, click_throughs: 40 },
  ];

  const html = renderToStaticMarkup(<DivisionAnalyticsTable divisions={divisions} />);

  const logisticsIndex = html.indexOf('logistics');
  const consultancyIndex = html.indexOf('consultancy');
  assert.ok(logisticsIndex >= 0 && consultancyIndex >= 0);
  assert.ok(logisticsIndex < consultancyIndex, 'expected the higher-traffic division to render first');
});

test('DivisionAnalyticsTable shows an empty state with no divisions', () => {
  const html = renderToStaticMarkup(<DivisionAnalyticsTable divisions={[]} />);
  assert.match(html, /No published articles with recorded activity yet/);
});
