// Typed client for besbpo-blog-syndication-svc's analytics endpoint
// (Doc-03 Section 8). Mirrors besbpo-blog-web's lib/api.ts fixture-fallback
// philosophy: if SYNDICATION_API_BASE_URL isn't set, or the request
// fails, fall back to lib/fixtures/analytics-summary.json.
//
// AUTH: fetchAnalyticsSummary takes an optional sessionToken — the real
// per-user JWT (lib/session.ts), resolved by whichever Server Component
// calls in. Deliberately not read directly here via next/headers, so
// this file's pure helper functions stay testable via plain `node --test`
// without needing next/headers mocked (see lib/cms-api.ts's header
// comment for the fuller version of this same reasoning). Falls back to
// SYNDICATION_ADMIN_JWT (the pre-login, shared-secret stand-in) when no
// session token is provided.

import analyticsFixture from './fixtures/analytics-summary.json' with { type: 'json' };

const SYNDICATION_API_BASE_URL = process.env.SYNDICATION_API_BASE_URL;
const SYNDICATION_ADMIN_JWT = process.env.SYNDICATION_ADMIN_JWT;

export interface TenantSummary {
  tenant_id: string;
  name: string;
  build_time_dispatches: number;
  feed_reads: number;
  click_throughs: number;
}

export interface DivisionSummary {
  division: string;
  published_articles: number;
  feed_reads: number;
  click_throughs: number;
}

export interface AnalyticsSummary {
  generated_at: string;
  tenants: TenantSummary[];
  divisions: DivisionSummary[];
}

export interface FetchResult {
  summary: AnalyticsSummary;
  source: 'live' | 'fixture';
}

export async function fetchAnalyticsSummary(sessionToken?: string): Promise<FetchResult> {
  const token = sessionToken ?? SYNDICATION_ADMIN_JWT;
  if (!SYNDICATION_API_BASE_URL || !token) {
    return { summary: analyticsFixture as AnalyticsSummary, source: 'fixture' };
  }

  try {
    const res = await fetch(`${SYNDICATION_API_BASE_URL}/api/v1/analytics/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`analytics summary request failed: ${res.status}`);
    }
    const summary = (await res.json()) as AnalyticsSummary;
    return { summary, source: 'live' };
  } catch (err) {
    console.warn('[analytics-api] falling back to fixture data:', err);
    return { summary: analyticsFixture as AnalyticsSummary, source: 'fixture' };
  }
}

/** Sorts tenants by feed_reads descending — "which subsidiary sites are
 * actually being read" (Doc-03 Section 8's framing) is a read-volume
 * ranking, not an alphabetical listing. Pure — no I/O — so this is unit
 * tested directly (lib/analytics-api.test.ts) rather than only exercised
 * indirectly through a rendered page.
 */
export function sortTenantsByFeedReads(tenants: TenantSummary[]): TenantSummary[] {
  return [...tenants].sort((a, b) => b.feed_reads - a.feed_reads);
}

/** Sorts divisions by feed_reads descending — "which divisions are
 * producing the highest-performing content group-wide" (Doc-03 Section 8).
 */
export function sortDivisionsByFeedReads(divisions: DivisionSummary[]): DivisionSummary[] {
  return [...divisions].sort((a, b) => b.feed_reads - a.feed_reads);
}

/** Click-through rate as a percentage string (e.g. "12.7%"), or "—" when
 * there are no reads to divide by (avoids a NaN/Infinity artifact in the
 * rendered table for a brand-new tenant/division with zero traffic yet).
 */
export function formatClickThroughRate(feedReads: number, clickThroughs: number): string {
  if (feedReads <= 0) {
    return '—';
  }
  return `${((clickThroughs / feedReads) * 100).toFixed(1)}%`;
}
