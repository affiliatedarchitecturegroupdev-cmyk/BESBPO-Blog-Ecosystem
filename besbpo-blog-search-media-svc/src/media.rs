//! Media transcoding pipeline — interface only, still unimplemented as of
//! Phase 6.
//!
//! PHASE 7 TODO for OpenHands: implement real image resizing/transcoding
//! (the `image` crate is the natural choice) producing the WebP/AVIF
//! variants referenced by `media_assets.variants` in
//! besbpo-blog-architecture/db/schema.sql, then upload each variant to S3
//! (an AWS SDK crate, or a plain signed-request implementation over this
//! service's existing zero-dependency HTTP client philosophy).
//!
//! DELIBERATELY NOT ATTEMPTED IN PHASE 6: this pass added exactly one new
//! dependency (the synchronous `postgres` crate, for the search sync job —
//! see db.rs and the Cargo.toml comment) specifically to keep the
//! new-and-unverifiable surface area small, given this service is written
//! and reviewed without a Rust compiler available (see this repo's
//! README). Image processing and S3 upload would each pull in a
//! substantial crate (`image`, plus an AWS SDK or manual SigV4 signing)
//! with a much larger API surface than `postgres`'s handful of calls this
//! module already leans on — stacking that much unverifiable surface onto
//! the same pass as the search changes was judged too much risk for one
//! review pass. Do this as its own dedicated pass, not bundled in.

#[derive(Debug, Clone)]
pub struct MediaVariant {
    pub label: String, // e.g. "thumbnail", "webp_1200"
    pub s3_key: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug)]
pub enum MediaError {
    UnsupportedFormat,
    NotImplemented,
}

/// Intended contract: take raw uploaded bytes, produce a set of optimised
/// variants, and return their eventual S3 keys (upload itself is a separate
/// concern, not shown here). Still returns `MediaError::NotImplemented`
/// unconditionally — see the module doc comment for why this wasn't
/// picked up in the same pass as the search changes.
pub fn generate_variants(_original_bytes: &[u8], _original_filename: &str) -> Result<Vec<MediaVariant>, MediaError> {
    Err(MediaError::NotImplemented)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_variants_is_a_stub_pending_a_dedicated_media_pass() {
        let result = generate_variants(&[], "test.jpg");
        assert!(matches!(result, Err(MediaError::NotImplemented)));
    }
}
