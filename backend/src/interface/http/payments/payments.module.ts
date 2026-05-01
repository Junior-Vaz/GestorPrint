import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { ProcessPaymentUseCase } from '../../../application/payments/process-payment.usecase';
import { MercadoPagoGateway } from '../../../infrastructure/payments/mercadopago.gateway';
import { PrismaPaymentRepository } from '../../../infrastructure/payments/prisma-payment.repository';
import {
  MERCADO_PAGO_GATEWAY,
  PAYMENT_REPOSITORY,
} from '../../../application/payments/payment-repository.interface';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [OrdersModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    ProcessPaymentUseCase,
    { provide: MERCADO_PAGO_GATEWAY, useClass: MercadoPagoGateway },
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
