export interface StoredFile {
  /** Relative key used to identify the file (relative path for local, object key for S3/MinIO) */
  storedPath: string;
  /** Public URL to serve to the frontend */
  publicUrl: string;
}

export interface IStorageProvider {
  /**
   * Persist a file buffer and return its stored reference.
   * @param buffer   Raw file bytes
   * @param tenantUuid  UUID of the tenant owning the file
   * @param originalName  Original filename (used for extension/naming)
   */
  save(buffer: Buffer, tenantUuid: string, originalName: string): Promise<StoredFile>;

  /** Resolve the public URL from a stored path */
  getUrl(storedPath: string): string;

  /**
   * Return the absolute filesystem path for local providers.
   * Remote providers (MinIO, S3) should throw — files are accessed via URL.
   */
  getAbsolutePath(storedPath: string): string;

  /** Remove the file from storage */
  delete(storedPath: string): Promise<void>;
}

export const STORAGE_PROVIDER = 'IStorageProvider';
