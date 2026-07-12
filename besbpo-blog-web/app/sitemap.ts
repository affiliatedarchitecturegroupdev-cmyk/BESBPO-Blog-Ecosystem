import { listPublishedArticles, listDivisions, listTags } from '../lib/api';
import { pageNumberParams, ARTICLES_PAGE_SIZE } from '../lib/pagination';

const SITE_URL = 'https://blog.besbpo.co.za';

// Next.js's built-in sitemap convention — works under `output: export`
// (Doc-04 Section 3.1) since it has no per-request dynamic behaviour.
export default async function sitemap() {
  const [articles, divisions, tags] = await Promise.all([
    listPublishedArticles(),
    listDivisions(),
    listTags(),
  ]);

  const articleEntries = articles.map((article) => ({
    url: article.canonical_url,
    lastModified: article.published_at,
  }));

  const divisionEntries = divisions.map((division) => ({
    url: `${SITE_URL}/divisions/${division.key}`,
  }));

  const tagEntries = tags.map((tag) => ({
    url: `${SITE_URL}/tags/${tag}`,
  }));

  const archivePageEntries = pageNumberParams(articles.length, ARTICLES_PAGE_SIZE)
    .filter((p) => p.page !== '1')
    .map((p) => ({ url: `${SITE_URL}/articles/page/${p.page}` }));

  return [{ url: SITE_URL }, ...articleEntries, ...divisionEntries, ...tagEntries, ...archivePageEntries];
}
