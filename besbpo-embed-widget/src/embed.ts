/**
 * besbpo-embed-widget — client-side syndication embed script.
 * Implements BESBPO-BLOG-ARCH-02 Section 8. Loaded via a plain <script>
 * tag on any of the 30+ subsidiary sites; deliberately has no build-time
 * dependency on the site that hosts it (Doc-01 Section 4.3).
 *
 * ⚠️ ARCHITECTURAL NOTE flagged during implementation, for OpenHands/human
 * review — besbpo-blog-architecture/openapi/syndication-api.yaml currently
 * documents ONE auth scheme (`tenantApiKey`, an HMAC-signed secret) for
 * `GET /api/v1/feed/{tenantId}`, applied uniformly to every caller. That's
 * correct for server-side/build-time callers (Doc-02 Section 7) but is NOT
 * safe for this script: anything embedded in browser-served HTML is
 * world-readable, so a secret key here would leak immediately.
 *
 * This implementation calls the feed endpoint with only the public
 * `tenant_id` in the path and NO secret credential, on the basis that the
 * content being fetched (published article titles/excerpts) is already
 * intended for wide public distribution. Before this ships, the
 * architecture repo's OpenAPI spec should be amended to formally split the
 * `tenantApiKey` scheme into (a) a secret admin/build-time key, unchanged,
 * and (b) either an unauthenticated, tenant-id-scoped, rate-limited public
 * read path, or a separate low-privilege "publishable" token safe to embed
 * client-side (mirroring the publishable/secret key pattern common to
 * payment-provider SDKs). Flagging here rather than silently embedding a
 * secret or silently ignoring the documented scheme.
 */

interface SyndicationMeta {
  attribution_line: string;
  canonical_rel: boolean;
}

interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  canonical_url: string;
  division_tags: string[];
  hero_image?: string;
  published_at: string;
  reading_time_minutes: number;
  syndication_meta: SyndicationMeta;
}

interface FeedResponse {
  tenant_id: string;
  generated_at: string;
  articles: ArticleSummary[];
  pagination: { next_cursor: string | null };
}

(function besbpoEmbedWidget() {
  const SYNDICATION_BASE_URL = 'https://syndication.blog.besbpo.co.za/api/v1';
  const CACHE_KEY_PREFIX = 'besbpo_feed_cache_';
  const CACHE_TTL_MS = 5 * 60 * 1000;

  function init(): void {
    const containers = document.querySelectorAll<HTMLElement>('#besbpo-feed, [data-besbpo-feed]');
    containers.forEach((el) => {
      const tenantId = el.dataset.tenantId;
      if (!tenantId) {
        console.warn('[besbpo-embed] element is missing data-tenant-id; skipping.');
        return;
      }
      const maxItems = parseInt(el.dataset.maxItems ?? '6', 10);
      renderInto(el, tenantId, maxItems);
    });
  }

  async function renderInto(el: HTMLElement, tenantId: string, maxItems: number): Promise<void> {
    try {
      const feed = await fetchFeed(tenantId, maxItems);
      renderFeed(el, feed);
    } catch (err) {
      // Fail silently in production per Doc-02 Section 8 ("fails silently
      // ... rather than breaking the host page"), but still log for the
      // hosting site's own debugging.
      console.warn('[besbpo-embed] failed to load feed:', err);
      renderFromCacheOrEmpty(el, tenantId);
    }
  }

  async function fetchFeed(tenantId: string, maxItems: number): Promise<FeedResponse> {
    const url = `${SYNDICATION_BASE_URL}/feed/${encodeURIComponent(tenantId)}?max_items=${maxItems}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`feed request failed: ${res.status}`);
    }
    const feed = (await res.json()) as FeedResponse;
    try {
      localStorage.setItem(CACHE_KEY_PREFIX + tenantId, JSON.stringify({ feed, cachedAt: Date.now() }));
    } catch {
      // localStorage may be unavailable (private browsing, quota) — the
      // widget must still work without caching.
    }
    return feed;
  }

  function renderFromCacheOrEmpty(el: HTMLElement, tenantId: string): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY_PREFIX + tenantId);
      if (raw) {
        const { feed, cachedAt } = JSON.parse(raw) as { feed: FeedResponse; cachedAt: number };
        if (Date.now() - cachedAt < CACHE_TTL_MS * 6) {
          renderFeed(el, feed);
          return;
        }
      }
    } catch {
      // Ignore cache errors; fall through to rendering nothing below.
    }
    // Per Doc-02 Section 8: fail silently rather than break the host page.
    el.innerHTML = '';
  }

  function renderFeed(el: HTMLElement, feed: FeedResponse): void {
    el.innerHTML = '';
    feed.articles.forEach((article) => {
      const item = document.createElement('div');
      item.className = 'besbpo-feed__item';

      const link = document.createElement('a');
      link.href = article.canonical_url;
      link.rel = 'canonical';
      link.className = 'besbpo-feed__title';
      link.textContent = article.title;
      link.addEventListener('click', () => {
        sendBeacon(feed.tenant_id, article.id, 'click_through');
      });

      const excerpt = document.createElement('p');
      excerpt.className = 'besbpo-feed__excerpt';
      excerpt.textContent = article.excerpt;

      const attribution = document.createElement('span');
      attribution.className = 'besbpo-feed__attribution';
      attribution.textContent = article.syndication_meta?.attribution_line ?? 'Originally published by Besbpo Group';

      item.appendChild(link);
      item.appendChild(excerpt);
      item.appendChild(attribution);
      el.appendChild(item);

      // Fires for both a live fetch AND a cache-fallback render (this
      // function is the single render path for both, per
      // renderFromCacheOrEmpty above) — a reader seeing the content is a
      // real impression either way, regardless of which path produced it.
      sendBeacon(feed.tenant_id, article.id, 'impression');
    });
  }

  /**
   * Reports a Doc-03 Section 8 analytics event (impression or
   * click-through) to the syndication service's beacon endpoint
   * (internal/analytics/beacon.go in besbpo-blog-syndication-svc) —
   * deliberately unauthenticated, same architectural reasoning as
   * fetchFeed above (no secret can safely live in this script). Always
   * best-effort: a failed or blocked beacon must never affect the host
   * page, so errors are swallowed rather than surfaced.
   */
  function sendBeacon(tenantId: string, articleId: string, eventType: 'impression' | 'click_through'): void {
    const payload = JSON.stringify({ tenant_id: tenantId, article_id: articleId, event_type: eventType });
    const url = `${SYNDICATION_BASE_URL}/analytics/beacon`;

    // navigator.sendBeacon is designed exactly for this case — fire-and-
    // forget telemetry that should still be delivered even if the page
    // starts navigating away immediately after (e.g. right after a
    // click-through). Falls back to a keepalive fetch where sendBeacon
    // isn't available.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Best-effort only — see the function doc comment above.
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
