import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantsExpiryTask } from './tenants-expiry.task';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { resolveJwtSecret } from '../../../shared/jwt-secret';

@Module({
  // Importa JwtModule pra TenantsService poder gerar tokens (impersonate).
  // `secret` deve bater com auth.module pra os tokens serem aceitos pelo JwtAuthGuard.
  imports: [
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsExpiryTask, PrismaService],
  exports: [TenantsService],
})
export class TenantsModule {}
