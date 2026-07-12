// Real component-output tests — not just type-checks. Rendered via
// react-dom/server's renderToStaticMarkup, with next/link and
// next/navigation aliased to lightweight test-mocks (see
// tsconfig.test.json) so these run without the full Next.js runtime.
//
// Run with: npm run test:components
// (Uses `tsx`, a devDependency added specifically for this — separate from
// `npm test`, which runs the framework-free lib/*.test.ts suite via Node's
// native test runner with zero devDependencies at all.)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleCard } from './ArticleCard.tsx';
import { Pagination } from './Pagination.tsx';
import { SiteFooter } from './Footer.tsx';
import { SiteHeader } from './Header.tsx';
import { paginate } from '../lib/pagination.ts';
import type { ArticleSummary } from '../lib/api.ts';

const sampleArticle: ArticleSummary = {
  id: 'a-1',
  slug: 'sample-article',
  title: 'Sample Article Title',
  excerpt: 'A short excerpt for testing.',
  canonical_url: 'https://blog.besbpo.co.za/articles/sample-article',
  division_tags: ['logistics', 'bpo'],
  tags: ['case-study'],
  published_at: '2026-06-01T00:00:00Z',
  reading_time_minutes: 5,
};

test('ArticleCard renders the title as a link to the article slug', () => {
  const html = renderToStaticMarkup(<ArticleCard article={sampleArticle} />);
  assert.match(html, /href="\/articles\/sample-article"/);
  assert.match(html, /Sample Article Title/);
});

test('ArticleCard renders one stamp per division tag and per free-form tag', () => {
  const html = renderToStaticMarkup(<ArticleCard article={sampleArticle} />);
  const stampCount = (html.match(/class="stamp"/g) || []).length;
  // 2 division tags + 1 free-form tag = 3 stamps
  assert.equal(stampCount, 3);
  assert.match(html, /href="\/divisions\/logistics"/);
  assert.match(html, /href="\/tags\/case-study"/);
});

test('ArticleCard formats the reading time into the meta line', () => {
  const html = renderToStaticMarkup(<ArticleCard article={sampleArticle} />);
  assert.match(html, /5 min read/);
});

test('Pagination renders nothing when there is only one page', () => {
  const { pageInfo } = paginate([1, 2, 3], 10, 1);
  const html = renderToStaticMarkup(<Pagination pageInfo={pageInfo} hrefForPage={(n) => `/page/${n}`} />);
  assert.equal(html, ''); // component returns null for a single-page result set
});

test('Pagination renders both links when on a middle page', () => {
  const { pageInfo } = paginate(Array.from({ length: 20 }), 5, 2);
  const html = renderToStaticMarkup(<Pagination pageInfo={pageInfo} hrefForPage={(n) => `/articles/page/${n}`} />);
  assert.match(html, /href="\/articles\/page\/1"/); // newer
  assert.match(html, /href="\/articles\/page\/3"/); // older
  assert.match(html, /Page 2 of 4/);
});

test('Pagination disables the "newer" link on the first page', () => {
  const { pageInfo } = paginate(Array.from({ length: 20 }), 5, 1);
  const html = renderToStaticMarkup(<Pagination pageInfo={pageInfo} hrefForPage={(n) => `/articles/page/${n}`} />);
  assert.match(html, /pagination__disabled">.*Newer/s);
  assert.match(html, /href="\/articles\/page\/2"/); // older still a link
});

test('Pagination disables the "older" link on the last page', () => {
  const { pageInfo } = paginate(Array.from({ length: 20 }), 5, 4);
  const html = renderToStaticMarkup(<Pagination pageInfo={pageInfo} hrefForPage={(n) => `/articles/page/${n}`} />);
  assert.match(html, /pagination__disabled">.*Older/s);
});

test('SiteFooter includes the RSS link and current year', () => {
  const html = renderToStaticMarkup(<SiteFooter />);
  assert.match(html, /href="\/feed\.xml"/);
  assert.match(html, new RegExp(String(new Date().getFullYear())));
});

test('SiteHeader (async server component) resolves via the fixture fallback and renders division nav links', async () => {
  // No CMS_API_BASE_URL is set in this test environment, so this exercises
  // the real fixture-fallback path in lib/api.ts end to end — not a mock.
  const element = await SiteHeader();
  const html = renderToStaticMarkup(element);
  assert.match(html, /Besbpo Group/);
  assert.match(html, /href="\/divisions\/built-environment"/);
});

test('SiteHeader caps the visible nav to 6 divisions even though 11 exist in fixtures', async () => {
  const element = await SiteHeader();
  const html = renderToStaticMarkup(element);
  const divisionLinkCount = (html.match(/href="\/divisions\//g) || []).length;
  assert.equal(divisionLinkCount, 6);
});
