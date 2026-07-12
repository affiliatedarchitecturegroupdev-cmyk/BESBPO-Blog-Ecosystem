import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  transitionArticle,
  approveField,
  requestAiProposals,
  uploadMedia,
  getMediaAsset,
  listMedia,
  deleteMedia,
  updateMediaAltText,
} from './cms-api.ts';

// CMS_API_BASE_URL is deliberately left unset throughout this file — these
// tests specifically exercise the fixture-fallback / unconfigured-mutation
// paths, which is exactly the state `npm test` runs in (no live CMS API
// reachable in this environment).

test('listArticles falls back to fixture data when CMS_API_BASE_URL is unset', async () => {
  const result = await listArticles();
  assert.equal(result.source, 'fixture');
  assert.ok(result.articles.length > 0);
});

test('listArticles filters fixture data by status', async () => {
  const result = await listArticles({ status: 'published' });
  assert.equal(result.source, 'fixture');
  assert.ok(result.articles.every((a) => a.status === 'published'));
  assert.ok(result.articles.length > 0, 'expected at least one published fixture article to exist');
});

test('listArticles filters fixture data by division', async () => {
  const result = await listArticles({ division: 'security-services' });
  assert.ok(result.articles.every((a) => a.divisionTags.includes('security-services')));
});

test('listArticles with a division that matches nothing returns an empty list, not an error', async () => {
  const result = await listArticles({ division: 'no-such-division' });
  assert.equal(result.source, 'fixture');
  assert.deepEqual(result.articles, []);
});

test('getArticle returns the matching fixture article by id', async () => {
  const all = await listArticles();
  const targetId = all.articles[0].id;
  const result = await getArticle(targetId);
  assert.equal(result.source, 'fixture');
  assert.equal(result.article?.id, targetId);
});

test('getArticle returns null (not throw) for an id with no match', async () => {
  const result = await getArticle('no-such-id');
  assert.equal(result.article, null);
});

test('createArticle fails clearly (not silently) when CMS_API_BASE_URL is unset', async () => {
  const result = await createArticle({ title: 'Test', slug: 'test' });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /not configured/);
});

test('updateArticle fails clearly when CMS_API_BASE_URL is unset', async () => {
  const result = await updateArticle('a1', { title: 'New title' });
  assert.equal(result.ok, false);
});

test('transitionArticle fails clearly when CMS_API_BASE_URL is unset', async () => {
  const result = await transitionArticle('a1', 'division_review');
  assert.equal(result.ok, false);
});

test('approveField fails clearly when CMS_API_BASE_URL is unset', async () => {
  const result = await approveField('a1', 'excerpt');
  assert.equal(result.ok, false);
});

test('requestAiProposals fails clearly when CMS_API_BASE_URL is unset', async () => {
  const result = await requestAiProposals('a1');
  assert.equal(result.ok, false);
});

test('uploadMedia fails clearly (not silently) when CMS_API_BASE_URL is unset', async () => {
  const formData = new FormData();
  formData.append('file', new Blob(['fake image bytes']), 'test.jpg');
  const result = await uploadMedia(formData);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /not configured/);
});

test('getMediaAsset returns null (not throw) when CMS_API_BASE_URL is unset', async () => {
  const result = await getMediaAsset('some-id');
  assert.equal(result, null);
});

test('listMedia returns an empty page (not throw) when CMS_API_BASE_URL is unset', async () => {
  const result = await listMedia();
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 0);
});

test('listMedia reflects the requested limit/offset in the empty-page fallback', async () => {
  const result = await listMedia(10, 20);
  assert.equal(result.limit, 10);
  assert.equal(result.offset, 20);
});

test('deleteMedia fails clearly (not silently) when CMS_API_BASE_URL is unset', async () => {
  const result = await deleteMedia('some-id');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /not configured/);
});

test('updateMediaAltText fails clearly when CMS_API_BASE_URL is unset', async () => {
  const result = await updateMediaAltText('some-id', 'New alt text');
  assert.equal(result.ok, false);
});
