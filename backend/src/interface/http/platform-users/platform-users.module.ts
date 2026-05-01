import { Module } from '@nestjs/common';
import { PlatformUsersController } from './platform-users.controller';
import { PlatformOnlyGuard } from './platform-only.guard';

/**
 * Módulo dedicado pra gestão da equipe da plataforma SaaS (PLATFORM users).
 * Endpoints expostos em /api/platform-users — só acessíveis pelo SaaS Admin
 * Panel via JWT de PLATFORM user.
 */
@Module({
  controllers: [PlatformUsersController],
  providers: [PlatformOnlyGuard],
  exports: [PlatformOnlyGuard],
})
export class PlatformUsersModule {}
