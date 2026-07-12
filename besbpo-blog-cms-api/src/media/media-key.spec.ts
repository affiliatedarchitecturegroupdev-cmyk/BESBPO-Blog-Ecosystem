import { isAllowedImageMimeType, sanitizeFilename, buildMediaKey, variantKey, clampPagination } from './media-key';

describe('isAllowedImageMimeType', () => {
  it('accepts common image mime types', () => {
    expect(isAllowedImageMimeType('image/jpeg')).toBe(true);
    expect(isAllowedImageMimeType('image/png')).toBe(true);
    expect(isAllowedImageMimeType('image/webp')).toBe(true);
    expect(isAllowedImageMimeType('image/gif')).toBe(true);
  });

  it('rejects non-image mime types', () => {
    expect(isAllowedImageMimeType('application/pdf')).toBe(false);
    expect(isAllowedImageMimeType('text/html')).toBe(false);
    expect(isAllowedImageMimeType('application/javascript')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isAllowedImageMimeType('')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('strips path traversal characters', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd');
  });

  it('keeps safe characters unchanged', () => {
    expect(sanitizeFilename('my-photo_v2.jpg')).toBe('my-photo_v2.jpg');
  });

  it('falls back to a generic name for an empty input', () => {
    expect(sanitizeFilename('')).toBe('upload');
  });

  it('falls back to a generic name when every character is unsafe', () => {
    // A real gap this caught during development: replace() turns "///"
    // into "___" (non-empty), so a naive "is the result empty" check
    // misses this case — the fix checks for actual alphanumeric content
    // instead. Worth its own explicit regression test.
    expect(sanitizeFilename('///')).toBe('upload');
    expect(sanitizeFilename('***')).toBe('upload');
  });

  it('keeps a filename that has at least one safe character', () => {
    expect(sanitizeFilename('a///')).toBe('a___');
  });
});

describe('buildMediaKey', () => {
  it('starts with the media/ prefix', () => {
    expect(buildMediaKey('photo.jpg')).toMatch(/^media\//);
  });

  it('includes the sanitized filename', () => {
    expect(buildMediaKey('photo.jpg')).toMatch(/-photo\.jpg$/);
  });

  it('produces a unique key on every call, even for the same filename', () => {
    const first = buildMediaKey('photo.jpg');
    const second = buildMediaKey('photo.jpg');
    expect(first).not.toBe(second);
  });

  it('never contains a path separator beyond the media/ prefix, regardless of the input filename', () => {
    // The property that actually matters for safety — NOT "no '..'
    // substring" (dots are legitimately allowed for file extensions, so
    // a sanitized "../.." can still contain '..' as characters; that's
    // harmless as long as no '/' survives to make it a real path
    // traversal sequence when later joined with a directory).
    const key = buildMediaKey('../../etc/passwd');
    const withoutPrefix = key.slice('media/'.length);
    expect(withoutPrefix.includes('/')).toBe(false);
  });
});

describe('variantKey', () => {
  it('appends the label and a .webp extension to the original key', () => {
    expect(variantKey('media/uuid-photo.jpg', 'thumbnail')).toBe('media/uuid-photo.jpg-thumbnail.webp');
  });

  it('produces a different key for a different label on the same original key', () => {
    const thumbnail = variantKey('media/uuid-photo.jpg', 'thumbnail');
    const display = variantKey('media/uuid-photo.jpg', 'display');
    expect(thumbnail).not.toBe(display);
  });
});

describe('clampPagination', () => {
  it('passes normal values through unchanged', () => {
    expect(clampPagination(24, 0, 24, 100)).toEqual({ limit: 24, offset: 0 });
  });

  it('passes a valid custom limit/offset through unchanged', () => {
    expect(clampPagination(10, 20, 24, 100)).toEqual({ limit: 10, offset: 20 });
  });

  it('falls back to the default limit when limit is 0', () => {
    expect(clampPagination(0, 0, 24, 100)).toEqual({ limit: 24, offset: 0 });
  });

  it('falls back to the default limit when limit is NaN', () => {
    expect(clampPagination(NaN, 0, 24, 100)).toEqual({ limit: 24, offset: 0 });
  });

  it('clamps a negative limit up to 1, not the default', () => {
    expect(clampPagination(-5, 0, 24, 100)).toEqual({ limit: 1, offset: 0 });
  });

  it('clamps an over-large limit down to the max', () => {
    expect(clampPagination(9999, 0, 24, 100)).toEqual({ limit: 100, offset: 0 });
  });

  it('clamps a negative offset up to 0', () => {
    expect(clampPagination(24, -10, 24, 100)).toEqual({ limit: 24, offset: 0 });
  });

  it('falls back to offset 0 when offset is NaN', () => {
    expect(clampPagination(24, NaN, 24, 100)).toEqual({ limit: 24, offset: 0 });
  });

  it('truncates a non-integer limit', () => {
    expect(clampPagination(24.9, 0, 24, 100)).toEqual({ limit: 24, offset: 0 });
  });

  it('truncates a non-integer offset', () => {
    expect(clampPagination(24, 5.7, 24, 100)).toEqual({ limit: 24, offset: 5 });
  });

  it('accepts a limit exactly at the max unchanged', () => {
    expect(clampPagination(100, 0, 24, 100)).toEqual({ limit: 100, offset: 0 });
  });

  it('accepts a limit exactly at 1 unchanged', () => {
    expect(clampPagination(1, 0, 24, 100)).toEqual({ limit: 1, offset: 0 });
  });
});
