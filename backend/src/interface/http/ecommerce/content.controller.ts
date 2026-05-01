import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { BlogService } from './blog.service';
import { SiteContentService } from './site-content.service';

// ── Públicos (consumidos pela SPA) ─────────────────────────────────────────
@Public()
@Controller('ecommerce')
export class ContentPublicController {
  constructor(
    private readonly blog: BlogService,
    private readonly site: SiteContentService,
  ) {}

  @Get('blog')
  listPosts(
    @Query('tenantId') tenantIdQ?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.blog.listPublic(tenantId, { category, tag });
  }

  @Get('blog/:slug')
  getPost(@Param('slug') slug: string, @Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.blog.getPublic(tenantId, slug);
  }

  @Get('site')
  getSiteContent(@Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.site.get(tenantId);
  }
}

// ── Admin ──────────────────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireFeature(FeatureKey.ECOMMERCE)
@Controller('ecommerce/admin')
export class ContentAdminController {
  constructor(
    private readonly blog: BlogService,
    private readonly site: SiteContentService,
  ) {}

  // Blog
  @Get('blog')
  @CanAccess('ecommerce-blog', 'view')
  listPosts(
    @CurrentTenant() tenantId: number,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const page     = pageQ     ? parseInt(pageQ, 10)     : 1;
    const pageSize = pageSizeQ ? parseInt(pageSizeQ, 10) : 20;
    return this.blog.listAdmin(tenantId, page, pageSize);
  }

  @Get('blog/:id')
  @CanAccess('ecommerce-blog', 'view')
  getPost(@CurrentTenant() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.blog.getAdmin(tenantId, id);
  }

  @Post('blog')
  @CanAccess('ecommerce-blog', 'create')
  createPost(@CurrentTenant() tenantId: number, @Body() body: any) {
    return this.blog.create(tenantId, body);
  }

  @Patch('blog/:id')
  @CanAccess('ecommerce-blog', 'edit')
  updatePost(@CurrentTenant() tenantId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.blog.update(tenantId, id, body);
  }

  @Delete('blog/:id')
  @CanAccess('ecommerce-blog', 'delete')
  deletePost(@CurrentTenant() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.blog.delete(tenantId, id);
  }

  // SiteContent
  @Get('site')
  @CanAccess('ecommerce-site', 'view')
  getSite(@CurrentTenant() tenantId: number) { return this.site.get(tenantId); }

  @Patch('site')
  @CanAccess('ecommerce-site', 'edit')
  updateSite(@CurrentTenant() tenantId: number, @Body() body: any) {
    return this.site.update(tenantId, body);
  }
}
