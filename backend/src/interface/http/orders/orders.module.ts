import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from '../../websocket/orders.gateway';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { ProductsModule } from '../products/products.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ManageOrderUseCase } from '../../../application/orders/manage-order.usecase';
import { PrismaOrderRepository } from '../../../infrastructure/orders/prisma-order.repository';
import { ORDER_REPOSITORY } from '../../../application/orders/order-repository.interface';

@Module({
  imports: [ProductsModule, SettingsModule, NotificationsModule, AuditModule, LoyaltyModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersGateway,
    PrismaService,
    ManageOrderUseCase,
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
  ],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
