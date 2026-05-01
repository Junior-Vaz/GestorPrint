import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { CustomerAuthGuard, CurrentCustomer } from './customer-auth.guard';
import { ReviewsService } from './reviews.service';

// ── Públicos (no produto) ──────────────────────────────────────────────────
@Public()
@Controller('ecommerce/products')
export class ReviewsPublicController {
  constructor(private readonly svc: ReviewsService) {}

  @Get(':id/reviews')
  list(
    @Param('id', ParseIntPipe) productId: number,
    @Query('tenantId') tenantIdQ?: string,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    const page     = pageQ     ? parseInt(pageQ, 10)     : 1;
    const pageSize = pageSizeQ ? parseInt(pageSizeQ, 10) : 10;
    return this.svc.listForProduct(tenantId, productId, page, pageSize);
  }
}

// ── Reviews em destaque (pra home) ─────────────────────────────────────────
@Public()
@Controller('ecommerce/reviews')
export class ReviewsFeaturedController {
  constructor(private readonly svc: ReviewsService) {}

  @Get('featured')
  featured(@Query('tenantId') tenantIdQ?: string, @Query('limit') limitQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    const limit = limitQ ? Math.min(20, parseInt(limitQ, 10)) : 6;
    return this.svc.listFeatured(tenantId, limit);
  }
}

// ── Customer (autenticado) ─────────────────────────────────────────────────
@Public()
@UseGuards(CustomerAuthGuard)
@Controller('ecommerce/customer/reviews')
export class ReviewsCustomerController {
  constructor(private readonly svc: ReviewsService) {}

  @Get()
  listMine(@CurrentCustomer('sub') customerId: number) {
    return this.svc.listMyReviews(customerId);
  }

  @Post()
  create(@CurrentCustomer() c: any, @Body() body: any) {
    return this.svc.createForCustomer(c.sub, c.tenantId, body);
  }

  @Delete(':id')
  remove(@CurrentCustomer('sub') customerId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteMyReview(customerId, id);
  }
}

// ── Admin (moderação) ──────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireFeature(FeatureKey.ECOMMERCE)
@Controller('ecommerce/admin/reviews')
export class ReviewsAdminController {
  constructor(private readonly svc: ReviewsService) {}

  @Get()
  @CanAccess('ecommerce-reviews', 'view')
  list(
    @CurrentTenant() tenantId: number,
    @Query('status') status?: string,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const page     = pageQ     ? parseInt(pageQ, 10)     : 1;
    const pageSize = pageSizeQ ? parseInt(pageSizeQ, 10) : 20;
    return this.svc.listAdmin(tenantId, status, page, pageSize);
  }

  @Patch(':id/status')
  @CanAccess('ecommerce-reviews', 'edit')
  updateStatus(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.svc.updateStatus(tenantId, id, body.status);
  }

  @Delete(':id')
  @CanAccess('ecommerce-reviews', 'delete')
  remove(@CurrentTenant() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteAdmin(tenantId, id);
  }
}
