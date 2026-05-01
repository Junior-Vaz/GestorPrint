import { Injectable } from '@nestjs/common';
import { IStorageProvider, StoredFile } from './storage.interface';

/**
 * MinIO / S3 storage adapter — STUB (not yet implemented).
 *
 * Required env vars when active:
 *   MINIO_ENDPOINT      e.g. http://localhost:9000
 *   MINIO_BUCKET        e.g. gestorprint
 *   MINIO_ACCESS_KEY    e.g. minioadmin
 *   MINIO_SECRET_KEY    e.g. minioadmin
 *
 * Set STORAGE_PROVIDER=minio to activate.
 */
@Injectable()
export class MinioStorageProvider implements IStorageProvider {
  async save(_buffer: Buffer, _tenantUuid: string, _originalName: string): Promise<StoredFile> {
    throw new Error('MinioStorageProvider: not implemented. Set STORAGE_PROVIDER=local or implement this adapter.');
  }

  getUrl(_storedPath: string): string {
    throw new Error('MinioStorageProvider: not implemented.');
  }

  getAbsolutePath(_storedPath: string): string {
    throw new Error('MinioStorageProvider: remote storage has no local filesystem path.');
  }

  async delete(_storedPath: string): Promise<void> {
    throw new Error('MinioStorageProvider: not implemented.');
  }
}
