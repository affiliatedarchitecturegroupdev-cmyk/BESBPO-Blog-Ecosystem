import { fetchAnalyticsSummary } from '../lib/analytics-api';
import { getSessionToken } from '../lib/session.ts';
import { TenantAnalyticsTable } from '../components/TenantAnalyticsTable';
import { DivisionAnalyticsTable } from '../components/DivisionAnalyticsTable';

// Force dynamic rendering — this page fetches live (or fixture) data on
// every request via a server-side admin token; it must never be
// statically cached/prerendered with stale data baked in. This is exactly
// the requirement besbpo-blog-web's app/dashboard/page.tsx placeholder
// flagged as incompatible with `output: 'export'` — this repo exists to
// be the real, server-rendered home for that page instead.
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const { summary, source } = await fetchAnalyticsSummary(getSessionToken());

  return (
    <section>
      {source === 'fixture' && (
        <p className="fixture-banner" role="status">
          Showing sample data — SYNDICATION_API_BASE_URL/SYNDICATION_ADMIN_JWT
          are not configured, or the live request failed. See this app&apos;s
          README for how to connect a real besbpo-blog-syndication-svc instance.
        </p>
      )}

      <p className="generated-at">Generated at {new Date(summary.generated_at).toLocaleString()}</p>

      <h2>By tenant</h2>
      <TenantAnalyticsTable tenants={summary.tenants} />

      <h2>By division</h2>
      <DivisionAnalyticsTable divisions={summary.divisions} />
    </section>
  );
}
