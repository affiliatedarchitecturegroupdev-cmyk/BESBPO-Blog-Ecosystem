import Link from 'next/link';
import type { ArticleSummary } from '../lib/api';

// Shared presentation for an article summary — used on the homepage,
// division/tag archive pages, and (indirectly, via the same shape) the
// embed widget's server-rendered fallback markup. The `.stamp` class is the
// signature label treatment from the design system (app/globals.css) —
// subsidiary sites re-theme syndicated content themselves (Doc-02 Section
// 8) rather than inheriting this component's styling.
export function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <article className="article-card">
      <h2>
        <Link href={`/articles/${article.slug}`}>{article.title}</Link>
      </h2>
      <p className="article-card__excerpt">{article.excerpt}</p>
      <div className="article-card__meta">
        <span>{new Date(article.published_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <span>{article.reading_time_minutes} min read</span>
        {article.division_tags.map((division) => (
          <Link key={division} href={`/divisions/${division}`} className="stamp">
            {division}
          </Link>
        ))}
        {(article.tags ?? []).map((tag) => (
          <Link key={tag} href={`/tags/${tag}`} className="stamp">
            #{tag}
          </Link>
        ))}
      </div>
    </article>
  );
}
