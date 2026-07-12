import { sortTenantsByFeedReads, formatClickThroughRate } from '../lib/analytics-api';
import type { TenantSummary } from '../lib/analytics-api';

export function TenantAnalyticsTable({ tenants }: { tenants: TenantSummary[] }) {
  const sorted = sortTenantsByFeedReads(tenants);

  if (sorted.length === 0) {
    return <p className="empty-state">No tenant activity recorded yet.</p>;
  }

  return (
    <table className="analytics-table">
      <caption>Which subsidiary sites are actually being read (Doc-03 Section 8)</caption>
      <thead>
        <tr>
          <th scope="col">Tenant</th>
          <th scope="col">Feed reads</th>
          <th scope="col">Click-throughs</th>
          <th scope="col">Click-through rate</th>
          <th scope="col">Build-time dispatches</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((tenant) => (
          <tr key={tenant.tenant_id}>
            <td>{tenant.name}</td>
            <td>{tenant.feed_reads.toLocaleString()}</td>
            <td>{tenant.click_throughs.toLocaleString()}</td>
            <td>{formatClickThroughRate(tenant.feed_reads, tenant.click_throughs)}</td>
            <td>{tenant.build_time_dispatches.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
