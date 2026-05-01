import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { CouponsService } from './coupons.service';

// ── Público — validação no checkout ────────────────────────────────────────
@Public()
@Controller('ecommerce/coupons')
export class CouponsPublicController {
  constructor(private readonly svc: CouponsService) {}

  @Post('validate')
  validate(
    @Body() body: { code: string; subtotal: number; shippingCost?: number; customerId?: number },
    @Query('tenantId') tenantIdQ?: string,
  ) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.svc.validate(
      tenantId,
      body.code,
      Number(body.subtotal || 0),
      Number(body.shippingCost || 0),
      body.customerId,
    );
  }
}

// ── Admin ──────────────────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireFeature(FeatureKey.ECOMMERCE)
@Controller('ecommerce/admin/coupons')
export class CouponsAdminController {
  constructor(private readonly svc: CouponsService) {}

  @Get()
  @CanAccess('ecommerce-coupons', 'view')
  list(
    @CurrentTenant() tenantId: number,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const page     = pageQ     ? parseInt(pageQ, 10)     : 1;
    const pageSize = pageSizeQ ? parseInt(pageSizeQ, 10) : 20;
    return this.svc.list(tenantId, page, pageSize);
  }

  @Get(':id')
  @CanAccess('ecommerce-coupons', 'view')
  getOne(@CurrentTenant() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.getOne(tenantId, id);
  }

  @Post()
  @CanAccess('ecommerce-coupons', 'create')
  create(@CurrentTenant() tenantId: number, @Body() body: any) {
    return this.svc.create(tenantId, body);
  }

  @Patch(':id')
  @CanAccess('ecommerce-coupons', 'edit')
  update(@CurrentTenant() tenantId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.update(tenantId, id, body);
  }

  @Delete(':id')
  @CanAccess('ecommerce-coupons', 'delete')
  remove(@CurrentTenant() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.delete(tenantId, id);
  }
}
