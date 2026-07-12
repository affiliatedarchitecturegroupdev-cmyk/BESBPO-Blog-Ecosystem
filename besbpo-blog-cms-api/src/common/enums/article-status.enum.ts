// Content lifecycle state machine. Implements BESBPO-BLOG-ARCH-03 Section 3.
export enum ArticleStatus {
  DRAFT = 'draft',
  DIVISION_REVIEW = 'division_review',
  CORPORATE_REVIEW = 'corporate_review',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  SYNDICATED = 'syndicated',
  ARCHIVED = 'archived',
  REJECTED = 'rejected',
}

// Valid forward transitions. Enforced in ArticlesService.transition().
export const ARTICLE_STATUS_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  [ArticleStatus.DRAFT]: [ArticleStatus.DIVISION_REVIEW],
  [ArticleStatus.DIVISION_REVIEW]: [ArticleStatus.CORPORATE_REVIEW, ArticleStatus.REJECTED],
  [ArticleStatus.CORPORATE_REVIEW]: [ArticleStatus.SCHEDULED, ArticleStatus.PUBLISHED, ArticleStatus.REJECTED],
  [ArticleStatus.SCHEDULED]: [ArticleStatus.PUBLISHED],
  [ArticleStatus.PUBLISHED]: [ArticleStatus.SYNDICATED, ArticleStatus.ARCHIVED],
  [ArticleStatus.SYNDICATED]: [ArticleStatus.ARCHIVED],
  [ArticleStatus.ARCHIVED]: [],
  [ArticleStatus.REJECTED]: [ArticleStatus.DRAFT],
};

// Fields that must not be in an 'ai_proposed' state before this transition is allowed.
// Implements the human-approval gate from Doc-03 Section 6 / Doc-01 Section 9.
export const HUMAN_APPROVAL_REQUIRED_BEFORE: ArticleStatus[] = [
  ArticleStatus.SCHEDULED,
  ArticleStatus.PUBLISHED,
];
