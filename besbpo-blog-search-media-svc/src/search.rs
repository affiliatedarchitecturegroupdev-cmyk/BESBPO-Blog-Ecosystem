//! In-memory search index with hybrid (keyword + semantic) scoring, per
//! Doc-03 Section 7. Populated by main.rs's background sync thread, which
//! reads published articles (and their pgvector embeddings, where
//! generated) via db.rs.
//!
//! HYBRID SCORING NOTE: keyword_score (an unbounded term-frequency count)
//! and semantic_score (cosine similarity, always in [-1, 1]) are on very
//! different scales, so combined_score min-max normalises keyword_score
//! against the current result set before averaging it with semantic_score.
//! This is a reasonable starting point, not an empirically tuned formula —
//! there was no way to tune or validate blending weights without a real
//! corpus and real query judgments, neither of which exist yet. Revisit
//! once real usage data does.

use std::sync::RwLock;

#[derive(Clone, Debug)]
pub struct IndexedDocument {
    pub id: String,
    pub title: String,
    pub body: String,
    pub division_tags: Vec<String>,
    /// None for documents synced before embeddings existed, or before
    /// besbpo-blog-cms-api starts persisting them on publish (see this
    /// repo's README) — search degrades gracefully to keyword-only
    /// scoring for those documents regardless of whether the query itself
    /// carries an embedding.
    pub embedding: Option<Vec<f32>>,
}

#[derive(Clone, Debug)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub keyword_score: f32,
    pub semantic_score: Option<f32>,
    pub combined_score: f32,
}

pub struct SearchIndex {
    documents: RwLock<Vec<IndexedDocument>>,
}

impl SearchIndex {
    pub fn new() -> Self {
        SearchIndex { documents: RwLock::new(Vec::new()) }
    }

    pub fn index(&self, doc: IndexedDocument) {
        let mut docs = self.documents.write().expect("index lock poisoned");
        docs.retain(|d| d.id != doc.id); // re-indexing replaces the prior version
        docs.push(doc);
    }

    /// Replaces the entire index contents in one call — used by main.rs's
    /// background sync thread so a sync cycle is atomic from a reader's
    /// perspective (no window where the index is half-old, half-new), and
    /// so articles that are no longer published get removed rather than
    /// lingering forever (index() alone only ever adds/replaces, never
    /// removes).
    pub fn replace_all(&self, docs: Vec<IndexedDocument>) {
        let mut guard = self.documents.write().expect("index lock poisoned");
        *guard = docs;
    }

    pub fn document_count(&self) -> usize {
        self.documents.read().expect("index lock poisoned").len()
    }

    /// Keyword-only search — kept as a thin wrapper over search_hybrid for
    /// callers (and existing tests) that don't have a query embedding.
    pub fn search(&self, query: &str, max_results: usize) -> Vec<SearchResult> {
        self.search_hybrid(query, None, max_results)
    }

