# besbpo-blog-web

**`.github/workflows/ci.yml`** now exists — `npm install`, `tsc --noEmit`,
unit + component tests, `npm run build`. Closes a gap named throughout
this platform's development: "no CI/CD pipeline has ever actually
triggered."

Next.js public blog for blog.besbpo.co.za, statically exported to GitHub
Pages. Implements the Tier 1 static presentation layer (`BESBPO-BLOG-ARCH-01`
Section 4) and the full Phase 2 scope from `BESBPO-BLOG-ARCH-05` Section 5:
article rendering, division/tag archive pages, and the GitHub Pages deploy
pipeline.

## Try it without a live backend

This app runs and builds out of the box, no CMS deployment required:

```bash
npm install
npm run dev
```

`lib/api.ts` falls back to the fixture data in `lib/fixtures/` whenever
`CMS_API_BASE_URL` isn't set or the CMS API is unreachable — six realistic
sample articles across the division taxonomy, enough to exercise pagination,
division pages, tag pages, and the RSS feed. Set `CMS_API_BASE_URL` to a real
besbpo-blog-cms-api instance for a genuine production build; the fallback
logs a clear warning so it's never silently mistaken for live data.

## What's here (Phase 2 scope, complete)

- **Design system** (`app/globals.css`) — a "field index" visual language
  grounded in the group's built-environment/engineering subject matter:
  fine grid-paper texture on the header only, dashed cut-lines between
  list entries, and division/tag "stamps" styled after a technical
  drawing revision stamp. One accent color (ochre), spent deliberately.
- **Real MDX rendering** (`components/MdxContent.tsx`) — article bodies
  render through `next-mdx-remote/rsc`, not raw text.
- **Pagination** (`lib/pagination.ts`, `components/Pagination.tsx`) — pure,
  dependency-free logic with its own executable test suite; page 1 lives at
  `/`, pages 2+ at `/articles/page/[page]`.
- **Tag archive pages** (`app/tags/[tag]/page.tsx`) — distinct from
  division pages: tags are free-form and CMS-authored (Doc-03 §4.2),
  divisions are the formal taxonomy that drives syndication (Doc-03 §5).
- **RSS feed** (`app/feed.xml/route.ts`, `lib/rss.ts`) — a statically
  generated feed, with its own executable test suite covering XML escaping
  and RFC 822 date formatting.
- **`sitemap.ts` / `robots.ts`** — Next.js's built-in conventions, both
  compatible with `output: export`.
- **OG images** (`app/opengraph-image.tsx`, `app/articles/[slug]/opengraph-image.tsx`)
  — generated at build time via `next/og`'s `ImageResponse`; per-article
  images show the title, primary division, and reading time. Brand fonts
  aren't loaded yet (see the note in `app/opengraph-image.tsx`) — Satori's
  fallback font renders in the meantime.
- **Custom 404** (`app/not-found.tsx`).
- **`app/dashboard/page.tsx`** — ⚠️ still a placeholder only — read the
  comment at the top of that file. The Editorial Dashboard cannot live
  inside this statically exported app; it needs its own Coolify deployment.

## Two independent test suites, both genuinely executed

**`npm test`** — `lib/pagination.ts` and `lib/rss.ts` are pure, framework-free
modules (10 tests, Node's built-in test runner, zero devDependencies needed
to run them).

**`npm run test:components`** — real component rendering, via
`react-dom/server`'s `renderToStaticMarkup`, not just type-checks. `next/link`
and `next/navigation` are aliased to lightweight stand-ins in `test-mocks/`
via `tsconfig.test.json` (a separate config from the one `next build` reads,
so this doesn't touch the real app build). 10 tests, covering `ArticleCard`,
`Pagination`, `Footer`, and the async `SiteHeader` server component —
including one that exercises the real `lib/api.ts` fixture-fallback path
end to end, not a mock of it.

```bash
npm test                 # 10 tests — pagination + RSS
npm run test:components  # 10 tests — component rendering
npm run test:all         # both suites
```

## Explicitly NOT done yet (hand this to OpenHands next)

1. Split the Editorial Dashboard into its own Next.js app deployed on
   Coolify (see `app/dashboard/page.tsx`).
2. Add the `embed.js` widget script tag/integration for a "Latest
   Articles" placement (the widget itself lives in `besbpo-embed-widget`;
   the design system's `.besbpo-feed__*` styles are already in
   `app/globals.css` waiting for it).
3. Load real brand fonts (Archivo/IBM Plex Mono) into the OG image
   generation as `ArrayBuffer`s instead of relying on Satori's fallback font.
4. Set the real `CMS_API_BASE_URL` production value as a GitHub Actions
   secret before the first production deploy — until then, production
   builds will silently run on fixture data, which the console warning
   in `lib/api.ts` is there to catch.

## Local development

```bash
npm install
CMS_API_BASE_URL=http://localhost:3000 npm run dev   # or omit for fixture data
npm run build       # static export to ./out, same as the deploy workflow
npm run test:all    # pagination + RSS + component rendering, 20 tests total
```
