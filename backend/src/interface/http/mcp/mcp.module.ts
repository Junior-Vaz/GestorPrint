import { Module, forwardRef } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { EstimatesModule } from '../estimates/estimates.module';
import { PaymentsModule } from '../payments/payments.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomersModule } from '../customers/customers.module';
import { ReceivablesModule } from '../receivables/receivables.module';
import { PayablesModule } from '../payables/payables.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Module({
  imports: [
    ProductsModule,
    OrdersModule,
    EstimatesModule,
    PaymentsModule,
    FilesModule,
    NotificationsModule,
    // Tools executoras (criar cliente, registrar pagamento, lançar despesa, etc)
    CustomersModule,
    ReceivablesModule,
    PayablesModule,
    ExpensesModule,
    SuppliersModule,
    MessagingModule,
  ],
  controllers: [McpController],
  providers: [McpService, PrismaService],
  exports: [McpService],
})
export class McpModule {}
