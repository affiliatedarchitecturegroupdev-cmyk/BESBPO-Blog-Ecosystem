import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRssFeed, escapeXml, toRfc822 } from './rss.ts';

test('escapeXml escapes all five XML special characters', () => {
  assert.equal(escapeXml(`<a href="x">Tom & Jerry's "quote"</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s &quot;quote&quot;&lt;/a&gt;');
});

test('toRfc822 converts an ISO date to a valid RFC 822 date string', () => {
  const result = toRfc822('2026-06-28T06:30:00Z');
  assert.match(result, /^Sun, 28 Jun 2026/);
});

test('buildRssFeed produces well-formed channel metadata and one item per article', () => {
  const xml = buildRssFeed({
    title: 'Besbpo Group Blog',
    description: 'Insight from across Besbpo Group.',
    siteUrl: 'https://blog.besbpo.co.za',
    feedUrl: 'https://blog.besbpo.co.za/feed.xml',
    articles: [
      {
        title: 'Financing Infrastructure',
        excerpt: 'A look at blended finance.',
        canonicalUrl: 'https://blog.besbpo.co.za/articles/financing-infrastructure',
        publishedAt: '2026-06-28T06:30:00Z',
        author: 'Naledi Khumalo',
      },
    ],
  });

  assert.match(xml, /<rss version="2.0">/);
  assert.match(xml, /<title>Besbpo Group Blog<\/title>/);
  assert.equal((xml.match(/<item>/g) || []).length, 1);
  assert.match(xml, /<author>Naledi Khumalo<\/author>/);
});

test('buildRssFeed escapes article content that contains XML-significant characters', () => {
  const xml = buildRssFeed({
    title: 'Feed',
    description: 'Desc',
    siteUrl: 'https://blog.besbpo.co.za',
    feedUrl: 'https://blog.besbpo.co.za/feed.xml',
    articles: [
      {
        title: 'R&D <Notes>',
        excerpt: 'Uses "quotes" & ampersands',
        canonicalUrl: 'https://blog.besbpo.co.za/articles/rd-notes',
        publishedAt: '2026-01-01T00:00:00Z',
      },
    ],
  });

  assert.match(xml, /R&amp;D &lt;Notes&gt;/);
  assert.doesNotMatch(xml, /R&D <Notes>/);
});

test('buildRssFeed omits the author element when no author is given', () => {
  const xml = buildRssFeed({
    title: 'Feed',
    description: 'Desc',
    siteUrl: 'https://blog.besbpo.co.za',
    feedUrl: 'https://blog.besbpo.co.za/feed.xml',
    articles: [
      {
        title: 'Untitled',
        excerpt: 'No author here',
        canonicalUrl: 'https://blog.besbpo.co.za/articles/untitled',
        publishedAt: '2026-01-01T00:00:00Z',
      },
    ],
  });

  assert.doesNotMatch(xml, /<author>/);
});
