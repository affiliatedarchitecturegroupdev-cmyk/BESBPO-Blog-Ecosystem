'use client';

import { useState, useTransition } from 'react';
import type { ContentFieldSource } from '../lib/article-status.ts';
import type { ApprovableField } from '../lib/cms-api.ts';
import { approveFieldAction } from '../app/articles/actions.ts';

const SOURCE_LABELS: Record<ContentFieldSource, string> = {
  human: 'Human-authored',
  ai_proposed: 'AI-proposed — needs review',
  human_approved: 'AI-proposed, approved',
};

const SOURCE_COLORS: Record<ContentFieldSource, string> = {
  human: '#374151',
  ai_proposed: '#b45309',
  human_approved: '#15803d',
};

interface Props {
  articleId: string;
  field: ApprovableField;
  source: ContentFieldSource;
}

/**
 * Shows a field's provenance (Doc-03 Section 6) and, when it's
 * 'ai_proposed', an inline Approve button — the explicit "I reviewed
 * this and accept it as-is" action (POST /articles/:id/approve/:field),
 * deliberately separate from editing the field's value (which the API
 * treats as a distinct action — see ArticlesService.approveField's doc
 * comment on the backend for why those two are not the same thing).
 */
export function FieldSourceBadge({ articleId, field, source }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  const effectiveSource: ContentFieldSource = approved ? 'human_approved' : source;

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveFieldAction(articleId, field);
      if (result.ok) {
        setApproved(true);
      } else {
        setError(result.error ?? 'Approval failed');
      }
    });
  }

  return (
    <span className="field-source">
      <span
        className="field-source__badge"
        style={{ backgroundColor: SOURCE_COLORS[effectiveSource] }}
        data-testid={`field-source-${field}`}
      >
        {SOURCE_LABELS[effectiveSource]}
      </span>
      {effectiveSource === 'ai_proposed' && (
        <button
          type="button"
          className="field-source__approve"
          onClick={handleApprove}
          disabled={isPending}
        >
          {isPending ? 'Approving…' : 'Approve'}
        </button>
      )}
      {error && <span className="field-source__error">{error}</span>}
    </span>
  );
}
