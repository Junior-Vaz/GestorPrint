import { Module } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { EstimatesController } from './estimates.controller';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsModule } from '../payments/payments.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConvertEstimateUseCase } from '../../../application/estimates/convert-estimate.usecase';
import { PrismaEstimateRepository } from '../../../infrastructure/estimates/prisma-estimate.repository';
import { ESTIMATE_REPOSITORY } from '../../../application/estimates/estimate-repository.interface';

@Module({
  imports: [OrdersModule, SettingsModule, PaymentsModule, MessagingModule, NotificationsModule],
  controllers: [EstimatesController],
  providers: [
    EstimatesService,
    PrismaService,
    PrismaEstimateRepository,
    ConvertEstimateUseCase,
    { provide: ESTIMATE_REPOSITORY, useClass: PrismaEstimateRepository },
  ],
  exports: [EstimatesService],
})
export class EstimatesModule {}
