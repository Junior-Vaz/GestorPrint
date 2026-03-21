import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { EstimatesModule } from '../estimates/estimates.module';
import { PaymentsModule } from '../payments/payments.module';
import { FilesModule } from '../files/files.module';
import { PlansModule } from '../plans/plans.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [ProductsModule, OrdersModule, EstimatesModule, PaymentsModule, FilesModule, PlansModule],
  controllers: [McpController],
  providers: [McpService, PrismaService],
})
export class McpModule {}
