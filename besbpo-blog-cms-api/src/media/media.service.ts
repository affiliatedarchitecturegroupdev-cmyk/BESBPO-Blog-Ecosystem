import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import sharp from 'sharp';
import { MediaAsset } from './entities/media-asset.entity';
import { S3StorageBackend, LocalFilesystemStorageBackend, StorageBackend } from './storage-backend';
import { buildMediaKey, isAllowedImageMimeType, variantKey, clampPagination } from './media-key';
import { AuthorsService } from '../authors/authors.service';

/** Generous for a hero image, not "upload anything" — this becomes part
 * of a public article, not a general file store. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Default page size for the library view — a reasonable grid (e.g. 6x4)
 * without the client needing to specify one. */
const DEFAULT_LIBRARY_PAGE_SIZE = 24;

/** Hard ceiling on page size, regardless of what a caller requests —
 * this used to be the ONLY limit (no pagination at all), kept as the
 * max now that real paging exists, so a caller can't request an
 * unbounded page by passing a huge limit. */
const MAX_LIBRARY_PAGE_SIZE = 100;

/** Square crop, good for a grid thumbnail (MediaLibrary's grid uses
 * object-fit: cover already, but generating an actually-small variant
 * means the browser downloads ~10s of KB per thumbnail instead of the
 * full original — this is the whole point of resizing at all. */
const THUMBNAIL_SIZE = 300;

/** Wide enough for a hero image banner on a typical article page,
 * without shipping a multi-megabyte original to every visitor.
 * `withoutEnlargement` (see generateVariants) means a smaller original
 * never gets upscaled to fill this — the variant is simply skipped in
 * favour of an original that's already small enough. */
const DISPLAY_WIDTH = 1200;