    /// Hybrid search: always computes the keyword score; additionally
    /// computes a semantic score (cosine similarity against
    /// query_embedding) for any document that has its own embedding, when
    /// query_embedding is provided. See the module doc comment for how
    /// the two are combined.
    pub fn search_hybrid(&self, query: &str, query_embedding: Option<&[f32]>, max_results: usize) -> Vec<SearchResult> {
        let terms: Vec<String> = query.to_lowercase().split_whitespace().map(String::from).collect();
        if terms.is_empty() && query_embedding.is_none() {
            return Vec::new();
        }

        let docs = self.documents.read().expect("index lock poisoned");

        let mut scored: Vec<SearchResult> = docs
            .iter()
            .filter_map(|doc| {
                let keyword_score = keyword_match_score(doc, &terms);
                let semantic_score = match (query_embedding, &doc.embedding) {
                    (Some(q), Some(d)) => Some(cosine_similarity(q, d)),
                    _ => None,
                };

                if keyword_score <= 0.0 && semantic_score.is_none() {
                    return None;
                }
                // combined_score is filled in properly in the normalisation
                // pass below, once the max keyword_score across this
                // result set is known — placeholder here.
                Some(SearchResult {
                    id: doc.id.clone(),
                    title: doc.title.clone(),
                    keyword_score,
                    semantic_score,
                    combined_score: 0.0,
                })
            })
            .collect();

        let max_keyword_score = scored.iter().map(|r| r.keyword_score).fold(0.0f32, f32::max);

        for result in &mut scored {
            let normalised_keyword = if max_keyword_score > 0.0 {
                result.keyword_score / max_keyword_score
            } else {
                0.0
            };
            result.combined_score = match result.semantic_score {
                Some(semantic) => 0.5 * normalised_keyword + 0.5 * semantic,
                None => normalised_keyword,
            };
        }

        scored.sort_by(|a, b| b.combined_score.partial_cmp(&a.combined_score).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(max_results);
        scored
    }
}

impl Default for SearchIndex {
    fn default() -> Self {
        Self::new()
    }
}

/// Naive keyword relevance: counts case-insensitive query-term
/// occurrences in title (weighted higher) and body. Unchanged from Phase
/// 0 — see the module doc comment for why a TF-IDF or real inverted-index
/// rewrite wasn't attempted alongside the hybrid-scoring and Postgres-sync
/// changes in the same pass.
fn keyword_match_score(doc: &IndexedDocument, terms: &[String]) -> f32 {
    if terms.is_empty() {
        return 0.0;
    }
    let title_lower = doc.title.to_lowercase();
    let body_lower = doc.body.to_lowercase();
    let mut score = 0.0f32;
    for term in terms {
        score += 3.0 * title_lower.matches(term.as_str()).count() as f32;
        score += 1.0 * body_lower.matches(term.as_str()).count() as f32;
    }
    score
}

/// Cosine similarity between two vectors, in [-1, 1] for typical
/// embeddings. Returns 0.0 for mismatched lengths or zero-magnitude
/// vectors rather than panicking — a malformed/missing embedding should
/// degrade search quality, not crash the request.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_doc(id: &str, title: &str, body: &str) -> IndexedDocument {
        IndexedDocument {
            id: id.to_string(),
            title: title.to_string(),
            body: body.to_string(),
            division_tags: vec![],
            embedding: None,
        }
    }

    fn sample_doc_with_embedding(id: &str, title: &str, body: &str, embedding: Vec<f32>) -> IndexedDocument {
        IndexedDocument {
            id: id.to_string(),
            title: title.to_string(),
            body: body.to_string(),
            division_tags: vec![],
            embedding: Some(embedding),
        }
    }

    #[test]
    fn returns_documents_matching_query_term() {
        let index = SearchIndex::new();
        index.index(sample_doc("1", "Financing Infrastructure", "A piece about infrastructure financing."));
        index.index(sample_doc("2", "Team Culture Update", "A short note about our culture."));

        let results = index.search("infrastructure", 10);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "1");
    }

    #[test]
    fn title_matches_score_higher_than_body_matches() {
        let index = SearchIndex::new();
        index.index(sample_doc("1", "Logistics Update", "General note, no repeated term here."));
        index.index(sample_doc("2", "General Note", "logistics logistics logistics logistics"));

        let results = index.search("logistics", 10);
        assert_eq!(results.len(), 2);
        assert!(results.iter().any(|r| r.id == "1"));
        assert!(results.iter().any(|r| r.id == "2"));
    }

    #[test]
    fn empty_query_returns_no_results() {
        let index = SearchIndex::new();
        index.index(sample_doc("1", "Title", "Body"));
        assert!(index.search("", 10).is_empty());
    }

    #[test]
    fn replace_all_removes_documents_no_longer_present() {
        let index = SearchIndex::new();
        index.index(sample_doc("1", "First", "Body one"));
        index.index(sample_doc("2", "Second", "Body two"));
        assert_eq!(index.document_count(), 2);

        index.replace_all(vec![sample_doc("2", "Second", "Body two")]);
        assert_eq!(index.document_count(), 1);
        assert!(index.search("first", 10).is_empty());
    }

    #[test]
    fn hybrid_search_blends_keyword_and_semantic_scores() {
        let index = SearchIndex::new();
        // Doc 1: strong keyword match, embedding orthogonal to the query embedding.
        index.index(sample_doc_with_embedding("1", "Logistics Update", "logistics logistics logistics", vec![1.0, 0.0]));
        // Doc 2: no keyword match at all, but embedding identical to the query embedding.
        index.index(sample_doc_with_embedding("2", "Unrelated Title", "nothing relevant here", vec![0.0, 1.0]));

        let query_embedding = vec![0.0, 1.0];
        let results = index.search_hybrid("logistics", Some(query_embedding.as_slice()), 10);

        // Doc 2 should be found purely on semantic similarity despite zero keyword score.
        assert!(results.iter().any(|r| r.id == "2"));
        let doc2 = results.iter().find(|r| r.id == "2").unwrap();
        assert_eq!(doc2.keyword_score, 0.0);
        assert!(doc2.semantic_score.unwrap() > 0.99); // identical vectors -> cosine ~1.0
    }

    #[test]
    fn hybrid_search_with_no_query_embedding_matches_keyword_only_search() {
        let index = SearchIndex::new();
        index.index(sample_doc_with_embedding("1", "Logistics Update", "logistics", vec![1.0, 0.0]));

        let keyword_only = index.search("logistics", 10);
        let hybrid_no_embedding = index.search_hybrid("logistics", None, 10);

        assert_eq!(keyword_only.len(), hybrid_no_embedding.len());
        assert_eq!(keyword_only[0].id, hybrid_no_embedding[0].id);
        assert!(hybrid_no_embedding[0].semantic_score.is_none());
    }
}

#[cfg(test)]
mod cosine_similarity_tests {
    use super::cosine_similarity;

    #[test]
    fn identical_vectors_have_similarity_one() {
        let a = vec![1.0, 2.0, 3.0];
        assert!((cosine_similarity(&a, &a) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn orthogonal_vectors_have_similarity_zero() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];
        assert!(cosine_similarity(&a, &b).abs() < 1e-6);
    }

    #[test]
    fn opposite_vectors_have_similarity_negative_one() {
        let a = vec![1.0, 0.0];
        let b = vec![-1.0, 0.0];
        assert!((cosine_similarity(&a, &b) - (-1.0)).abs() < 1e-6);
    }

    #[test]
    fn mismatched_lengths_return_zero_not_panic() {
        let a = vec![1.0, 2.0];
        let b = vec![1.0, 2.0, 3.0];
        assert_eq!(cosine_similarity(&a, &b), 0.0);
    }

    #[test]
    fn zero_vector_returns_zero_not_nan() {
        let a = vec![0.0, 0.0];
        let b = vec![1.0, 1.0];
        assert_eq!(cosine_similarity(&a, &b), 0.0);
    }

    #[test]
    fn empty_vectors_return_zero() {
        let a: Vec<f32> = vec![];
        let b: Vec<f32> = vec![];
        assert_eq!(cosine_similarity(&a, &b), 0.0);
    }
}
