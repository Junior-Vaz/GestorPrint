import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsModule } from '../products/products.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ProductsModule, SettingsModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway, PrismaService],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
