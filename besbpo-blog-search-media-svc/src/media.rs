//! Media transcoding pipeline — Phase 6 implementation
//!
//! Generates optimized image variants (WebP/AVIF) from uploaded images
//! and uploads them to S3. Produces the variants referenced by
//! `media_assets.variants` in besbpo-blog-architecture/db/schema.sql.

use image::{DynamicImage, ImageFormat, ImageReader};
use std::io::Cursor;

/// Media variant configurations matching the database schema
#[derive(Debug, Clone)]
pub struct MediaVariant {
    pub label: String,     // e.g. "thumbnail", "webp_1200"
    pub s3_key: String,   // S3 object key for this variant
    pub width: u32,       // Output width in pixels
    pub height: u32,      // Output height in pixels
    pub bytes: Vec<u8>,   // Raw bytes of the variant image
}

/// Supported input formats
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SupportedFormat {
    Jpeg,
    Png,
    Gif,
    WebP,
    Unknown,
}

impl SupportedFormat {
    /// Detect format from file extension
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" => SupportedFormat::Jpeg,
            "png" => SupportedFormat::Png,
            "gif" => SupportedFormat::Gif,
            "webp" => SupportedFormat::WebP,
            _ => SupportedFormat::Unknown,
        }
    }

    /// Detect format from magic bytes (first 4 bytes)
    pub fn from_magic(bytes: &[u8]) -> Self {
        match bytes {
            [0xFF, 0xD8, 0xFF, ..] => SupportedFormat::Jpeg,
            [0x89, 0x50, 0x4E, 0x47] => SupportedFormat::Png,
            [0x47, 0x49, 0x46, 0x38] => SupportedFormat::Gif,
            [0x52, 0x49, 0x46, 0x46] => {
                // Could be WebP, need more bytes to confirm
                SupportedFormat::Unknown
            }
            _ => SupportedFormat::Unknown,
        }
    }
}

/// Media processing errors
#[derive(Debug)]
pub enum MediaError {
    UnsupportedFormat,
    InvalidImage(String),
    ProcessingError(String),
    S3UploadError(String),
}

/// Generate all required variants for a media asset
///
/// Takes original image bytes, generates optimized variants in different
/// sizes and formats (WebP), and returns metadata for S3 upload.
pub fn generate_variants(
    original_bytes: &[u8],
    original_filename: &str,
    base_s3_key: &str,
) -> Result<Vec<MediaVariant>, MediaError> {
    // Parse original image
    let img = ImageReader::new(Cursor::new(original_bytes))
        .with_guessed_format()
        .map_err(|e| MediaError::InvalidImage(e.to_string()))?
        .decode()
        .map_err(|e| MediaError::InvalidImage(e.to_string()))?;

    let (orig_width, orig_height) = img.dimensions();
    let mut variants = Vec::new();

    // Generate thumbnail (150x150, aspect-fit)
    if let Some(thumb) = resize_to_fit(&img, 150, 150) {
        let webp_bytes = encode_webp(&thumb)?;
        let s3_key = format!("{}_thumbnail.webp", base_s3_key);
        variants.push(MediaVariant {
            label: "thumbnail".to_string(),
            s3_key,
            width: thumb.width(),
            height: thumb.height(),
            bytes: webp_bytes,
        });
    }

    // Generate webp_800 (800px wide, aspect-ratio preserved)
    if let Some(resized) = resize_to_width(&img, 800) {
        let webp_bytes = encode_webp(&resized)?;
        let s3_key = format!("{}_webp_800.webp", base_s3_key);
        variants.push(MediaVariant {
            label: "webp_800".to_string(),
            s3_key,
            width: resized.width(),
            height: resized.height(),
            bytes: webp_bytes,
        });
    }

    // Generate webp_1200 (1200px wide, for hero images)
    if orig_width >= 1200 {
        if let Some(resized) = resize_to_width(&img, 1200) {
            let webp_bytes = encode_webp(&resized)?;
            let s3_key = format!("{}_webp_1200.webp", base_s3_key);
            variants.push(MediaVariant {
                label: "webp_1200".to_string(),
                s3_key,
                width: resized.width(),
                height: resized.height(),
                bytes: webp_bytes,
            });
        }
    }

    // Generate original (keep original format, for download)
    let orig_format = detect_format(original_bytes, original_filename);
    let orig_bytes = match orig_format {
        Some(ImageFormat::Png) => encode_png(&img)?,
        Some(ImageFormat::Gif) => encode_gif(&img)?,
        Some(ImageFormat::WebP) => original_bytes.to_vec(),
        _ => encode_jpeg(&img, 90)?, // Default to JPEG
    };
    let orig_ext = match orig_format {
        Some(ImageFormat::Png) => "png",
        Some(ImageFormat::Gif) => "gif",
        Some(ImageFormat::WebP) => "webp",
        _ => "jpg",
    };
    let s3_key = format!("{}_original.{}", base_s3_key, orig_ext);
    variants.push(MediaVariant {
        label: "original".to_string(),
        s3_key,
        width: orig_width,
        height: orig_height,
        bytes: orig_bytes,
    });

    Ok(variants)
}

