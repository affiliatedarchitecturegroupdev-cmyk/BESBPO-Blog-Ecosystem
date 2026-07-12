import { notFound } from 'next/navigation';
import { listPublishedArticles } from '../../../../lib/api';
import { paginate, pageNumberParams, ARTICLES_PAGE_SIZE } from '../../../../lib/pagination';
import { ArticleCard } from '../../../../components/ArticleCard';
import { Pagination } from '../../../../components/Pagination';

// Page 1 is served at `/` (see app/page.tsx) to avoid the same article list
// existing at two canonical URLs. This route only generates pages 2 and up.
export async function generateStaticParams() {
  const articles = await listPublishedArticles();
  return pageNumberParams(articles.length, ARTICLES_PAGE_SIZE).filter((p) => p.page !== '1');
}

export default async function ArticlesArchivePage({ params }: { params: { page: string } }) {
  const pageNumber = Number(params.page);
  if (!Number.isInteger(pageNumber) || pageNumber < 2) {
    notFound();
  }

  const articles = await listPublishedArticles();
  const { items, pageInfo } = paginate(articles, ARTICLES_PAGE_SIZE, pageNumber);

  if (items.length === 0) {
    notFound();
  }

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
