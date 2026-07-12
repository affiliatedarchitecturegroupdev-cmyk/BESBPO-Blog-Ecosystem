// Pure RSS 2.0 XML builder — no dependency on Next.js request/response
// types, so it can be unit tested in isolation (see rss.test.ts) and reused
// directly by app/feed.xml/route.ts.

export interface RssArticle {
  title: string;
  excerpt: string;
  canonicalUrl: string;
  publishedAt: string; // ISO 8601
  author?: string;
}

export interface RssFeedOptions {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  articles: RssArticle[];
}

export function buildRssFeed(options: RssFeedOptions): string {
  const items = options.articles
    .map(
      (article) => `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(article.canonicalUrl)}</link>
      <guid isPermaLink="true">${escapeXml(article.canonicalUrl)}</guid>
      <description>${escapeXml(article.excerpt)}</description>
      <pubDate>${toRfc822(article.publishedAt)}</pubDate>${
        article.author ? `\n      <author>${escapeXml(article.author)}</author>` : ''
      }
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${escapeXml(options.siteUrl)}</link>
    <description>${escapeXml(options.description)}</description>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(options.feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toRfc822(isoDate: string): string {
  return new Date(isoDate).toUTCString();
}
