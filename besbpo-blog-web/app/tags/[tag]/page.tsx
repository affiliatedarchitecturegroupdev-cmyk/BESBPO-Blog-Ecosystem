import { listArticlesByTag, listTags } from '../../../lib/api';
import { ArticleCard } from '../../../components/ArticleCard';

// Required for `output: export` — enumerate every known free-form tag at
// build time (Doc-03 Section 4.2). Distinct from /divisions/[division],
// which enumerates the formal taxonomy (Doc-03 Section 5); tags are
// cross-cutting and CMS-authored, not syndication-routing metadata.
export async function generateStaticParams() {
  const tags = await listTags();
  return tags.map((tag) => ({ tag }));
}

export default async function TagPage({ params }: { params: { tag: string } }) {
  const articles = await listArticlesByTag(params.tag);

  return (
    <section>
      <p className="eyebrow">Tagged</p>
      <h1>#{params.tag}</h1>
      <div className="article-list">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
