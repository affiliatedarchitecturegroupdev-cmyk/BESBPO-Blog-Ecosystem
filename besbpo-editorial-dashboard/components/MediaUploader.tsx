'use client';

import { useState, useTransition, type ChangeEvent } from 'react';
import { uploadMediaAction } from '../app/articles/actions.ts';
import { MediaLibrary } from './MediaLibrary.tsx';

interface Props {
  currentImageUrl?: string;
  /** assetId is null specifically for a removal (see handleRemove below) —
   * NOT an empty string. The article's heroImageId column is a nullable
   * UUID foreign key; an empty string isn't a valid UUID and would fail
   * at the database level rather than actually clearing the field. */
  onUploaded: (assetId: string | null, url: string | null) => void;
}

/**
 * A single hero-image control: upload a new file, browse and reuse an
 * existing one from the library, or remove the current selection —
 * with a preview and an alt-text field.
 *
 * "Remove" is deliberately a LOCAL, client-side-only action (clears the
 * preview and calls onUploaded('', '') so the parent clears
 * heroImageId) — it does NOT delete the underlying MediaAsset. An asset
 * might be reused by other articles (that's the whole point of the
 * library), so detaching it from THIS article must never imply deleting
 * it from storage. Deleting an asset entirely is a separate, more
 * deliberate action that only exists inside MediaLibrary, next to each
 * thumbnail there — not offered from this quicker, more casual control.
 */
export function MediaUploader({ currentImageUrl, onUploaded }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentImageUrl);
  const [altText, setAltText] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (altText.trim()) {
      formData.append('altText', altText.trim());
    }

    startTransition(async () => {
      const result = await uploadMediaAction(formData);
      if (result.ok && result.asset) {
        // The display variant (sharp-resized, ~1200px, WebP) if it
        // generated successfully; the full original otherwise — variant
        // generation is best-effort on the backend (a resize failure
        // there degrades to no variants, not a failed upload), so this
        // preview needs the same fallback, not an assumption that
        // variantUrls.display always exists.
        const previewSource = result.asset.variantUrls?.display ?? result.asset.url;
        setPreviewUrl(previewSource);
        onUploaded(result.asset.id, result.asset.url);
      } else {
        setError(result.error ?? 'Upload failed');
      }
    });
  }

  function handleSelectFromLibrary(assetId: string, url: string) {
    setPreviewUrl(url);
    setShowLibrary(false);
    onUploaded(assetId, url);
  }

  function handleRemove() {
    setPreviewUrl(undefined);
    onUploaded(null, null);
  }

  return (
    <div className="media-uploader">
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- this
        // preview points at an arbitrary S3/local-file URL that
        // next/image's optimizer isn't configured for (an internal
        // authoring tool, not public traffic); alt text for the
        // published image itself is the separate field below, not this
        // editor-facing preview.
        <img src={previewUrl} className="media-uploader__preview" alt="Hero image preview" />
      )}

      <div className="media-uploader__controls">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          disabled={isPending}
        />
        <button type="button" onClick={() => setShowLibrary((v: boolean) => !v)} disabled={isPending}>
          {showLibrary ? 'Hide library' : 'Browse library'}
        </button>
        {previewUrl && (
          <button type="button" onClick={handleRemove} disabled={isPending}>
            Remove
          </button>
        )}
      </div>

      <label className="media-uploader__alt-text">
        Alt text (for the next upload)
        <input
          type="text"
          value={altText}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setAltText(e.target.value)}
          placeholder="Describe the image for screen readers"
        />
      </label>

      {isPending && <span className="media-uploader__status">Uploading…</span>}
      {error && <span className="article-editor__message article-editor__message--error">{error}</span>}

      {showLibrary && <MediaLibrary onSelect={handleSelectFromLibrary} />}
    </div>
  );
}