export interface UploadableFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface PaginatedMediaAssets {
  items: MediaAsset[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly backend: StorageBackend;

  constructor(
    @InjectRepository(MediaAsset)
    private readonly mediaRepo: Repository<MediaAsset>,
    private readonly config: ConfigService,
    private readonly s3Backend: S3StorageBackend,
    private readonly localBackend: LocalFilesystemStorageBackend,
    private readonly authorsService: AuthorsService,
  ) {
    // Picked once, at construction — see besbpo-blog-syndication-svc's
    // main.go / besbpo-blog-intelligence-svc's config.py for the same
    // "pick the real backend if configured, else fall back" pattern
    // elsewhere in this platform, just decided here rather than in main.ts
    // since MediaService is the only thing that needs to know about it.
    this.backend = this.config.get<string>('AWS_S3_BUCKET') ? this.s3Backend : this.localBackend;
  }

  /**
   * `media_assets.uploaded_by` is a foreign key to `authors(id)`, not
   * `users(id)` — the same mismatch found in ArticlesService.create
   * (see that method's doc comment for the full story). Lower severity
   * here specifically because this column is nullable (unlike
   * `articles.author_id`), so the old code didn't hard-fail every
   * upload — it would only have failed when a real (wrong) user id
   * happened to be provided, since a NULL is perfectly valid but a
   * non-existent foreign key value isn't. Fixed the same way, for
   * consistency rather than leaving one of the two half-fixed.
   */
  async upload(
    file: UploadableFile,
    uploader?: { id: string; displayName?: string; email?: string },
    altText?: string,
  ): Promise<MediaAsset> {
    if (!isAllowedImageMimeType(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: image/jpeg, image/png, image/webp, image/gif.`,
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File too large: ${file.size} bytes (max ${MAX_UPLOAD_BYTES}).`);
    }

    const authorId = uploader
      ? (await this.authorsService.getOrCreateForUser(uploader.id, uploader.displayName ?? uploader.email ?? uploader.id))
          .id
      : undefined;

    const key = buildMediaKey(file.originalname);
    const url = await this.backend.store(file.buffer, key, file.mimetype);
    const variants = await this.generateVariants(file.buffer, key);

    const asset = this.mediaRepo.create({ s3Key: key, altText, uploadedBy: authorId, variants });
    const saved = await this.mediaRepo.save(asset);
    saved.url = url;
    saved.variantUrls = this.resolveVariantUrls(variants);
    return saved;
  }

  /**
   * Generates a thumbnail and a display-sized WebP variant of an
   * upload, via sharp. Deliberately best-effort per variant, same
   * fail-soft posture as this platform's AI integrations
   * (EmbeddingService, AiProposalService): if resizing fails for either
   * variant — an unusual/corrupt input, an animated GIF sharp handles
   * differently than expected, anything — the upload still succeeds
   * with just the original stored. A resize failure should degrade
   * gracefully to "no thumbnail, use the original," never block an
   * editor from publishing.
   *
   * Known limitation, stated plainly: an animated GIF's animation is
   * NOT preserved in its variants (sharp processes a single frame
   * unless told otherwise, and this doesn't ask for animated output) —
   * fine for what this platform actually uses hero images for, but
   * worth knowing if that assumption ever stops holding.
   */
  private async generateVariants(buffer: Buffer, originalKey: string): Promise<Record<string, string>> {
    const variants: Record<string, string> = {};

    try {
      const thumbnailBuffer = await sharp(buffer)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();
      const thumbnailStorageKey = variantKey(originalKey, 'thumbnail');
      await this.backend.store(thumbnailBuffer, thumbnailStorageKey, 'image/webp');
      variants.thumbnail = thumbnailStorageKey;
    } catch (err) {
      this.logger.warn(
        `Failed to generate thumbnail variant for '${originalKey}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    try {
      const displayBuffer = await sharp(buffer)
        .resize(DISPLAY_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      const displayStorageKey = variantKey(originalKey, 'display');
      await this.backend.store(displayBuffer, displayStorageKey, 'image/webp');
      variants.display = displayStorageKey;
    } catch (err) {
      this.logger.warn(
        `Failed to generate display variant for '${originalKey}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return variants;
  }

  private resolveVariantUrls(variants: Record<string, string>): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [label, key] of Object.entries(variants)) {
      resolved[label] = this.backend.resolveUrl(key);
    }
    return resolved;
  }

  async findById(id: string): Promise<MediaAsset> {
    const asset = await this.mediaRepo.findOne({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Media asset ${id} not found`);
    }
    asset.url = this.backend.resolveUrl(asset.s3Key);
    asset.variantUrls = this.resolveVariantUrls(asset.variants ?? {});
    return asset;
  }

  /** The media library view — every uploaded asset, most recent first,
   * so an editor can reuse an existing image instead of uploading a
   * duplicate. `limit`/`offset` are clamped rather than trusted as-is:
   * a negative offset or an over-large limit gets corrected to a sane
   * value instead of being passed straight to the query or rejected
   * outright — a slightly-wrong pagination request from the UI should
   * still return *something* sensible, not an error. */
  async findAll(limit: number = DEFAULT_LIBRARY_PAGE_SIZE, offset = 0): Promise<PaginatedMediaAssets> {
    const { limit: clampedLimit, offset: clampedOffset } = clampPagination(
      limit,
      offset,
      DEFAULT_LIBRARY_PAGE_SIZE,
      MAX_LIBRARY_PAGE_SIZE,
    );

    const [assets, total] = await this.mediaRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: clampedLimit,
      skip: clampedOffset,
    });

    return {
      items: assets.map((asset: MediaAsset) => {
        asset.url = this.backend.resolveUrl(asset.s3Key);
        asset.variantUrls = this.resolveVariantUrls(asset.variants ?? {});
        return asset;
      }),
      total,
      limit: clampedLimit,
      offset: clampedOffset,
    };
  }

  async updateAltText(id: string, altText: string): Promise<MediaAsset> {
    const asset = await this.mediaRepo.findOne({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Media asset ${id} not found`);
    }
    asset.altText = altText;
    const saved = await this.mediaRepo.save(asset);
    saved.url = this.backend.resolveUrl(saved.s3Key);
    saved.variantUrls = this.resolveVariantUrls(saved.variants ?? {});
    return saved;
  }

  /**
   * Deletes a media asset — the DB row first, storage cleanup second.
   *
   * `articles.hero_image_id` has a real foreign key to `media_assets`
   * (besbpo-blog-architecture/db/schema.sql), with no ON DELETE CASCADE
   * or SET NULL — so Postgres itself rejects deleting an asset that's
   * still some article's hero image, at the database level. That's
   * caught here (Postgres SQLSTATE 23503, foreign_key_violation) and
   * translated into a clear message instead of letting a raw driver
   * error leak to the API caller.
   *
   * Storage deletion happens only AFTER the DB delete succeeds, and is
   * best-effort (see StorageBackend.delete's doc comment): deleting the
   * DB row first means a failed storage cleanup only ever leaks a file
   * in the bucket (recoverable, and logged), never leaves a MediaAsset
   * row pointing at a file that's already gone (a broken reference
   * nothing would notice until someone tried to load it). Cleans up
   * every generated variant alongside the original — an asset with
   * resized variants that didn't get deleted would otherwise leak N
   * files per upload, not just one.
   */
  async delete(id: string): Promise<void> {
    const asset = await this.mediaRepo.findOne({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Media asset ${id} not found`);
    }

    try {
      await this.mediaRepo.delete(id);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? (err as { driverError?: { code?: string } })?.driverError?.code;
      if (code === '23503') {
        throw new ConflictException(
          `Cannot delete media asset ${id}: it is still used as the hero image on at least one article.`,
        );
      }
      throw err;
    }

    await this.backend.delete(asset.s3Key);
    const variantKeys: string[] = Object.values(asset.variants ?? {});
    for (const variantStorageKey of variantKeys) {
      await this.backend.delete(variantStorageKey);
    }
  }
}
