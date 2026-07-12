import { randomUUID } from 'crypto';

/** Image MIME types this platform accepts for upload. Deliberately a
 * narrow allow-list rather than "anything" — this becomes a hero image
 * on a public article, not a general file store. */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export function isAllowedImageMimeType(mimeType: string): boolean {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** Strips anything that isn't alphanumeric/dot/dash/underscore, so the
 * original filename can safely become part of an S3 key or a local
 * filesystem path without directory traversal or shell-unsafe
 * characters (e.g. "../../etc/passwd" or "file; rm -rf /.png"). Falls
 * back to a generic name when the result would have no actual
 * alphanumeric content — not just for a literally-empty input, but also
 * a filename made entirely of unsafe characters (e.g. "///"), which
 * `replace()` turns into a non-empty but useless string of underscores
 * rather than an empty one — checking for emptiness alone would miss
 * that case. */
export function sanitizeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  return /[a-zA-Z0-9]/.test(cleaned) ? cleaned : 'upload';
}

/** Builds a unique storage key for an upload — a UUID prefix guarantees
 * no collision between two unrelated uploads that happen to share a
 * filename, while keeping the original (sanitized) filename in the key
 * for human-readability when browsing the bucket directly. */
export function buildMediaKey(originalFilename: string): string {
  return `media/${randomUUID()}-${sanitizeFilename(originalFilename)}`;
}

/** Derives a resized variant's storage key from the original upload's
 * key — e.g. "media/uuid-photo.jpg" + "thumbnail" ->
 * "media/uuid-photo.jpg-thumbnail.webp". Used by
 * MediaService.generateVariants (via `sharp`) to name the thumbnail and
 * display variants it stores alongside the original. Every variant is
 * always WebP output regardless of the original's format, so the
 * extension is fixed here rather than threaded through as a parameter. */
export function variantKey(originalKey: string, label: string): string {
  return `${originalKey}-${label}.webp`;
}

/**
 * Clamps a requested pagination limit/offset to sane values rather than
 * trusting or rejecting them outright — a slightly-wrong request from
 * the UI (e.g. limit=0, a negative offset, a non-numeric value that
 * became NaN upstream) should still return *something* sensible, not an
 * error or an unbounded query.
 */
export function clampPagination(
  limit: number,
  offset: number,
  defaultLimit: number,
  maxLimit: number,
): { limit: number; offset: number } {
  const truncatedLimit = Math.trunc(limit);
  const effectiveLimit = truncatedLimit || defaultLimit; // falls back on 0 and NaN alike
  const clampedLimit = Math.min(Math.max(effectiveLimit, 1), maxLimit);

  const truncatedOffset = Math.trunc(offset);
  const effectiveOffset = truncatedOffset || 0; // falls back on NaN
  const clampedOffset = Math.max(effectiveOffset, 0);

  return { limit: clampedLimit, offset: clampedOffset };
}
