'use client';

import { useState, useTransition, useEffect, type ChangeEvent } from 'react';
import { listMediaAction, deleteMediaAction, updateMediaAltTextAction } from '../app/articles/actions.ts';
import type { MediaAsset } from '../lib/cms-api.ts';

interface Props {
  onSelect: (assetId: string, url: string) => void;
}

/** Matches the backend's own default page size (media.service.ts's
 * DEFAULT_LIBRARY_PAGE_SIZE) — kept in sync by hand, same duplication
 * cost as lib/article-status.ts mirroring the CMS API's state machine. */
const PAGE_SIZE = 24;

/**
 * Lets an editor reuse a previously-uploaded image instead of uploading a
 * duplicate, edit an asset's alt text after the fact, and delete assets
 * that are no longer needed. Loads the first page on mount and appends
 * further pages on "Load more" — re-loads from the start (rather than
 * trying to patch local state) after a delete, since the total count
 * changes and patching around that correctly is more complexity than
 * it's worth for an editor-driven browse action, not a live feed.
 */
export function MediaLibrary({ onSelect }: Props) {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [total, setTotal] = useState(0);
  const [altTextDrafts, setAltTextDrafts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingAltTextId, setSavingAltTextId] = useState<string | null>(null);

  function mergeAltTextDrafts(items: MediaAsset[]) {
    setAltTextDrafts((prev: Record<string, string>) => {
      const next = { ...prev };
      for (const asset of items) {
        next[asset.id] = asset.altText ?? '';
      }
      return next;
    });
  }

  function loadFirstPage() {
    setError(null);
    startTransition(async () => {
      const result = await listMediaAction(PAGE_SIZE, 0);
      setAssets(result.items);
      setTotal(result.total);
      mergeAltTextDrafts(result.items);
    });
  }

  function loadNextPage() {
    setError(null);
    startTransition(async () => {
      const result = await listMediaAction(PAGE_SIZE, assets?.length ?? 0);
      setAssets((prev: MediaAsset[] | null) => [...(prev ?? []), ...result.items]);
      setTotal(result.total);
      mergeAltTextDrafts(result.items);
    });
  }

  useEffect(() => {
    loadFirstPage();
    // Load once on mount; refreshed explicitly (from the start) after a
    // delete via loadFirstPage() instead of re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDelete(id: string) {
    setError(null);
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteMediaAction(id);
      if (result.ok) {
        loadFirstPage();
      } else {
        // The backend rejects deleting an asset still used as some
        // article's hero image (a real foreign key constraint, not just
        // an application-level check) — that comes back here as a
        // regular error message, not a crash.
        setError(result.error ?? 'Delete failed');
      }
      setDeletingId(null);
    });
  }

  function handleSaveAltText(id: string) {
    setError(null);
    setSavingAltTextId(id);
    startTransition(async () => {
      const result = await updateMediaAltTextAction(id, altTextDrafts[id] ?? '');
      if (!result.ok) {
        setError(result.error ?? 'Saving alt text failed');
      }
      setSavingAltTextId(null);
    });
  }

  const hasMore = assets !== null && assets.length < total;

  return (
    <div className="media-library">
      {isPending && assets === null && <span className="media-uploader__status">Loading library…</span>}
      {error && <span className="article-editor__message article-editor__message--error">{error}</span>}
      {assets !== null && assets.length === 0 && <p className="empty-state">No uploaded images yet.</p>}
      {assets !== null && assets.length > 0 && (
        <>
          <div className="media-library__grid">
            {assets.map((asset: MediaAsset) => (
              <div key={asset.id} className="media-library__item">
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- see MediaUploader's preview for the same reasoning (arbitrary S3/local-file URL, internal tool) */}
                <img
                  src={asset.variantUrls?.thumbnail ?? asset.url}
                  alt={asset.altText ?? ''}
                  className="media-library__thumbnail"
                  onClick={() => onSelect(asset.id, asset.variantUrls?.display ?? asset.url)}
                />
                {/* Selecting from the library always uses the FULL image
                    URL (asset.url above, in onSelect), never the
                    thumbnail — the thumbnail is only for this grid's
                    lightweight preview, not something that should ever
                    end up as an article's actual hero image. */}
                <input
                  type="text"
                  className="media-library__alt-text-input"
                  value={altTextDrafts[asset.id] ?? ''}
                  placeholder="Alt text"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setAltTextDrafts((prev: Record<string, string>) => ({ ...prev, [asset.id]: e.target.value }))
                  }
                />
                <div className="media-library__item-actions">
                  <button
                    type="button"
                    className="media-library__save-alt-text"
                    onClick={() => handleSaveAltText(asset.id)}
                    disabled={
                      savingAltTextId === asset.id || (altTextDrafts[asset.id] ?? '') === (asset.altText ?? '')
                    }
                  >
                    {savingAltTextId === asset.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="media-library__delete"
                    onClick={() => handleDelete(asset.id)}
                    disabled={deletingId === asset.id}
                  >
                    {deletingId === asset.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="media-library__count">
            Showing {assets.length} of {total}
          </p>
          {hasMore && (
            <button type="button" className="media-library__load-more" onClick={loadNextPage} disabled={isPending}>
              {isPending ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
