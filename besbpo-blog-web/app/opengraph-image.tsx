import { ImageResponse } from 'next/og';

// Next.js OG image convention — supported under `output: export` (Doc-04
// Section 3.1) since it renders once at build time, not per-request.
// This is the fallback image for any route that doesn't define its own
// (e.g. the homepage); app/articles/[slug]/opengraph-image.tsx overrides
// it per-article.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Besbpo Group Blog';

// NOTE for OpenHands: this intentionally uses Satori's built-in fallback
// font rather than loading the brand fonts (Archivo/IBM Plex Mono) as
// ArrayBuffers, since fetching font files at build time wasn't possible in
// the environment this was scaffolded in. Phase 3+ should load the real
// woff/ttf files (e.g. from `public/fonts/`) and pass them via the
// ImageResponse `fonts` option for brand-accurate OG images.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#0b1f3a',
          padding: '80px',
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#b8860b',
            borderBottom: '3px solid #b8860b',
            paddingBottom: 16,
            marginBottom: 40,
            display: 'flex',
          }}
        >
          BESBPO GROUP
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, color: '#f5f4f0', display: 'flex', maxWidth: 900 }}>
          Field notes from across the group
        </div>
      </div>
    ),
    { ...size },
  );
}
