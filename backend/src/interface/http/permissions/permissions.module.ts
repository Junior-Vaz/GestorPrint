import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { CanAccessGuard } from './can-access.guard';

/**
 * @Global pra que `@CanAccess` decorator possa ser usado em QUALQUER módulo
 * sem precisar importar PermissionsModule manualmente — o guard depende do
 * PermissionsService injetável via DI.
 */
@Global()
@Module({
  controllers: [PermissionsController],
  providers:   [PermissionsService, CanAccessGuard],
  exports:     [PermissionsService, CanAccessGuard],
})
export class PermissionsModule {}
