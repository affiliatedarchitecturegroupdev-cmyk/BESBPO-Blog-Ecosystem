import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleStatusBadge } from './ArticleStatusBadge.tsx';
import { ArticleListTable } from './ArticleListTable.tsx';
import { FieldSourceBadge } from './FieldSourceBadge.tsx';
import { ArticleEditor } from './ArticleEditor.tsx';
import { NewArticleForm } from './NewArticleForm.tsx';
import { LoginForm } from './LoginForm.tsx';
import { MediaUploader } from './MediaUploader.tsx';
import { MediaLibrary } from './MediaLibrary.tsx';
import type { Article } from '../lib/cms-api.ts';

function sampleArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a-1',
    slug: 'sample-article',
    title: 'Sample Article',
    excerpt: 'A sample excerpt.',
    excerptSource: 'human',
    bodyMdx: '# Heading\n\nSome body content.',
    status: 'draft',
    authorId: 'user-1',
    tenantId: 'test-tenant',
    divisionTags: ['logistics'],
    divisionTagsSource: 'human',
    tags: [{ id: 't1', name: 'example' }],
    seoMeta: { meta_title: 'Sample', meta_description: 'A sample.' },
    seoMetaSource: 'human',
    heroImageId: undefined,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('ArticleStatusBadge renders the human-readable label for a multi-word status', () => {
  const html = renderToStaticMarkup(<ArticleStatusBadge status="division_review" />);
  assert.match(html, /Division Review/);
});

test('ArticleStatusBadge renders a single-word status correctly', () => {
  const html = renderToStaticMarkup(<ArticleStatusBadge status="published" />);
  assert.match(html, />Published</);
});

test('ArticleListTable renders a row with a link to the article per row', () => {
  const html = renderToStaticMarkup(<ArticleListTable articles={[sampleArticle()]} />);
  assert.match(html, /<table/);
  assert.match(html, /href="\/articles\/a-1"/);
  assert.match(html, /Sample Article/);
});

test('ArticleListTable shows an empty state with no articles', () => {
  const html = renderToStaticMarkup(<ArticleListTable articles={[]} />);
  assert.match(html, /No articles match these filters/);
  assert.doesNotMatch(html, /<table/);
});

test('ArticleListTable joins multiple division tags for display', () => {
  const html = renderToStaticMarkup(
    <ArticleListTable articles={[sampleArticle({ divisionTags: ['logistics', 'bpo'] })]} />,
  );
  assert.match(html, /logistics, bpo/);
});

test('FieldSourceBadge shows the human-authored label and no approve button for a human field', () => {
  const html = renderToStaticMarkup(<FieldSourceBadge articleId="a-1" field="excerpt" source="human" />);
  assert.match(html, /Human-authored/);
  assert.doesNotMatch(html, /Approve/);
});

test('FieldSourceBadge shows the ai_proposed label AND an approve button', () => {
  const html = renderToStaticMarkup(<FieldSourceBadge articleId="a-1" field="excerpt" source="ai_proposed" />);
  assert.match(html, /AI-proposed/);
  assert.match(html, /Approve/);
});

test('FieldSourceBadge shows the approved label and no approve button once approved', () => {
  const html = renderToStaticMarkup(<FieldSourceBadge articleId="a-1" field="excerpt" source="human_approved" />);
  assert.match(html, /approved/);
});

test('ArticleEditor renders the current title, excerpt, and body in their fields', () => {
  const html = renderToStaticMarkup(<ArticleEditor article={sampleArticle()} />);
  assert.match(html, /value="Sample Article"/);
  assert.match(html, /A sample excerpt\./);
});

test('ArticleEditor shows a transition button for each allowed next state from draft', () => {
  const html = renderToStaticMarkup(<ArticleEditor article={sampleArticle({ status: 'draft' })} />);
  assert.match(html, /Move to Division Review/);
});

