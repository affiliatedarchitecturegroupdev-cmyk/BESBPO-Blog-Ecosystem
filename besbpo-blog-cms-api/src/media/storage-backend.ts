import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Where an uploaded file's bytes actually get written, and how to
 * resolve a stored key back to a URL — both on the SAME interface (not
 * split across a write-time and a separate read-time helper) so there is
 * exactly one place that knows how a given backend's keys become URLs,
 * rather than two implementations of that logic that could drift apart.
 *
 * Two implementations:
 *  - S3StorageBackend: real deployments (Doc-04 Section 4/5) — used when
 *    AWS_S3_BUCKET is configured.
 *  - LocalFilesystemStorageBackend: the fallback when it isn't — same
 *    fixture/heuristic-fallback philosophy as the rest of this platform,
 *    so `npm run dev` can exercise the upload flow without real AWS
 *    credentials. NOT suitable for anything beyond local dev — see that
 *    class's own doc comment for why.
 */
export interface StorageBackend {
  store(buffer: Buffer, key: string, contentType: string): Promise<string>;
  resolveUrl(key: string): string;
  /** Best-effort — callers should not fail the overall operation solely
   * because storage cleanup failed (see MediaService.delete: the DB row
   * is the source of truth for "does this asset still exist"; a failed
   * storage delete after a successful DB delete leaks a file, which is
   * recoverable, rather than leaving a broken reference, which isn't). */
  delete(key: string): Promise<void>;
}

@Injectable()
export class S3StorageBackend implements StorageBackend {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? '';
    this.region = this.config.get<string>('AWS_REGION') ?? 'af-south-1';
    this.client = new S3Client({ region: this.region });
    // Set this if the bucket sits behind a CDN/custom domain (Doc-04
    // Section 4) — otherwise resolveUrl falls back to the bucket's own
    // regional S3 endpoint URL, which works but isn't what you'd
    // actually want to serve production traffic from.
    this.publicBaseUrl = this.config.get<string>('AWS_S3_PUBLIC_BASE_URL');
  }

  async store(buffer: Buffer, key: string, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return this.resolveUrl(key);
  }

  resolveUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

@Injectable()
export class LocalFilesystemStorageBackend implements StorageBackend {
  private readonly logger = new Logger(LocalFilesystemStorageBackend.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  async store(buffer: Buffer, key: string, _contentType: string): Promise<string> {
    // NOT suitable for anything beyond local dev: this directory lives on
    // the container's ephemeral filesystem — a redeploy or restart on
    // Coolify wipes it, and nothing here serves these files back over
    // HTTP either (that would need a static-file route added to
    // main.ts, deliberately not added, since adding it would make this
    // fallback look more production-ready than it actually is).
    this.logger.warn(
      `Storing '${key}' on local disk — AWS_S3_BUCKET is not configured. This is a local-dev-only ` +
        'fallback; the file will not survive a redeploy and is not served back over HTTP.',
    );
    await mkdir(this.uploadsDir, { recursive: true });
    await writeFile(join(this.uploadsDir, key.replace(/\//g, '_')), buffer);
    return this.resolveUrl(key);
  }

  resolveUrl(key: string): string {
    return `file://${join(this.uploadsDir, key.replace(/\//g, '_'))}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.uploadsDir, key.replace(/\//g, '_')));
    } catch (err) {
      // ENOENT (already gone) is fine — delete is meant to be idempotent,
      // "this file no longer exists" is a success state, not a failure.
      // Anything else gets logged but still doesn't throw, matching this
      // method's documented best-effort contract on the interface.
      const code = (err as { code?: string })?.code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Failed to delete local file for key '${key}': ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
