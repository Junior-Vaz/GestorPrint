import { Module } from '@nestjs/common';
import { PlatformSettingsController } from './platform-settings.controller';

/**
 * Wrapper module só pra registrar o controller.
 * O service em si vive em SharedModule (@Global) — então qualquer outro lugar
 * pode injetar `PlatformSettingsService` sem importar este módulo.
 */
@Module({
  controllers: [PlatformSettingsController],
})
export class PlatformSettingsModule {}
