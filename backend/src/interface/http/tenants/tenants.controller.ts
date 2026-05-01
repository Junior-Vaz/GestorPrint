import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';

/**
 * Endpoints de gerenciamento de Tenants (Super-Admin SaaS).
 * Apenas usuários com role ADMIN podem acessar.
 */
@ApiTags('tenants')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @CanAccess('settings', 'view')
  findAll(
    @Query('page')     pageQ?:     string,
    @Query('pageSize') pageSizeQ?: string,
    @Query('search')   search?:    string,
    @Query('status')   status?:    string,
    @Query('plan')     plan?:      string,
    @Query('scope')    scope?:     string,
  ) {
    // scope: 'clients' (default — gráficas reais), 'platform' (só tenant 1),
    // 'all' (tudo). Sanitiza o input pra evitar enum-injection inesperado.
    const safeScope = scope === 'platform' || scope === 'all' ? scope : 'clients';
    return this.tenantsService.findAll({
      page:     pageQ     ? parseInt(pageQ, 10)     : 1,
      pageSize: pageSizeQ ? parseInt(pageSizeQ, 10) : 20,
      search,
      status,
      plan,
      scope: safeScope,
    });
  }

  @Get('dashboard')
  @CanAccess('settings', 'view')
  getDashboard() {
    return this.tenantsService.getDashboard();
  }

  @Get('dashboard/mrr-history')
  @CanAccess('settings', 'view')
  getMrrHistory(@Query('months') monthsQ?: string) {
    const months = monthsQ ? Math.min(36, Math.max(1, parseInt(monthsQ, 10) || 12)) : 12;
    return this.tenantsService.getMrrHistory(months);
  }

  @Get(':id')
  @CanAccess('settings', 'view')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(+id);
  }

  @Get(':id/usage')
  @CanAccess('settings', 'view')
  getUsage(@Param('id') id: string) {
    return this.tenantsService.getUsage(+id);
  }

  @Get(':id/activity')
  @CanAccess('settings', 'view')
  getActivity(
    @Param('id') id: string,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const page     = pageQ     ? parseInt(pageQ, 10)     : 1;
    const pageSize = pageSizeQ ? parseInt(pageSizeQ, 10) : 30;
    return this.tenantsService.listActivity(+id, page, pageSize);
  }

  @Get(':id/subscription')
  @CanAccess('settings', 'view')
  getSubscription(@Param('id') id: string) {
    return this.tenantsService.getSubscription(+id);
  }

  @Post()
  @CanAccess('settings', 'create')
  create(@Body() body: CreateTenantDto) {
    return this.tenantsService.create(body);
  }

  @Patch(':id')
  @CanAccess('settings', 'edit')
  update(@Param('id') id: string, @Body() body: UpdateTenantDto) {
    return this.tenantsService.update(+id, body);
  }

  @Patch(':id/suspend')
  @CanAccess('settings', 'edit')
  suspend(@Param('id') id: string) {
    return this.tenantsService.suspend(+id);
  }

  @Patch(':id/activate')
  @CanAccess('settings', 'edit')
  activate(@Param('id') id: string) {
    return this.tenantsService.activate(+id);
  }

  @Post(':id/admin-user')
  @CanAccess('settings', 'create')
  createAdminUser(@Param('id') id: string, @Body() body: CreateTenantAdminDto) {
    return this.tenantsService.createAdminUser(+id, body);
  }

  // ── Feature Overrides ─────────────────────────────────────────────────────
  @Get(':id/features')
  @CanAccess('settings', 'view')
  listFeatures(@Param('id') id: string) {
    return this.tenantsService.listFeatureOverrides(+id);
  }

  @Patch(':id/features/:feature')
  @CanAccess('settings', 'edit')
  upsertFeature(
    @Param('id') id: string,
    @Param('feature') feature: string,
    @Body() body: { granted: boolean; reason?: string; expiresAt?: string | null },
  ) {
    return this.tenantsService.upsertFeatureOverride(+id, feature, body.granted, body.reason, body.expiresAt);
  }

  @Patch(':id/features/:feature/reset')
  @CanAccess('settings', 'edit')
  resetFeature(@Param('id') id: string, @Param('feature') feature: string) {
    return this.tenantsService.removeFeatureOverride(+id, feature);
  }

  // ── Impersonate ───────────────────────────────────────────────────────────
  /**
   * Gera token JWT de 15 min que o super admin usa pra abrir o ERP no contexto
   * desse tenant. Apenas super admin (isSuperAdmin=true) pode chamar.
   */
  @Post(':id/impersonate')
  @CanAccess('settings', 'edit')
  impersonate(@Param('id') id: string, @Req() req: any) {
    const u = req?.user;
    if (!u || !u.isSuperAdmin) {
      throw new ForbiddenException('Apenas o super admin pode impersonar tenants');
    }
    return this.tenantsService.generateImpersonationToken(+id, u.id);
  }
}
