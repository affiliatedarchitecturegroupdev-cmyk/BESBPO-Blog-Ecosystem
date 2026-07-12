import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// Maps to media_assets in besbpo-blog-architecture/db/schema.sql. `variants`
// (JSONB, e.g. { "thumbnail": "...", "webp_1200": "..." }) is intentionally
// unused by anything that writes to this table today — no transcoding
// pipeline exists yet (besbpo-blog-search-media-svc's media.rs is still a
// pure interface, deliberately deferred; see that repo's README for why).
// This entity only ever writes the ORIGINAL uploaded file's key to `s3Key`
// and leaves `variants` at its schema default ('{}'). Doc-03's full vision
// for this table — multiple optimised size/format variants — is real
// future work, not something this pass pretends to have done.
//
// uploadedBy is a raw UUID-as-string column with no @ManyToOne relation,
// matching Article.authorId's existing pattern — there's no Author entity
// built in this codebase yet either (see that column's own comment).
@Entity('media_assets')
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 's3_key' })
  s3Key: string;

  /**
   * Maps a variant label (e.g. "thumbnail", "display") to that variant's
   * STORAGE KEY — not a URL. This deliberately differs from this
   * column's originally-illustrative comment in schema.sql (which showed
   * URL-shaped example values); storing keys and resolving them to URLs
   * at read time, exactly like `s3Key` already works, keeps ONE
   * mechanism for that resolution instead of two, and — the concrete
   * reason it matters — lets MediaService.delete find each variant's key
   * to actually remove it from storage. A URL alone can't be reversed
   * back into a key reliably.
   */
  @Column({ type: 'jsonb', default: {} })
  variants: Record<string, string>;

  @Column({ name: 'alt_text', nullable: true })
  altText?: string;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * NOT a database column — resolved by MediaService at read/write time
   * from `s3Key` plus whichever StorageBackend is configured (S3 public
   * URL, or a local dev path). Included on the entity instance so
   * controllers/DTOs can serialise it without every caller needing to
   * know how to construct it themselves.
   */
  url?: string;

  /** NOT a database column — `variants` (the key map, above) resolved to
   * actual URLs the same way `url` is, so the frontend never needs to
   * know that `variants` stores keys rather than URLs. */
  variantUrls?: Record<string, string>;
}
