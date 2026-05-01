import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { CatalogController } from './catalog.controller';
import { CatalogAdminController } from './catalog-admin.controller';
import { EcommerceOrdersController } from './ecommerce-orders.controller';
import { ShippingController } from './shipping.controller';
import { CustomerAuthController } from './customer-auth.controller';
import { EcommerceOrdersAdminController } from './ecommerce-orders-admin.controller';
import { ContentPublicController, ContentAdminController } from './content.controller';
import { ReviewsPublicController, ReviewsCustomerController, ReviewsAdminController, ReviewsFeaturedController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { CouponsPublicController, CouponsAdminController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { TenantResolverPublicController, TenantDomainAdminController } from './tenant-resolver.controller';
import { ContactController } from './contact.controller';
import { SeoController } from './seo.controller';
import { OrderAttachmentsController } from './order-attachments.controller';
import { EcommerceDashboardController } from './ecommerce-dashboard.controller';
import { EcommerceLoyaltyController } from './ecommerce-loyalty.controller';
import { EcommerceDashboardService } from './ecommerce-dashboard.service';
import { MelhorEnviosService } from './melhor-envios.service';
import { EcommerceService } from './ecommerce.service';
import { EcommerceOrdersService } from './ecommerce-orders.service';
import { EcommerceOrdersAdminService } from './ecommerce-orders-admin.service';
import { EcommerceMailerService } from './ecommerce-mailer.service';
import { ShippingService } from './shipping.service';
import { TrackingService } from './tracking.service';
import { LabelService } from './label.service';
import { BlogService } from './blog.service';
import { SiteContentService } from './site-content.service';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAreaService } from './customer-area.service';
import { CustomerAuthGuard } from './customer-auth.guard';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { MercadoPagoGateway } from '../../../infrastructure/payments/mercadopago.gateway';
import { MessagingService } from '../messaging/messaging.service';

@Module({
  imports: [FilesModule, LoyaltyModule],
  controllers: [
    CatalogController,
    CatalogAdminController,
    EcommerceOrdersController,
    EcommerceOrdersAdminController,
    ShippingController,
    CustomerAuthController,
    ContentPublicController,
    ContentAdminController,
    ReviewsPublicController,
    ReviewsCustomerController,
    ReviewsAdminController,
    ReviewsFeaturedController,
    CouponsPublicController,
    CouponsAdminController,
    TenantResolverPublicController,
    TenantDomainAdminController,
    ContactController,
    SeoController,
    OrderAttachmentsController,
    EcommerceDashboardController,
    EcommerceLoyaltyController,
  ],
  providers: [
    EcommerceService,
    EcommerceOrdersService,
    EcommerceOrdersAdminService,
    EcommerceMailerService,
    ShippingService,
    TrackingService,
    LabelService,
    MelhorEnviosService,
    EcommerceDashboardService,
    BlogService,
    SiteContentService,
    ReviewsService,
    CouponsService,
    CustomerAuthService,
    CustomerAreaService,
    CustomerAuthGuard,
    MercadoPagoGateway,
    MessagingService,
    PrismaService,
  ],
  exports: [EcommerceService, EcommerceOrdersService, ShippingService, CustomerAuthService],
})
export class EcommerceModule {}
