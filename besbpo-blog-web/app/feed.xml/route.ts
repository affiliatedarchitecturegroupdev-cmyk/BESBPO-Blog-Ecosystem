import { listPublishedArticles } from '../../lib/api';
import { buildRssFeed } from '../../lib/rss';

// Static route handler — supported under `output: export` (Doc-04 Section
// 3.1) as long as it has no per-request dynamic behaviour, which this
// doesn't: the feed only changes when the site rebuilds on a publish event.
export const dynamic = 'force-static';

const SITE_URL = 'https://blog.besbpo.co.za';

export async function GET() {
  const articles = await listPublishedArticles();

  const xml = buildRssFeed({
    title: 'Besbpo Group Blog',
    description: 'Field notes from across Besbpo Group — built environment, logistics, real estate, and more.',
    siteUrl: SITE_URL,
    feedUrl: `${SITE_URL}/feed.xml`,
    articles: articles.slice(0, 20).map((article) => ({
      title: article.title,
      excerpt: article.excerpt,
      canonicalUrl: article.canonical_url,
      publishedAt: article.published_at,
    })),
  });

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
