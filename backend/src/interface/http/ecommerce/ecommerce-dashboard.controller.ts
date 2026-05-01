import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { CanAccess } from '../permissions/can-access.decorator';
import { EcommerceDashboardService } from './ecommerce-dashboard.service';
import { MelhorEnviosService } from './melhor-envios.service';

/**
 * Endpoints admin do dashboard de ecommerce + utilitários do Melhor Envios.
 * Acesso controlado pela matriz RolePermission (`@CanAccess`) — admin pode
 * dar visibilidade do dashboard ou da consulta de saldo pra qualquer role.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireFeature(FeatureKey.ECOMMERCE)
@Controller('ecommerce/admin')
export class EcommerceDashboardController {
  constructor(
    private readonly dashboard: EcommerceDashboardService,
    private readonly me: MelhorEnviosService,
  ) {}

  /** Snapshot completo do dashboard — KPIs, status, top produtos, saldo ME. */
  @Get('dashboard')
  @CanAccess('ecommerce-dashboard', 'view')
  getDashboard(
    @CurrentTenant() tenantId: number,
    @Query('period') period?: string,
  ) {
    const validPeriods = ['7d', '30d', '90d', '12m'] as const;
    const p = (validPeriods as readonly string[]).includes(period as string)
      ? (period as '7d' | '30d' | '90d' | '12m')
      : '30d';
    return this.dashboard.getSnapshot(tenantId, p);
  }

  /** Saldo Melhor Envios (cacheado 60s). UI usa pra polling rápido. */
  @Get('melhor-envios/balance')
  @CanAccess('ecommerce-dashboard', 'view')
  getBalance(@CurrentTenant() tenantId: number) {
    return this.me.getBalance(tenantId);
  }

  /**
   * Força refresh do saldo (ignora cache). Usar depois que admin fez
   * recarga manual no painel ME pra ver o novo saldo refletido na hora.
   * Edit em vez de view porque é ação que custa request real ao ME.
   */
  @Post('melhor-envios/balance/refresh')
  @CanAccess('ecommerce-dashboard', 'edit')
  refreshBalance(@CurrentTenant() tenantId: number) {
    return this.me.getBalance(tenantId, /* force */ true);
  }
}
