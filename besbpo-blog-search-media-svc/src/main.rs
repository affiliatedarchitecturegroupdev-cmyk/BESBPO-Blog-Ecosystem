//! Search & Media Service — implements the search half of Doc-03 Section 7
//! (now with a real Postgres-backed sync job and hybrid keyword+semantic
//! scoring, per Phase 6) and defines the media pipeline interface for
//! Doc-03 Section 9 (still Phase 0 — see media.rs).

mod db;
mod http;
mod media;
mod rate_limit;
mod search;

use http::{Request, Response};
use rate_limit::RateLimiter;
use search::{IndexedDocument, SearchIndex};
use std::env;
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

static INDEX: OnceLock<SearchIndex> = OnceLock::new();

fn index() -> &'static SearchIndex {
    INDEX.get_or_init(SearchIndex::new)
}

const SYNC_INTERVAL: Duration = Duration::from_secs(60);

/// Runs fetch-and-reindex once immediately (so the index is populated
/// before the first request rather than empty until the first interval
/// elapses), then repeats every SYNC_INTERVAL. Runs for the lifetime of
/// the process — there is no shutdown signal, matching the simplicity of
/// the rest of this Phase 0-originated service; revisit if/when this
/// service gains a graceful-shutdown story.
fn spawn_sync_thread(idx: &'static SearchIndex, database_url: String) {
    thread::spawn(move || loop {
        match db::fetch_published_articles(&database_url) {
            Ok(articles) => {
                let count = articles.len();
                let docs: Vec<IndexedDocument> = articles
                    .into_iter()
                    .map(|a| IndexedDocument {
                        id: a.id,
                        title: a.title,
                        body: a.excerpt,
                        division_tags: a.division_tags,
                        embedding: a.embedding,
                    })
                    .collect();
                idx.replace_all(docs);
                eprintln!("[sync] indexed {count} published article(s)");
            }
            Err(e) => {
                eprintln!("[sync] error fetching articles from Postgres: {e}");
            }
        }
        thread::sleep(SYNC_INTERVAL);
    });
}

fn handle_health(_req: &Request) -> Response {
    let body = format!(
        r#"{{"status":"ok","service":"besbpo-blog-search-media-svc","indexed_documents":{}}}"#,
        index().document_count()
    );
    Response::json(200, body)
}

fn handle_search(req: &Request) -> Response {
    let query = req.query.get("q").cloned().unwrap_or_default();
    let query_embedding: Option<Vec<f32>> = req.query.get("embedding").and_then(|s| parse_embedding_param(s));

    let results = match &query_embedding {
        Some(emb) => index().search_hybrid(&query, Some(emb.as_slice()), 10),
        None => index().search(&query, 10),
    };

    let items: Vec<String> = results
        .iter()
        .map(|r| {
            let semantic = r
                .semantic_score
                .map(|s| s.to_string())
                .unwrap_or_else(|| "null".to_string());
            format!(
                r#"{{"id":"{}","title":"{}","keyword_score":{},"semantic_score":{},"combined_score":{}}}"#,
                r.id,
                escape(&r.title),
                r.keyword_score,
                semantic,
                r.combined_score
            )
        })
        .collect();
    let body = format!(r#"{{"query":"{}","results":[{}]}}"#, escape(&query), items.join(","));
    Response::json(200, body)
}

/// Parses the `embedding` query parameter (comma-separated floats, e.g.
/// "0.1,0.2,0.3") into a Vec<f32>. Returns None on any parse failure
/// rather than erroring the request — an unparseable embedding degrades
/// to keyword-only search, same fail-soft posture as the rest of this
/// service's query handling.
///
/// PHASE 7 TODO for OpenHands: this requires the CALLER to already have a
/// query embedding (e.g. from besbpo-blog-intelligence-svc's
/// /v1/embeddings/generate). Auto-embedding the query server-side would
/// need this service to make an outbound HTTP call, which — like the
/// Postgres client — isn't something to hand-roll over TcpStream; add a
/// minimal HTTP client (or a crate) alongside this when that's needed.
fn parse_embedding_param(s: &str) -> Option<Vec<f32>> {
    let values: Result<Vec<f32>, _> = s.split(',').map(|p| p.trim().parse::<f32>()).collect();
    values.ok()
}

fn escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn main() -> std::io::Result<()> {
    let port = env::var("PORT").unwrap_or_else(|_| "8081".to_string());
    let addr = format!("0.0.0.0:{port}");

    match env::var("DATABASE_URL") {
        Ok(database_url) => {
            eprintln!("DATABASE_URL is set — syncing published articles from Postgres every {SYNC_INTERVAL:?}");
            spawn_sync_thread(index(), database_url);
        }
        Err(_) => {
            eprintln!(
                "DATABASE_URL is not set — seeding a single sample document so /api/v1/search \
                 is exercisable without Postgres (matches this platform's fixture-fallback \
                 philosophy elsewhere — see besbpo-blog-web's lib/api.ts)."
            );
            index().index(IndexedDocument {
                id: "seed-1".to_string(),
                title: "Financing Infrastructure Projects in KwaZulu-Natal".to_string(),
                body: "A look at blended-finance structures for built-environment projects.".to_string(),
                division_tags: vec!["built-environment".to_string(), "consultancy".to_string()],
                embedding: None,
            });
        }
    }

    let routes: Vec<(&str, &str, http::Handler)> = vec![
        ("GET", "/healthz", handle_health),
        ("GET", "/api/v1/search", handle_search),
    ];

    // 60/minute per IP — see rate_limit.rs for the full reasoning on why
    // this is rate-limited rather than authenticated. Matches the same
    // per-IP budget besbpo-blog-syndication-svc's beacon endpoint uses
    // (internal/middleware/ratelimiter.go, RequireIPRateLimit) for the
    // same kind of public, unauthenticated endpoint — kept consistent
    // rather than picked arbitrarily.
    let rate_limiter = RateLimiter::new(60, Duration::from_secs(60));

    http::serve(&addr, &routes, &rate_limiter)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_well_formed_embedding_param() {
        let result = parse_embedding_param("0.1,0.2,0.3");
        assert_eq!(result, Some(vec![0.1, 0.2, 0.3]));
    }

    #[test]
    fn handles_whitespace_around_values() {
        let result = parse_embedding_param(" 0.1 , 0.2 ");
        assert_eq!(result, Some(vec![0.1, 0.2]));
    }

    #[test]
    fn returns_none_for_invalid_values() {
        assert_eq!(parse_embedding_param("0.1,not-a-number"), None);
    }

    #[test]
    fn returns_none_for_empty_string() {
        assert_eq!(parse_embedding_param(""), None);
    }
}
