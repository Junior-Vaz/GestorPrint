import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { ManageSubscriptionUseCase } from '../../../application/billing/manage-subscription.usecase';
import { PrismaBillingRepository } from '../../../infrastructure/billing/prisma-billing.repository';
import { AsaasGateway } from '../../../infrastructure/billing/asaas.gateway';
import {
  BILLING_REPOSITORY,
  ASAAS_GATEWAY,
} from '../../../application/billing/billing-repository.interface';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    ManageSubscriptionUseCase,
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
    { provide: ASAAS_GATEWAY, useClass: AsaasGateway },
  ],
  exports: [BillingService],
})
export class BillingModule {}
