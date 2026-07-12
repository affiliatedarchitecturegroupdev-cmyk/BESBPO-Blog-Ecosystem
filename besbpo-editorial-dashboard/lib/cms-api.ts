// Typed client for besbpo-blog-cms-api's articles endpoints, used by the
// Editorial Dashboard's authoring UI. Mirrors lib/analytics-api.ts's
// fixture-fallback philosophy: if CMS_API_BASE_URL isn't set, or a read
// request fails, fall back to lib/fixtures/articles.json — so
// `npm run dev` works out of the box for local design review without a
// live CMS API instance reachable.
//
// AUTH: every function below takes an optional trailing `sessionToken`
// parameter — the real per-user JWT (see lib/session.ts), resolved by
// whichever Server Component/Server Action calls in. Deliberately NOT
// read directly in this file via next/headers: that would give this
// file (and everything that imports it) a hard dependency on Next's
// request context, breaking the plain `node --test` runs this file's
// pure logic is otherwise tested with. Falls back to CMS_API_ADMIN_JWT
// (the pre-login, shared-secret stand-in — see this repo's README) when
// no session token is provided, so local dev without logging in still
// works exactly as it did before real per-user auth existed.
//
// WRITE operations (create/update/transition/approveField/requestAiProposals,
// media upload/delete/altText) do NOT fall back to fixtures — there's
// nothing sensible to fall back TO for a write. If the CMS API is
// unreachable, the mutation genuinely failed and the UI needs to say so,
// not pretend it succeeded against fixture data that would just be
// silently discarded.

import articlesFixture from './fixtures/articles.json' with { type: 'json' };
import type { ArticleStatus, ContentFieldSource } from './article-status.ts';

const CMS_API_BASE_URL = process.env.CMS_API_BASE_URL;
const CMS_API_ADMIN_JWT = process.env.CMS_API_ADMIN_JWT;

