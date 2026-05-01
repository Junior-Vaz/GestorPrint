import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';

// ── Modules now in src/interface/http/ ──────────────────────────────────────
import { PlansModule } from './interface/http/plans/plans.module';
import { TenantsModule } from './interface/http/tenants/tenants.module';
import { CustomersModule } from './interface/http/customers/customers.module';
import { SettingsModule } from './interface/http/settings/settings.module';
import { UsersModule } from './interface/http/users/users.module';
import { MessagingModule } from './interface/http/messaging/messaging.module';
import { SuppliersModule } from './interface/http/suppliers/suppliers.module';
import { ProductTypesModule } from './interface/http/product-types/product-types.module';
import { BillingModule } from './interface/http/billing/billing.module';
import { NotificationsModule } from './interface/http/notifications/notifications.module';
import { AuditModule } from './interface/http/audit/audit.module';
import { ProductsModule } from './interface/http/products/products.module';
import { OrdersModule } from './interface/http/orders/orders.module';
import { PaymentsModule } from './interface/http/payments/payments.module';
import { EstimatesModule } from './interface/http/estimates/estimates.module';
import { FilesModule } from './interface/http/files/files.module';
import { ReportsModule } from './interface/http/reports/reports.module';
import { ExpensesModule } from './interface/http/expenses/expenses.module';

import { AuthModule } from './interface/http/auth/auth.module';
import { McpModule } from './interface/http/mcp/mcp.module';
import { AiChatModule } from './interface/http/ai-chat/ai-chat.module';
import { WhatsappModule } from './interface/http/whatsapp/whatsapp.module';
import { LogsModule } from './interface/http/logs/logs.module';
import { ReceivablesModule } from './interface/http/receivables/receivables.module';
import { PayablesModule } from './interface/http/payables/payables.module';
import { EcommerceModule } from './interface/http/ecommerce/ecommerce.module';
import { PlatformSettingsModule } from './interface/http/platform-settings/platform-settings.module';
import { PresenceModule } from './interface/websocket/presence.module';
import { PermissionsModule } from './interface/http/permissions/permissions.module';
import { LoyaltyModule } from './interface/http/loyalty/loyalty.module';
import { PlatformUsersModule } from './interface/http/platform-users/platform-users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 20  },
      { name: 'medium', ttl: 60000, limit: 300 },
    ]),
    SharedModule,
    StorageModule,
    PlansModule,
    TenantsModule,
    CustomersModule,
    SettingsModule,
    UsersModule,
    MessagingModule,
    SuppliersModule,
    ProductTypesModule,
    BillingModule,
    NotificationsModule,
    AuditModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    EstimatesModule,
    FilesModule,
    ReportsModule,
    ExpensesModule,
    ReceivablesModule,
    PayablesModule,
    AuthModule,
    McpModule,
    AiChatModule,
    WhatsappModule,
    LogsModule,
    PlatformSettingsModule,
    EcommerceModule,
    PresenceModule,
    PermissionsModule,
    LoyaltyModule,
    PlatformUsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
