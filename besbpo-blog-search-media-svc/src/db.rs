//! Postgres sync layer — reads published articles (and their pgvector
//! embeddings, where generated) directly from Postgres for the search
//! index to consume, per Doc-03 Section 7: "Phase 0 can run this directly
//! against Postgres." Uses the synchronous `postgres` crate (see the
//! Cargo.toml dependency comment for why not `tokio-postgres`).

use postgres::{Client, NoTls};
use std::fmt;

#[derive(Debug, Clone)]
pub struct ArticleRecord {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub excerpt: String,
    pub division_tags: Vec<String>,
    /// None until besbpo-blog-cms-api actually calls
    /// besbpo-blog-intelligence-svc's /v1/embeddings/generate on publish
    /// and persists the result to this column — not yet wired as of this
    /// writing (see this repo's README). The search index degrades to
    /// keyword-only scoring for any article where this is None.
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug)]
pub enum DbError {
    Connection(String),
    Query(String),
    Parse(String),
}

impl fmt::Display for DbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DbError::Connection(msg) => write!(f, "connection error: {msg}"),
            DbError::Query(msg) => write!(f, "query error: {msg}"),
            DbError::Parse(msg) => write!(f, "parse error: {msg}"),
        }
    }
}

impl std::error::Error for DbError {}

/// Fetches every published article. Opens a fresh connection per call
/// rather than holding one open across the background sync loop in
/// main.rs — simpler failure handling (a dropped connection just means
/// the next scheduled sync reconnects) at the cost of reconnection
/// overhead every sync interval, an acceptable trade for a sync job that
/// runs every 60s (see main.rs), not per-request.
pub fn fetch_published_articles(database_url: &str) -> Result<Vec<ArticleRecord>, DbError> {
    let mut client = Client::connect(database_url, NoTls).map_err(|e| DbError::Connection(e.to_string()))?;

    // id and embedding are cast to ::text explicitly — the same defensive
    // pattern used throughout this platform's Go/pgx code: casting to a
    // known wire format (text) sidesteps any ambiguity in how a given
    // driver maps uuid/vector types to Rust types, at the cost of parsing
    // the text form by hand (see parse_pgvector_text below).
    let rows = client
        .query(
            "SELECT id::text, slug, title, COALESCE(excerpt, ''), division_tags, embedding::text \
             FROM articles WHERE status = 'published'",
            &[],
        )
        .map_err(|e| DbError::Query(e.to_string()))?;

    let mut articles = Vec::with_capacity(rows.len());
    for row in rows {
        let id: String = row.get(0);
        let slug: String = row.get(1);
        let title: String = row.get(2);
        let excerpt: String = row.get(3);
        let division_tags: Vec<String> = row.get(4);
        let embedding_text: Option<String> = row.get(5);

        let embedding = match embedding_text {
            Some(text) => Some(parse_pgvector_text(&text).map_err(DbError::Parse)?),
            None => None,
        };

        articles.push(ArticleRecord { id, slug, title, excerpt, division_tags, embedding });
    }

    Ok(articles)
}

/// Parses Postgres's text representation of a `vector` column — e.g.
/// "[0.1,0.2,0.3]" — into a Vec<f32>. Pure and independently testable —
/// this is the one piece of db.rs that can actually be exercised without
/// a real database connection (see the tests below).
pub fn parse_pgvector_text(text: &str) -> Result<Vec<f32>, String> {
    let trimmed = text.trim();
    let inner = trimmed
        .strip_prefix('[')
        .and_then(|s| s.strip_suffix(']'))
        .ok_or_else(|| format!("expected '[...]' formatted vector, got: {trimmed}"))?;

    if inner.is_empty() {
        return Ok(Vec::new());
    }

    inner
        .split(',')
        .map(|part| {
            part.trim()
                .parse::<f32>()
                .map_err(|e| format!("invalid float component '{}': {}", part.trim(), e))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_well_formed_vector() {
        let result = parse_pgvector_text("[0.1,0.2,0.3]").unwrap();
        assert_eq!(result, vec![0.1, 0.2, 0.3]);
    }

    #[test]
    fn parses_negative_numbers() {
        let result = parse_pgvector_text("[-0.5,1.2,0]").unwrap();
        assert_eq!(result.len(), 3);
        assert!((result[0] - (-0.5)).abs() < 1e-6);
    }

    #[test]
    fn parses_an_empty_vector() {
        let result = parse_pgvector_text("[]").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn handles_surrounding_whitespace() {
        let result = parse_pgvector_text("  [0.1, 0.2]  ").unwrap();
        assert_eq!(result, vec![0.1, 0.2]);
    }

    #[test]
    fn rejects_missing_brackets() {
        assert!(parse_pgvector_text("0.1,0.2,0.3").is_err());
    }

    #[test]
    fn rejects_invalid_float_components() {
        assert!(parse_pgvector_text("[0.1,not-a-number,0.3]").is_err());
    }

    #[test]
    fn rejects_a_missing_closing_bracket() {
        assert!(parse_pgvector_text("[0.1,0.2").is_err());
    }
}
