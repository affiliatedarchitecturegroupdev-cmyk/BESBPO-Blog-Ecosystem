'use client';

import { useState, useTransition, type ChangeEvent } from 'react';
import { FieldSourceBadge } from './FieldSourceBadge.tsx';
import { ArticleStatusBadge } from './ArticleStatusBadge.tsx';
import { MediaUploader } from './MediaUploader.tsx';
import { allowedTransitions, statusLabel, blockedByApprovalGate, type ArticleStatus } from '../lib/article-status.ts';
import type { Article } from '../lib/cms-api.ts';
import {
  updateArticleAction,
  transitionArticleAction,
  requestAiProposalsAction,
} from '../app/articles/actions.ts';

/**
 * The core authoring/review UI (Doc-03 Section 6). A single article's
 * title/excerpt/body/divisions/tags/SEO fields, each showing its
 * provenance via FieldSourceBadge, plus:
 *  - "Get AI Suggestions", which requests fresh proposals for excerpt,
 *    division tags, and SEO meta all at once and fills them in (marked
 *    ai_proposed) without touching anything the editor already wrote.
 *  - Status transition buttons for whichever next states are currently
 *    valid — each one shows WHY it's disabled (via blockedByApprovalGate)
 *    rather than just being greyed out with no explanation, so an editor
 *    isn't left guessing why they can't publish.
 *
 * Saving edits and requesting AI proposals are two different actions on
 * purpose (see ArticlesService.update/requestAiProposals's doc comments
 * on the backend) — this component keeps that distinction visible rather
 * than collapsing it into one generic "Save" button that would blur the
 * human-approval gate's whole point.
 */
