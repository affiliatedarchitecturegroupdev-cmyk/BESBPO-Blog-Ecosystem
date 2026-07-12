import { notFound } from 'next/navigation';
import { getArticle, getMediaAsset } from '../../../lib/cms-api.ts';
import { getSessionToken } from '../../../lib/session.ts';
import { ArticleEditor } from '../../../components/ArticleEditor.tsx';

export const dynamic = 'force-dynamic';

interface PageProps {
  // Next.js 14 (see package.json) — params is a plain synchronous object,
  // not a Promise (that's a Next.js 15 change).
  params: { id: string };
}

export default async function ArticleEditPage({ params }: PageProps) {
  const sessionToken = getSessionToken();
  const { article, source, error } = await getArticle(params.id, sessionToken);

  if (!article) {
    notFound();
  }

  // Resolved here (server-side, alongside the article fetch) rather than
  // inside ArticleEditor — that component only ever needs a URL to show,
  // not the ability to resolve one itself. Best-effort: getMediaAsset
  // returns null on any failure, and this page still renders fine
  // without a hero image preview if that happens (see that function's
  // own doc comment for why it degrades rather than throws).
  const heroImage = article.heroImageId ? await getMediaAsset(article.heroImageId, sessionToken) : null;

  return (
    <section>
      {source === 'fixture' && (
        <p className="fixture-banner">
          Showing sample data — CMS_API_BASE_URL is not configured{error ? ` (${error})` : ''}. Saving and
          transitions will not work against fixture data.
        </p>
      )}
      <h1>{article.title}</h1>
      <ArticleEditor article={article} initialHeroImageUrl={heroImage?.url} />
    </section>
  );
}
