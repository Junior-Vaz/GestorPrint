import { Controller, Get, Patch, Param, Body, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { EcommerceService } from './ecommerce.service';
import { UpdateProductStoreDto } from './dto/update-product-store.dto';
import { UpdateCategoryStoreDto } from './dto/update-category-store.dto';

/** Endpoints admin pra gerir o que aparece na loja — exige feature ECOMMERCE */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireFeature(FeatureKey.ECOMMERCE)
@Controller('ecommerce/admin')
export class CatalogAdminController {
  constructor(private readonly svc: EcommerceService) {}

  @Get('products')
  @CanAccess('ecommerce-catalog', 'view')
  listProducts(
    @CurrentTenant() tenantId: number,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const page     = pageQ     ? parseInt(pageQ, 10)     : 1;
    const pageSize = pageSizeQ ? parseInt(pageSizeQ, 10) : 50;
    return this.svc.listAdminProducts(tenantId, page, pageSize);
  }

  @Get('categories')
  @CanAccess('ecommerce-catalog', 'view')
  listCategories(@CurrentTenant() tenantId: number) {
    return this.svc.listAdminCategories(tenantId);
  }

  @Get('stock-alerts')
  @CanAccess('ecommerce-catalog', 'view')
  stockAlerts(@CurrentTenant() tenantId: number) {
    return this.svc.listStockAlerts(tenantId);
  }

  @Patch('products/:id/store')
  @CanAccess('ecommerce-catalog', 'edit')
  updateProductStore(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProductStoreDto,
    @CurrentTenant() tenantId: number,
  ) {
    return this.svc.updateProductStore(id, tenantId, body);
  }

  @Patch('categories/:id/store')
  @CanAccess('ecommerce-catalog', 'edit')
  updateCategoryStore(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCategoryStoreDto,
    @CurrentTenant() tenantId: number,
  ) {
    return this.svc.updateCategoryStore(id, tenantId, body);
  }

  // ── Settings da loja ────────────────────────────────────────────────────────
  @Get('settings')
  @CanAccess('ecommerce-settings', 'view')
  getSettings(@CurrentTenant() tenantId: number) {
    return this.svc.getStoreSettings(tenantId);
  }

  @Patch('settings')
  @CanAccess('ecommerce-settings', 'edit')
  updateSettings(@Body() body: any, @CurrentTenant() tenantId: number) {
    return this.svc.updateStoreSettings(tenantId, body);
  }
}
