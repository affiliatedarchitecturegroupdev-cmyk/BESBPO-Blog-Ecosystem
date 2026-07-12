import Link from 'next/link';
import { ArticleStatusBadge } from './ArticleStatusBadge.tsx';
import type { Article } from '../lib/cms-api.ts';

export function ArticleListTable({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return <p className="empty-state">No articles match these filters.</p>;
  }

  return (
    <table className="article-table">
      <caption>Articles</caption>
      <thead>
        <tr>
          <th scope="col">Title</th>
          <th scope="col">Status</th>
          <th scope="col">Divisions</th>
          <th scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>
        {articles.map((article) => (
          <tr key={article.id}>
            <td>
              <Link href={`/articles/${article.id}`}>{article.title}</Link>
            </td>
            <td>
              <ArticleStatusBadge status={article.status} />
            </td>
            <td>{article.divisionTags.join(', ') || '—'}</td>
            <td>{new Date(article.updatedAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
