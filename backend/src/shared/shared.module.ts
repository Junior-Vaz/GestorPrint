import { Module, Global } from '@nestjs/common';
import { PrismaService } from '../infrastructure/persistence/prisma/prisma.service';
import { CheckFeatureUseCase } from '../application/entitlement/check-feature.usecase';
import { PrismaEntitlementRepository } from '../infrastructure/entitlement/prisma-entitlement.repository';
import { ENTITLEMENT_REPOSITORY } from '../application/entitlement/entitlement-repository.interface';
import { FeatureGuard } from './guards/feature.guard';
import { PlatformSettingsService } from './platform-settings.service';
import { CredentialEncryptor } from './credential-encryptor.service';
import { AuditService } from '../interface/http/audit/audit.service';
// ai-provider.factory.ts não tem @Injectable — exporta funções puras.
// Outros services importam direto do path quando precisam.

/**
 * SharedModule — @Global()
 *
 * Exporta tudo que outros módulos precisam:
 *  - CheckFeatureUseCase → Use Case principal de feature gate
 *  - FeatureGuard → Guard usado pelo @RequireFeature decorator
 *  - PlatformSettingsService → leitura/escrita de configs (Asaas, SMTP, etc.)
 *  - CredentialEncryptor → AES-256-GCM pra geminiKey/evolutionKey/etc
 *  - AuditService → logAction(...) chamado por TODOS os modules que mutam
 *    estado sensível (auth, users, payments, etc). Disponibilizado aqui
 *    pra evitar boilerplate de importar AuditModule em cada caller +
 *    dependência circular com AuthModule.
 *
 * Por ser @Global(), basta importar SharedModule no AppModule.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: ENTITLEMENT_REPOSITORY,
      useClass: PrismaEntitlementRepository,
    },
    CheckFeatureUseCase,
    FeatureGuard,
    PlatformSettingsService,
    CredentialEncryptor,
    AuditService,
  ],
  exports: [
    CheckFeatureUseCase,
    FeatureGuard,
    PrismaService,
    PlatformSettingsService,
    CredentialEncryptor,
    AuditService,
  ],
})
export class SharedModule {}