/// Resize image to fit within max_width x max_height (aspect-fit)
fn resize_to_fit(img: &DynamicImage, max_width: u32, max_height: u32) -> Option<DynamicImage> {
    let (orig_width, orig_height) = img.dimensions();
    
    // Calculate scaling factor to fit within bounds
    let width_ratio = max_width as f64 / orig_width as f64;
    let height_ratio = max_height as f64 / orig_height as f64;
    let scale = width_ratio.min(height_ratio).min(1.0);
    
    if scale >= 1.0 {
        // Already small enough, just clone
        Some(img.clone())
    } else {
        let new_width = (orig_width as f64 * scale).round() as u32;
        let new_height = (orig_height as f64 * scale).round() as u32;
        Some(img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3))
    }
}

/// Resize image to specified width, maintaining aspect ratio
fn resize_to_width(img: &DynamicImage, target_width: u32) -> Option<DynamicImage> {
    let (orig_width, orig_height) = img.dimensions();
    
    if orig_width <= target_width {
        return Some(img.clone());
    }
    
    let scale = target_width as f64 / orig_width as f64;
    let new_height = (orig_height as f64 * scale).round() as u32;
    Some(img.resize(target_width, new_height, image::imageops::FilterType::Lanczos3))
}

/// Encode image as WebP
fn encode_webp(img: &DynamicImage) -> Result<Vec<u8>, MediaError> {
    let mut bytes = Vec::new();
    img.write_to(&mut Cursor::new(&mut bytes), ImageFormat::WebP)
        .map_err(|e| MediaError::ProcessingError(e.to_string()))?;
    Ok(bytes)
}

/// Encode image as JPEG
fn encode_jpeg(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, MediaError> {
    let mut bytes = Vec::new();
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, quality);
    img.write_with_encoder(encoder)
        .map_err(|e| MediaError::ProcessingError(e.to_string()))?;
    Ok(bytes)
}

/// Encode image as PNG
fn encode_png(img: &DynamicImage) -> Result<Vec<u8>, MediaError> {
    let mut bytes = Vec::new();
    img.write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|e| MediaError::ProcessingError(e.to_string()))?;
    Ok(bytes)
}

/// Encode image as GIF
fn encode_gif(img: &DynamicImage) -> Result<Vec<u8>, MediaError> {
    let mut bytes = Vec::new();
    img.write_to(&mut Cursor::new(&mut bytes), ImageFormat::Gif)
        .map_err(|e| MediaError::ProcessingError(e.to_string()))?;
    Ok(bytes)
}

/// Detect image format from bytes and filename
fn detect_format(bytes: &[u8], filename: &str) -> Option<ImageFormat> {
    // First try magic bytes
    let format_from_magic = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .ok()?
        .format();
    
    // If magic bytes worked, use that
    if format_from_magic != ImageFormat::Unspecified {
        return Some(format_from_magic);
    }
    
    // Fall back to extension
    let ext = filename.rsplit('.').next()?.to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => Some(ImageFormat::Jpeg),
        "png" => Some(ImageFormat::Png),
        "gif" => Some(ImageFormat::Gif),
        "webp" => Some(ImageFormat::WebP),
        _ => None,
    }
}

/// S3 upload configuration
#[derive(Debug, Clone)]
pub struct S3Config {
    pub bucket: String,
    pub region: String,
    pub key_prefix: String,
}

impl S3Config {
    pub fn new(bucket: impl Into<String>, region: impl Into<String>) -> Self {
        Self {
            bucket: bucket.into(),
            region: region.into(),
            key_prefix: String::new(),
        }
    }

    pub fn with_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.key_prefix = prefix.into();
        self
    }
}

/// Upload variants to S3 (requires AWS SDK integration)
/// 
/// This function would be called after generate_variants() to upload
/// each variant to S3. The actual S3 client initialization is in main.rs.
pub async fn upload_variants_to_s3(
    _config: &S3Config,
    _variants: &[MediaVariant],
) -> Result<(), MediaError> {
    // TODO: Implement actual S3 upload using aws-sdk-s3
    // 
    // Example implementation:
    // let config = aws_config::defaults(BehaviorVersion::latest())
    //     .region(aws_config::Region::new(config.region.clone()))
    //     .load()
    //     .await;
    // let client = S3Client::new(&config);
    // 
    // for variant in variants {
    //     client.put_object()
    //         .bucket(&config.bucket)
    //         .key(&variant.s3_key)
    //         .body(variant.bytes.clone().into())
    //         .content_type("image/webp")
    //         .send()
    //         .await
    //         .map_err(|e| MediaError::S3UploadError(e.to_string()))?;
    // }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_detection_from_extension() {
        assert_eq!(SupportedFormat::from_extension("jpg"), SupportedFormat::Jpeg);
        assert_eq!(SupportedFormat::from_extension("jpeg"), SupportedFormat::Jpeg);
        assert_eq!(SupportedFormat::from_extension("png"), SupportedFormat::Png);
        assert_eq!(SupportedFormat::from_extension("gif"), SupportedFormat::Gif);
        assert_eq!(SupportedFormat::from_extension("webp"), SupportedFormat::WebP);
        assert_eq!(SupportedFormat::from_extension("unknown"), SupportedFormat::Unknown);
    }

    #[test]
    fn test_s3_config_builder() {
        let config = S3Config::new("my-bucket", "us-east-1")
            .with_prefix("media/2024/");
        
        assert_eq!(config.bucket, "my-bucket");
        assert_eq!(config.region, "us-east-1");
        assert_eq!(config.key_prefix, "media/2024/");
    }
}