export interface Tag {
  id: string;
  name: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  excerptSource: ContentFieldSource;
  bodyMdx: string;
  status: ArticleStatus;
  authorId: string;
  divisionTags: string[];
  divisionTagsSource: ContentFieldSource;
  tags: Tag[];
  seoMeta: Record<string, unknown>;
  seoMetaSource: ContentFieldSource;
  heroImageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListFilters {
  status?: ArticleStatus;
  division?: string;
}

export interface ListResult {
  articles: Article[];
  source: 'live' | 'fixture';
}

export interface ArticleResult {
  article: Article | null;
  source: 'live' | 'fixture';
  error?: string;
}

export interface MutationResult {
  ok: boolean;
  article?: Article;
  error?: string;
}

export type ApprovableField = 'excerpt' | 'divisionTags' | 'seoMeta';

/** The real per-user token (if provided) always wins over the shared
 * stand-in — a logged-in editor's own identity should never be
 * silently downgraded to the generic admin token just because this
 * particular call site forgot to pass one through. */
function requestHeaders(sessionToken?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = sessionToken ?? CMS_API_ADMIN_JWT;
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

function fixtureArticles(): Article[] {
  return articlesFixture as unknown as Article[];
}

function applyFixtureFilters(filters: ListFilters): Article[] {
  let articles = fixtureArticles();
  if (filters.status) {
    articles = articles.filter((a) => a.status === filters.status);
  }
  if (filters.division) {
    articles = articles.filter((a) => a.divisionTags.includes(filters.division as string));
  }
  return articles;
}

export async function listArticles(filters: ListFilters = {}, sessionToken?: string): Promise<ListResult> {
  if (!CMS_API_BASE_URL) {
    return { articles: applyFixtureFilters(filters), source: 'fixture' };
  }

  try {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.division) params.set('division', filters.division);
    const res = await fetch(`${CMS_API_BASE_URL}/articles?${params.toString()}`, {
      headers: requestHeaders(sessionToken),
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`CMS API returned ${res.status}`);
    }
    const articles = (await res.json()) as Article[];
    return { articles, source: 'live' };
  } catch {
    return { articles: applyFixtureFilters(filters), source: 'fixture' };
  }
}

export async function getArticle(id: string, sessionToken?: string): Promise<ArticleResult> {
  if (!CMS_API_BASE_URL) {
    return { article: fixtureArticles().find((a) => a.id === id) ?? null, source: 'fixture' };
  }

  try {
    const res = await fetch(`${CMS_API_BASE_URL}/articles/id/${id}`, {
      headers: requestHeaders(sessionToken),
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`CMS API returned ${res.status}`);
    }
    const article = (await res.json()) as Article;
    return { article, source: 'live' };
  } catch (err) {
    return {
      article: fixtureArticles().find((a) => a.id === id) ?? null,
      source: 'fixture',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function mutate(path: string, method: string, body?: unknown, sessionToken?: string): Promise<MutationResult> {
  if (!CMS_API_BASE_URL) {
    return {
      ok: false,
      error: 'CMS_API_BASE_URL is not configured — cannot perform this action against fixture data.',
    };
  }
  try {
    const res = await fetch(`${CMS_API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders(sessionToken),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `CMS API returned ${res.status}${text ? `: ${text}` : ''}` };
    }
    const article = (await res.json()) as Article;
    return { ok: true, article };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface CreateArticleInput {
  title: string;
  slug: string;
  bodyMdx?: string;
  divisionTags?: string[];
}

export function createArticle(input: CreateArticleInput, sessionToken?: string): Promise<MutationResult> {
  return mutate('/articles', 'POST', input, sessionToken);
}

export interface UpdateArticleInput {
  title?: string;
  excerpt?: string;
  bodyMdx?: string;
  divisionTags?: string[];
  tagNames?: string[];
  seoMeta?: Record<string, unknown>;
  heroImageId?: string | null;
}

export function updateArticle(id: string, input: UpdateArticleInput, sessionToken?: string): Promise<MutationResult> {
  return mutate(`/articles/${id}`, 'PATCH', input, sessionToken);
}

export function transitionArticle(id: string, status: ArticleStatus, sessionToken?: string): Promise<MutationResult> {
  return mutate(`/articles/${id}/transition`, 'PATCH', { status }, sessionToken);
}

export function approveField(id: string, field: ApprovableField, sessionToken?: string): Promise<MutationResult> {
  return mutate(`/articles/${id}/approve/${field}`, 'POST', undefined, sessionToken);
}

export function requestAiProposals(id: string, sessionToken?: string): Promise<MutationResult> {
  return mutate(`/articles/${id}/ai-proposals`, 'POST', undefined, sessionToken);
}

export interface MediaAsset {
  id: string;
  url: string;
  altText?: string;
  /** Resolved URLs for generated size/format variants, keyed by label
   * ("thumbnail", "display") — see besbpo-blog-cms-api's MediaService
   * for what generates them (sharp, WebP output) and when this can
   * still legitimately be {} (variant generation is best-effort; a
   * resize failure degrades to no variants, not a failed upload). */
  variantUrls?: Record<string, string>;
}

export interface UploadResult {
  ok: boolean;
  asset?: MediaAsset;
  error?: string;
}

/**
 * Uploads a file to the CMS API's POST /media (multipart). Deliberately
 * NO fixture fallback — same reasoning as the other mutate() calls above:
 * there's nothing sensible to fall back to for a write, so if
 * CMS_API_BASE_URL isn't configured this fails clearly rather than
 * pretending to succeed.
 */
export async function uploadMedia(formData: FormData, sessionToken?: string): Promise<UploadResult> {
  if (!CMS_API_BASE_URL) {
    return {
      ok: false,
      error: 'CMS_API_BASE_URL is not configured — cannot upload against fixture data.',
    };
  }
  try {
    const headers: Record<string, string> = {};
    const token = sessionToken ?? CMS_API_ADMIN_JWT;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    // Deliberately NOT setting Content-Type here — fetch derives the
    // correct multipart/form-data boundary automatically from a FormData
    // body. Setting it by hand would omit that boundary parameter and
    // break the upload.
    const res = await fetch(`${CMS_API_BASE_URL}/media`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `CMS API returned ${res.status}${text ? `: ${text}` : ''}` };
    }
    const asset = (await res.json()) as MediaAsset;
    return { ok: true, asset };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Resolves a media asset's URL for display — e.g. showing an existing
 * hero image's preview when an edit page loads. Returns null on any
 * failure (missing config, network error, 404) rather than throwing —
 * this is used for an optional preview, not a critical path, so a
 * failure here should degrade to "no preview shown," not break the page.
 */
export async function getMediaAsset(id: string, sessionToken?: string): Promise<MediaAsset | null> {
  if (!CMS_API_BASE_URL) {
    return null;
  }
  try {
    const res = await fetch(`${CMS_API_BASE_URL}/media/${id}`, {
      headers: requestHeaders(sessionToken),
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as MediaAsset;
  } catch {
    return null;
  }
}

export interface PaginatedMediaAssets {
  items: MediaAsset[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * The media library — lets an editor reuse a previously-uploaded image
 * instead of uploading a duplicate. Returns an empty page on any failure
 * (missing config, network error) rather than throwing — the library is
 * a browsing convenience, not a critical path; a failure here should
 * show "nothing to browse," not break the page.
 */
export async function listMedia(limit?: number, offset?: number, sessionToken?: string): Promise<PaginatedMediaAssets> {
  const empty = { items: [], total: 0, limit: limit ?? 24, offset: offset ?? 0 };
  if (!CMS_API_BASE_URL) {
    return empty;
  }
  try {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const res = await fetch(`${CMS_API_BASE_URL}/media?${params.toString()}`, {
      headers: requestHeaders(sessionToken),
      cache: 'no-store',
    });
    if (!res.ok) {
      return empty;
    }
    return (await res.json()) as PaginatedMediaAssets;
  } catch {
    return empty;
  }
}

export interface DeleteMediaResult {
  ok: boolean;
  error?: string;
}

/**
 * Deletes a media asset. NO fixture fallback and NOT best-effort like
 * listMedia/getMediaAsset above — this is a genuine, irreversible write,
 * same reasoning as uploadMedia: if the CMS API is unreachable, the
 * caller needs to know the delete did NOT happen, not have it silently
 * swallowed. The backend itself will refuse (409) to delete an asset
 * still in use as some article's hero image — that comes back as a
 * normal, non-ok result here, not a thrown error, so the UI can show it
 * as a message rather than an unhandled exception.
 */
export async function deleteMedia(id: string, sessionToken?: string): Promise<DeleteMediaResult> {
  if (!CMS_API_BASE_URL) {
    return { ok: false, error: 'CMS_API_BASE_URL is not configured — cannot delete against fixture data.' };
  }
  try {
    const res = await fetch(`${CMS_API_BASE_URL}/media/${id}`, {
      method: 'DELETE',
      headers: requestHeaders(sessionToken),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `CMS API returned ${res.status}${text ? `: ${text}` : ''}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateMediaAltText(id: string, altText: string, sessionToken?: string): Promise<UploadResult> {
  if (!CMS_API_BASE_URL) {
    return { ok: false, error: 'CMS_API_BASE_URL is not configured — cannot update against fixture data.' };
  }
  try {
    const res = await fetch(`${CMS_API_BASE_URL}/media/${id}`, {
      method: 'PATCH',
      headers: requestHeaders(sessionToken),
      body: JSON.stringify({ altText }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `CMS API returned ${res.status}${text ? `: ${text}` : ''}` };
    }
    const asset = (await res.json()) as MediaAsset;
    return { ok: true, asset };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