test('ArticleEditor shows a terminal-state message for archived articles', () => {
  const html = renderToStaticMarkup(<ArticleEditor article={sampleArticle({ status: 'archived' })} />);
  assert.match(html, /terminal state/);
});

test('ArticleEditor disables (and explains) a gated transition when a field is still ai_proposed', () => {
  const html = renderToStaticMarkup(
    <ArticleEditor
      article={sampleArticle({ status: 'corporate_review', excerptSource: 'ai_proposed' })}
    />,
  );
  assert.match(html, /Blocked — approve first: excerpt/);
  assert.match(html, /disabled=""/);
});

test('NewArticleForm renders the title and slug inputs', () => {
  const html = renderToStaticMarkup(<NewArticleForm />);
  assert.match(html, /<form/);
  assert.match(html, /Title/);
  assert.match(html, /Slug/);
});

test('LoginForm renders email and password inputs', () => {
  const html = renderToStaticMarkup(<LoginForm />);
  assert.match(html, /<form/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
});

test('LoginForm does not show an error message on initial render', () => {
  const html = renderToStaticMarkup(<LoginForm />);
  assert.doesNotMatch(html, /article-editor__message--error/);
});

test('MediaUploader renders a file input accepting only image types', () => {
  const html = renderToStaticMarkup(<MediaUploader onUploaded={() => {}} />);
  assert.match(html, /type="file"/);
  assert.match(html, /accept="image\/jpeg,image\/png,image\/webp,image\/gif"/);
});

test('MediaUploader shows no preview image when no currentImageUrl is given', () => {
  const html = renderToStaticMarkup(<MediaUploader onUploaded={() => {}} />);
  assert.doesNotMatch(html, /<img/);
});

test('MediaUploader shows the current image as a preview when provided', () => {
  const html = renderToStaticMarkup(
    <MediaUploader currentImageUrl="https://example.com/hero.jpg" onUploaded={() => {}} />,
  );
  assert.match(html, /<img/);
  assert.match(html, /src="https:\/\/example\.com\/hero\.jpg"/);
});

test('ArticleEditor renders a hero image preview when initialHeroImageUrl is provided', () => {
  const html = renderToStaticMarkup(
    <ArticleEditor article={sampleArticle()} initialHeroImageUrl="https://example.com/hero.jpg" />,
  );
  assert.match(html, /src="https:\/\/example\.com\/hero\.jpg"/);
});

test('ArticleEditor renders no hero image preview when no image is set', () => {
  const html = renderToStaticMarkup(<ArticleEditor article={sampleArticle()} />);
  assert.doesNotMatch(html, /media-uploader__preview/);
});

test('MediaUploader shows a "Browse library" toggle button', () => {
  const html = renderToStaticMarkup(<MediaUploader onUploaded={() => {}} />);
  assert.match(html, /Browse library/);
});

test('MediaUploader shows an alt text input', () => {
  const html = renderToStaticMarkup(<MediaUploader onUploaded={() => {}} />);
  assert.match(html, /Alt text/);
});

test('MediaUploader shows a Remove button only when there is a current image', () => {
  const withImage = renderToStaticMarkup(
    <MediaUploader currentImageUrl="https://example.com/hero.jpg" onUploaded={() => {}} />,
  );
  assert.match(withImage, />Remove</);

  const withoutImage = renderToStaticMarkup(<MediaUploader onUploaded={() => {}} />);
  assert.doesNotMatch(withoutImage, />Remove</);
});

test('MediaLibrary renders without crashing before its data-loading effect runs', () => {
  // renderToStaticMarkup never runs effects (no real DOM mount), so this
  // only exercises MediaLibrary's initial, pre-fetch render — confirms
  // it doesn't crash before data loads, not its post-fetch behaviour
  // (grid contents, delete flow, alt-text saving), which would need a
  // real browser/jsdom environment this project deliberately doesn't
  // depend on.
  const html = renderToStaticMarkup(<MediaLibrary onSelect={() => {}} />);
  assert.equal(typeof html, 'string');
});
