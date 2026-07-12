import Link from 'next/link';
import { listArticles } from '../../lib/cms-api.ts';
import { getSessionToken } from '../../lib/session.ts';
import { ArticleListTable } from '../../components/ArticleListTable.tsx';
import type { ArticleStatus } from '../../lib/article-status.ts';

export const dynamic = 'force-dynamic';

interface PageProps {
  // Next.js 14 (this platform's version — see package.json) passes
  // searchParams as a plain synchronous object, NOT a Promise — that
  // change landed in Next.js 15. Written for 14 deliberately, not copied
  // from newer docs/examples without checking the actual version pinned
  // here first.
  searchParams: { status?: string; division?: string };
}

export default async function ArticlesPage({ searchParams }: PageProps) {
  const status = searchParams.status as ArticleStatus | undefined;
  const { articles, source } = await listArticles(
    { status, division: searchParams.division },
    getSessionToken(),
  );

  return (
    <section>
      <div className="page-header">
        <h1>Articles</h1>
        <Link href="/articles/new" className="button-link">
          + New article
        </Link>
      </div>

      {source === 'fixture' && (
        <p className="fixture-banner">
          Showing sample data — CMS_API_BASE_URL is not configured or the CMS API is unreachable.
        </p>
      )}

      <ArticleListTable articles={articles} />
    </section>
  );
}
