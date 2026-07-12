import { statusLabel, type ArticleStatus } from '../lib/article-status.ts';

const STATUS_COLORS: Record<ArticleStatus, string> = {
  draft: '#6b7280',
  division_review: '#b45309',
  corporate_review: '#b45309',
  scheduled: '#1d4ed8',
  published: '#15803d',
  syndicated: '#15803d',
  archived: '#374151',
  rejected: '#b91c1c',
};

export function ArticleStatusBadge({ status }: { status: ArticleStatus }) {
  const color = STATUS_COLORS[status] ?? '#6b7280';
  return (
    <span
      className="status-badge"
      style={{ backgroundColor: color }}
      data-testid="article-status-badge"
    >
      {statusLabel(status)}
    </span>
  );
}
