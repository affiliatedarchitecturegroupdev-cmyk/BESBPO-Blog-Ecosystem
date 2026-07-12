// Typed client for the endpoints blog.besbpo.co.za needs at build time.
// Mirrors the schemas in besbpo-blog-architecture/openapi/syndication-api.yaml
// and the /articles, /tags, /taxonomy/divisions endpoints exposed by
// besbpo-blog-cms-api. Since this app is statically exported (Doc-04
// Section 3.1), every call here runs at BUILD time (inside
// generateStaticParams / the page functions during `next build`), not at
// request time in the browser.
//
// FIXTURE FALLBACK: if the CMS API is unreachable — no CMS_API_BASE_URL
// set, or the request fails — these functions fall back to the fixture
// data in lib/fixtures/. This is deliberate: it means `npm run build` works
// out of the box for local development, CI preview builds, and design
// review, before besbpo-blog-cms-api is actually deployed and reachable.
// Production builds should set CMS_API_BASE_URL to a real, reachable CMS
// instance — the fallback exists for convenience, not as a substitute for
// wiring the real API before a genuine production deploy.

import divisionsFixture from './fixtures/divisions.json' with { type: 'json' };
import articlesFixture from './fixtures/articles.json' with { type: 'json' };

const CMS_API_BASE_URL = process.env.CMS_API_BASE_URL;

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  canonical_url: string;
  division_tags: string[];
  tags?: string[];
  hero_image?: string | null;
  published_at: string;
  reading_time_minutes: number;
}

export interface ArticleFull extends ArticleSummary {
  body_mdx: string;
  author: { name: string; division: string };
  seo_meta: Record<string, unknown>;
}

export interface Division {
  key: string;
  label: string;
  description?: string;
}

let warnedAboutFixtures = false;
function warnFixtureFallback(reason: string) {
  if (!warnedAboutFixtures) {
    // eslint-disable-next-line no-console
    console.warn(
      `[besbpo-blog-web] CMS API unavailable (${reason}) — falling back to ` +
        `lib/fixtures/ for this build. Set CMS_API_BASE_URL to a reachable ` +
        `besbpo-blog-cms-api instance for a real production build.`,
    );
    warnedAboutFixtures = true;
  }
}

async function apiFetch<T>(path: string): Promise<T | null> {
  if (!CMS_API_BASE_URL) {
    warnFixtureFallback('CMS_API_BASE_URL not set');
    return null;
  }
  try {
    const res = await fetch(`${CMS_API_BASE_URL}${path}`);
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    warnFixtureFallback(err instanceof Error ? err.message : String(err));
    return null;
  }
}

const fixtureArticles = articlesFixture as unknown as ArticleFull[];
const fixtureDivisions = divisionsFixture as Division[];

export async function listPublishedArticles(): Promise<ArticleSummary[]> {
  const live = await apiFetch<ArticleSummary[]>('/articles?status=published');
  if (live) return live;
  return [...fixtureArticles].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
}

export async function getArticleBySlug(slug: string): Promise<ArticleFull> {
  const live = await apiFetch<ArticleFull>(`/articles/${slug}`);
  if (live) return live;
  const found = fixtureArticles.find((a) => a.slug === slug);
  if (!found) {
    throw new Error(`Article '${slug}' not found in CMS API or fixtures`);
  }
  return found;
}

export async function listDivisions(): Promise<Division[]> {
  const live = await apiFetch<Division[]>('/taxonomy/divisions');
  return live ?? fixtureDivisions;
}

export async function listArticlesByDivision(divisionKey: string): Promise<ArticleSummary[]> {
  const live = await apiFetch<ArticleSummary[]>(
    `/articles?division=${encodeURIComponent(divisionKey)}&status=published`,
  );
  if (live) return live;
  return fixtureArticles.filter((a) => a.division_tags.includes(divisionKey));
}

export async function listTags(): Promise<string[]> {
  const live = await apiFetch<{ name: string }[]>('/tags');
  if (live) return live.map((t) => t.name);
  const unique = new Set<string>();
  fixtureArticles.forEach((a) => (a.tags ?? []).forEach((t) => unique.add(t)));
  return [...unique].sort();
}

export async function listArticlesByTag(tag: string): Promise<ArticleSummary[]> {
  const live = await apiFetch<ArticleSummary[]>(
    `/articles?tag=${encodeURIComponent(tag)}&status=published`,
  );
  if (live) return live;
  return fixtureArticles.filter((a) => (a.tags ?? []).includes(tag));
}
