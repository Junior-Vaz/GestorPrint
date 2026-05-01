import { Global, Module } from '@nestjs/common';
import { LocalStorageProvider } from './local-storage.provider';
import { MinioStorageProvider } from './minio-storage.provider';
import { STORAGE_PROVIDER } from './storage.interface';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass:
        process.env.STORAGE_PROVIDER === 'minio'
          ? MinioStorageProvider
          : LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
