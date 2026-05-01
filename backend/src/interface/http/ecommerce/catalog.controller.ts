import { Controller, Get, Param, Query } from '@nestjs/common';
import { EcommerceService } from './ecommerce.service';
import { Public } from '../auth/decorators/public.decorator';

/** Endpoints públicos do catálogo (sem auth) — consumidos pelo site da loja */
@Public()
@Controller('ecommerce')
export class CatalogController {
  constructor(private readonly svc: EcommerceService) {}

  @Get('products')
  listProducts(@Query() q: { category?: string; search?: string; tenantId?: string; page?: string; pageSize?: string }) {
    const tenantId = q.tenantId ? parseInt(q.tenantId, 10) : 1;
    const page     = q.page     ? parseInt(q.page, 10)     : 1;
    const pageSize = q.pageSize ? parseInt(q.pageSize, 10) : 24;
    return this.svc.listPublicProducts(tenantId, { category: q.category, search: q.search }, page, pageSize);
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string, @Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.svc.getPublicProduct(tenantId, slug);
  }

  @Get('categories')
  listCategories(@Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.svc.listPublicCategories(tenantId);
  }

  @Get('store-settings')
  getStoreSettings(@Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.svc.getPublicStoreSettings(tenantId);
  }

  @Get('store-stats')
  getStoreStats(@Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.svc.getStoreStats(tenantId);
  }
}
