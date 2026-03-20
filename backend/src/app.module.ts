import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantsModule } from './tenants/tenants.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaService } from './prisma/prisma.service';
import { ProductsModule } from './products/products.module';
import { EstimatesModule } from './estimates/estimates.module';
import { CustomersModule } from './customers/customers.module';
import { SettingsModule } from './settings/settings.module';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { MessagingModule } from './messaging/messaging.module';
import { ExpensesModule } from './expenses/expenses.module';
import { FilesModule } from './files/files.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductTypesModule } from './product-types/product-types.module';
import { NotificationsModule } from './notifications/notifications.module';
import { McpModule } from './mcp/mcp.module';
import { AuditModule } from './audit/audit.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    TenantsModule,
    OrdersModule,
    ProductsModule,
    EstimatesModule,
    CustomersModule,
    SettingsModule,
    AuthModule,
    PaymentsModule,
    FilesModule,
    UsersModule, // UsersModule was before ReportsModule, keeping its original position relative to others not explicitly moved.
    ReportsModule,
    MessagingModule,
    ExpensesModule,
    SuppliersModule,
    ProductTypesModule,
    NotificationsModule,
    McpModule,
    AuditModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
