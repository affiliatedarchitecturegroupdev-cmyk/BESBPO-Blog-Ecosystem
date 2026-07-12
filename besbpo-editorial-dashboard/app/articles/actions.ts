'use server';

import { revalidatePath } from 'next/cache';
import {
  updateArticle,
  transitionArticle,
  approveField,
  requestAiProposals,
  createArticle,
  uploadMedia,
  listMedia,
  deleteMedia,
  updateMediaAltText,
  type MutationResult,
  type UpdateArticleInput,
  type ApprovableField,
  type CreateArticleInput,
  type UploadResult,
  type PaginatedMediaAssets,
  type DeleteMediaResult,
} from '../../lib/cms-api.ts';
import { getSessionToken } from '../../lib/session.ts';
import type { ArticleStatus } from '../../lib/article-status.ts';

// Server Actions — these run server-side even when invoked from a Client
// Component, which is what keeps the session token (and, for local dev
// without logging in, CMS_API_ADMIN_JWT — both read inside
// lib/cms-api.ts/lib/session.ts) out of the browser entirely.
// getSessionToken() resolves the real per-user JWT from the request's
// HTTP-only cookie; every action below passes it through explicitly
// rather than lib/cms-api.ts reading next/headers itself (see that
// file's header comment for why: it keeps lib/cms-api.ts's own tests
// runnable via plain `node --test` without mocking Next's request
// context). revalidatePath after each successful mutation so the
// (server-rendered) edit page reflects the change on next load without a
// full manual refresh.

export async function updateArticleAction(id: string, input: UpdateArticleInput): Promise<MutationResult> {
  const result = await updateArticle(id, input, getSessionToken());
  if (result.ok) {
    revalidatePath(`/articles/${id}`);
  }
  return result;
}

export async function transitionArticleAction(id: string, status: ArticleStatus): Promise<MutationResult> {
  const result = await transitionArticle(id, status, getSessionToken());
  if (result.ok) {
    revalidatePath(`/articles/${id}`);
    revalidatePath('/articles');
  }
  return result;
}

export async function approveFieldAction(id: string, field: ApprovableField): Promise<MutationResult> {
  const result = await approveField(id, field, getSessionToken());
  if (result.ok) {
    revalidatePath(`/articles/${id}`);
  }
  return result;
}

export async function requestAiProposalsAction(id: string): Promise<MutationResult> {
  const result = await requestAiProposals(id, getSessionToken());
  if (result.ok) {
    revalidatePath(`/articles/${id}`);
  }
  return result;
}

export async function createArticleAction(input: CreateArticleInput): Promise<MutationResult> {
  const result = await createArticle(input, getSessionToken());
  if (result.ok) {
    revalidatePath('/articles');
  }
  return result;
}

export async function uploadMediaAction(formData: FormData): Promise<UploadResult> {
  // No revalidatePath here — uploading a file doesn't change anything any
  // page currently reads from the CMS API (the article isn't updated
  // with the new heroImageId until a subsequent Save; see
  // ArticleEditor.tsx). Revalidating here would be a no-op today, and a
  // slightly misleading one if it were ever read as "the upload is now
  // reflected in the article."
  return uploadMedia(formData, getSessionToken());
}

export async function listMediaAction(limit?: number, offset?: number): Promise<PaginatedMediaAssets> {
  return listMedia(limit, offset, getSessionToken());
}

export async function deleteMediaAction(id: string): Promise<DeleteMediaResult> {
  // No revalidatePath — same reasoning as uploadMediaAction: nothing any
  // currently-rendered page reads is affected by a media delete except
  // the library listing itself, which MediaLibrary re-fetches directly
  // (via listMediaAction) after a successful delete rather than relying
  // on Next.js page-level revalidation.
  return deleteMedia(id, getSessionToken());
}

export async function updateMediaAltTextAction(id: string, altText: string): Promise<UploadResult> {
  return updateMediaAltText(id, altText, getSessionToken());
}
