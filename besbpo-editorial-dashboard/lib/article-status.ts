// Mirrors besbpo-blog-cms-api's src/common/enums/article-status.enum.ts —
// deliberately duplicated rather than imported (these are two separate
// Next.js/NestJS apps with no shared package), kept in sync by hand. If
// this drifts from the real enforcement in ArticlesService.transition(),
// the UI might offer a transition button that the API then rejects — not
// dangerous (the API is still the actual enforcement point, this is only
// used to decide which buttons to SHOW), but worth knowing about as a
// real synchronization cost of this duplication.

export type ArticleStatus =
  | 'draft'
  | 'division_review'
  | 'corporate_review'
  | 'scheduled'
  | 'published'
  | 'syndicated'
  | 'archived'
  | 'rejected';

export const ARTICLE_STATUS_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  draft: ['division_review'],
  division_review: ['corporate_review', 'rejected'],
  corporate_review: ['scheduled', 'published', 'rejected'],
  scheduled: ['published'],
  published: ['syndicated', 'archived'],
  syndicated: ['archived'],
  archived: [],
  rejected: ['draft'],
};

export const HUMAN_APPROVAL_REQUIRED_BEFORE: ArticleStatus[] = ['scheduled', 'published'];

export function allowedTransitions(status: ArticleStatus): ArticleStatus[] {
  return ARTICLE_STATUS_TRANSITIONS[status] ?? [];
}

export function statusLabel(status: ArticleStatus): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export type ContentFieldSource = 'human' | 'ai_proposed' | 'human_approved';

export interface ArticleSourceFields {
  excerptSource: ContentFieldSource;
  divisionTagsSource: ContentFieldSource;
  seoMetaSource: ContentFieldSource;
}

/** Field names the human-approval gate blocks scheduled/published on if
 * any of them is still 'ai_proposed' — matches
 * ArticlesService.transition()'s check exactly (same fields, same order
 * of reasoning, deliberately not the same order of appearance since this
 * lists them by field name rather than by entity property order). */
export function unapprovedFields(article: ArticleSourceFields): string[] {
  const fields: string[] = [];
  if (article.excerptSource === 'ai_proposed') fields.push('excerpt');
  if (article.divisionTagsSource === 'ai_proposed') fields.push('divisionTags');
  if (article.seoMetaSource === 'ai_proposed') fields.push('seoMeta');
  return fields;
}

/** Whether transitioning to `nextStatus` would currently be blocked by
 * the human-approval gate — used to disable (not hide) a transition
 * button and explain why, rather than let a click round-trip to the API
 * just to learn the same thing the UI could have told the editor
 * immediately. */
export function blockedByApprovalGate(article: ArticleSourceFields, nextStatus: ArticleStatus): string[] {
  if (!HUMAN_APPROVAL_REQUIRED_BEFORE.includes(nextStatus)) {
    return [];
  }
  return unapprovedFields(article);
}
