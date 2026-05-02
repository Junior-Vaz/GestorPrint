import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuthModule } from '../auth/auth.module';
import { PlatformUsersModule } from '../platform-users/platform-users.module';

/**
 * AuditModule — só hospeda o controller (endpoints findAll/findOne/platform).
 * O AuditService que outros módulos consomem vive no SharedModule global.
 * Isso evita boilerplate (todo módulo importando AuditModule) e quebra
 * potencial de ciclo com AuthModule.
 *
 * PlatformUsersModule é importado pra trazer o PlatformOnlyGuard usado em
 * /audit/platform — endpoint reservado pra super admin via SaaS Admin.
 */
@Module({
  imports: [AuthModule, PlatformUsersModule],
  controllers: [AuditController],
})
export class AuditModule {}