export function ArticleEditor({
  article: initialArticle,
  initialHeroImageUrl,
}: {
  article: Article;
  /** Resolved server-side (see app/articles/[id]/page.tsx) — the article
   * itself only carries heroImageId, not a usable URL, so the edit page
   * looks up the current hero image's URL once before rendering this
   * component, rather than this component needing to know how to resolve
   * one itself. */
  initialHeroImageUrl?: string;
}) {
  const [article, setArticle] = useState(initialArticle);
  const [title, setTitle] = useState(initialArticle.title);
  const [excerpt, setExcerpt] = useState(initialArticle.excerpt ?? '');
  const [bodyMdx, setBodyMdx] = useState(initialArticle.bodyMdx);
  const [divisionTagsInput, setDivisionTagsInput] = useState(initialArticle.divisionTags.join(', '));
  const [tagNamesInput, setTagNamesInput] = useState(initialArticle.tags.map((t) => t.name).join(', '));
  const [metaTitle, setMetaTitle] = useState((initialArticle.seoMeta?.meta_title as string) ?? '');
  const [metaDescription, setMetaDescription] = useState((initialArticle.seoMeta?.meta_description as string) ?? '');
  const [heroImageId, setHeroImageId] = useState(initialArticle.heroImageId);

  const [isSaving, startSaving] = useTransition();
  const [isRequestingAi, startRequestingAi] = useTransition();
  const [isTransitioning, startTransitioning] = useTransition();
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function handleSave() {
    setMessage(null);
    startSaving(async () => {
      const result = await updateArticleAction(article.id, {
        title,
        excerpt,
        bodyMdx,
        divisionTags: splitList(divisionTagsInput),
        tagNames: splitList(tagNamesInput),
        seoMeta: { ...article.seoMeta, meta_title: metaTitle, meta_description: metaDescription },
        heroImageId,
      });
      if (result.ok && result.article) {
        setArticle(result.article);
        setMessage({ kind: 'success', text: 'Saved.' });
      } else {
        setMessage({ kind: 'error', text: result.error ?? 'Save failed' });
      }
    });
  }

  function handleRequestAiProposals() {
    setMessage(null);
    startRequestingAi(async () => {
      const result = await requestAiProposalsAction(article.id);
      if (result.ok && result.article) {
        setArticle(result.article);
        setExcerpt(result.article.excerpt ?? '');
        setDivisionTagsInput(result.article.divisionTags.join(', '));
        setMetaTitle((result.article.seoMeta?.meta_title as string) ?? '');
        setMetaDescription((result.article.seoMeta?.meta_description as string) ?? '');
        setMessage({ kind: 'success', text: 'AI suggestions applied — review and approve each field below.' });
      } else {
        setMessage({ kind: 'error', text: result.error ?? 'AI proposal request failed' });
      }
    });
  }

  function handleTransition(nextStatus: ArticleStatus) {
    setMessage(null);
    startTransitioning(async () => {
      const result = await transitionArticleAction(article.id, nextStatus);
      if (result.ok && result.article) {
        setArticle(result.article);
        setMessage({ kind: 'success', text: `Moved to ${statusLabel(nextStatus)}.` });
      } else {
        setMessage({ kind: 'error', text: result.error ?? 'Transition failed' });
      }
    });
  }

  const nextStates = allowedTransitions(article.status);

  return (
    <div className="article-editor">
      <div className="article-editor__header">
        <ArticleStatusBadge status={article.status} />
        <span className="article-editor__slug">{article.slug}</span>
      </div>

      {message && <p className={`article-editor__message article-editor__message--${message.kind}`}>{message.text}</p>}

      <div className="article-editor__actions">
        <button type="button" onClick={handleRequestAiProposals} disabled={isRequestingAi}>
          {isRequestingAi ? 'Requesting…' : 'Get AI Suggestions'}
        </button>
        <button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <label className="article-editor__field">
        Title
        <input type="text" value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} />
      </label>

      <div className="article-editor__field">
        Hero image
        <MediaUploader
          currentImageUrl={initialHeroImageUrl}
          onUploaded={(assetId) => setHeroImageId(assetId)}
        />
      </div>

      <label className="article-editor__field">
        Excerpt <FieldSourceBadge articleId={article.id} field="excerpt" source={article.excerptSource} />
        <textarea value={excerpt} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setExcerpt(e.target.value)} rows={2} />
      </label>

      <label className="article-editor__field">
        Body (MDX)
        <textarea value={bodyMdx} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBodyMdx(e.target.value)} rows={12} />
      </label>

      <label className="article-editor__field">
        Division tags (comma-separated){' '}
        <FieldSourceBadge articleId={article.id} field="divisionTags" source={article.divisionTagsSource} />
        <input type="text" value={divisionTagsInput} onChange={(e: ChangeEvent<HTMLInputElement>) => setDivisionTagsInput(e.target.value)} />
      </label>

      <label className="article-editor__field">
        Free-form tags (comma-separated)
        <input type="text" value={tagNamesInput} onChange={(e: ChangeEvent<HTMLInputElement>) => setTagNamesInput(e.target.value)} />
      </label>

      <fieldset className="article-editor__field">
        <legend>
          SEO meta <FieldSourceBadge articleId={article.id} field="seoMeta" source={article.seoMetaSource} />
        </legend>
        <label>
          Meta title
          <input type="text" value={metaTitle} onChange={(e: ChangeEvent<HTMLInputElement>) => setMetaTitle(e.target.value)} />
        </label>
        <label>
          Meta description
          <textarea value={metaDescription} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMetaDescription(e.target.value)} rows={2} />
        </label>
      </fieldset>

      <div className="article-editor__transitions">
        <h2>Move to next stage</h2>
        {nextStates.length === 0 && <p>This is a terminal state — no further transitions.</p>}
        {nextStates.map((nextStatus) => {
          const blocking = blockedByApprovalGate(article, nextStatus);
          const blocked = blocking.length > 0;
          return (
            <div key={nextStatus} className="article-editor__transition">
              <button
                type="button"
                onClick={() => handleTransition(nextStatus)}
                disabled={blocked || isTransitioning}
              >
                {isTransitioning ? 'Working…' : `Move to ${statusLabel(nextStatus)}`}
              </button>
              {blocked && (
                <span className="article-editor__blocked-reason">
                  Blocked — approve first: {blocking.join(', ')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function splitList(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
