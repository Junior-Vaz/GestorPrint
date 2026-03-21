import { Module } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { EstimatesController } from './estimates.controller';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsModule } from '../payments/payments.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [OrdersModule, SettingsModule, PaymentsModule, MessagingModule, NotificationsModule, PlansModule],
  controllers: [EstimatesController],
  providers: [EstimatesService, PrismaService],
  exports: [EstimatesService],
})
export class EstimatesModule {}
