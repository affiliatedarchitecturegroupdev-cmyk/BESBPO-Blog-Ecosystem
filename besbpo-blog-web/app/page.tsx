import { listPublishedArticles } from '../lib/api';
import { paginate, ARTICLES_PAGE_SIZE } from '../lib/pagination';
import { ArticleCard } from '../components/ArticleCard';
import { Pagination } from '../components/Pagination';

// Statically generated at build time (Doc-04 Section 3.1) — a publish event
// in the CMS triggers a rebuild of this page via GitHub Actions, it is not
// fetched client-side. Always renders page 1; pages 2+ live at
// /articles/page/[page] (see that route for why homepage isn't itself a
// dynamic segment).
export default async function HomePage() {
  const articles = await listPublishedArticles();
  const { items, pageInfo } = paginate(articles, ARTICLES_PAGE_SIZE, 1);

  return (
    <section>
      <p className="eyebrow">Field notes from across the group</p>
      <h1>Besbpo Group Blog</h1>
      <div className="article-list">
        {items.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      <Pagination pageInfo={pageInfo} hrefForPage={(n) => (n === 1 ? '/' : `/articles/page/${n}`)} />
    </section>
  );
}
