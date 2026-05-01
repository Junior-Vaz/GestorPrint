import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { IStorageProvider, StoredFile } from './storage.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly uploadRoot = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true });
    }
  }

  async save(buffer: Buffer, tenantUuid: string, originalName: string): Promise<StoredFile> {
    const tenantDir = path.join(this.uploadRoot, tenantUuid);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    const filename = `${Date.now()}-${originalName}`;
    const storedPath = `${tenantUuid}/${filename}`;
    fs.writeFileSync(path.join(this.uploadRoot, storedPath), buffer);

    return {
      storedPath,
      publicUrl: this.getUrl(storedPath),
    };
  }

  getUrl(storedPath: string): string {
    return `/api/files/${storedPath}`;
  }

  getAbsolutePath(storedPath: string): string {
    return path.join(this.uploadRoot, storedPath);
  }

  async delete(storedPath: string): Promise<void> {
    const absPath = this.getAbsolutePath(storedPath);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  }
}
