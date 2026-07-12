import { sortDivisionsByFeedReads, formatClickThroughRate } from '../lib/analytics-api';
import type { DivisionSummary } from '../lib/analytics-api';

export function DivisionAnalyticsTable({ divisions }: { divisions: DivisionSummary[] }) {
  const sorted = sortDivisionsByFeedReads(divisions);

  if (sorted.length === 0) {
    return <p className="empty-state">No published articles with recorded activity yet.</p>;
  }

  return (
    <table className="analytics-table">
      <caption>Which divisions are producing the highest-performing content group-wide (Doc-03 Section 8)</caption>
      <thead>
        <tr>
          <th scope="col">Division</th>
          <th scope="col">Published articles</th>
          <th scope="col">Feed reads</th>
          <th scope="col">Click-throughs</th>
          <th scope="col">Click-through rate</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((division) => (
          <tr key={division.division}>
            <td>{division.division}</td>
            <td>{division.published_articles.toLocaleString()}</td>
            <td>{division.feed_reads.toLocaleString()}</td>
            <td>{division.click_throughs.toLocaleString()}</td>
            <td>{formatClickThroughRate(division.feed_reads, division.click_throughs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
