import {
  Controller, Get, Put, Post, Param, Body, Query, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CanAccess } from '../permissions/can-access.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { LoyaltyService } from './loyalty.service';
import {
  UpdateLoyaltyConfigDto, AdjustLoyaltyDto, PreviewRedeemDto,
} from './dto/loyalty-config.dto';

/**
 * Endpoints do Programa de Fidelidade.
 *
 * Todos gateados por:
 *  - JwtAuthGuard (auth obrigatória)
 *  - @RequireFeature(LOYALTY_PROGRAM) (plano BASIC+)
 *  - @CanAccess (role permission — operador/admin)
 *
 * Endpoints públicos (consulta de saldo pelo cliente final via Ecommerce auth)
 * ficam em ecommerce/loyalty.controller.ts (a criar quando integrarmos a SPA).
 */
@ApiTags('loyalty')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@RequireFeature(FeatureKey.LOYALTY_PROGRAM)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly service: LoyaltyService) {}

  // ─── Config (gateada por permissão `loyalty` — independente de `settings`) ──
  // Decisão: separamos `loyalty` de `settings` pra permitir que um admin que
  // não gerencia configurações gerais (SMTP, dados da empresa) ainda possa
  // operar o programa de fidelidade. Hoje ADMIN tem ambas, mas o RBAC
  // permite cenários customizados no futuro.

  @Get('config')
  @CanAccess('loyalty', 'view')
  @ApiOperation({ summary: 'Lê config de fidelidade do tenant (com defaults se não setado)' })
  getConfig(@CurrentTenant() tenantId: number) {
    return this.service.getConfig(tenantId);
  }

  @Put('config')
  @CanAccess('loyalty', 'edit')
  @ApiOperation({ summary: 'Atualiza config de fidelidade' })
  updateConfig(@CurrentTenant() tenantId: number, @Body() dto: UpdateLoyaltyConfigDto) {
    return this.service.updateConfig(tenantId, dto);
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @CanAccess('loyalty', 'view')
  @ApiOperation({ summary: 'KPIs + top clientes + distribuição de tiers + fluxo de pontos' })
  getDashboard(@CurrentTenant() tenantId: number) {
    return this.service.getDashboard(tenantId);
  }

  // ─── Cliente: saldo + extrato ─────────────────────────────────────────────
  // Visualização do saldo/extrato exige `loyalty.view` (permissão da feature).
  // SALES não tem o resource `loyalty` por padrão — saldo aparece no
  // detalhe do cliente apenas pra quem opera o programa.

  @Get('customers/:customerId/summary')
  @CanAccess('loyalty', 'view')
  @ApiOperation({ summary: 'Saldo + tier + valor convertido em R$ pra um cliente' })
  getCustomerSummary(
    @CurrentTenant() tenantId: number,
    @Param('customerId', ParseIntPipe) customerId: number,
  ) {
    return this.service.getCustomerSummary(tenantId, customerId);
  }

  @Get('customers/:customerId/transactions')
  @CanAccess('loyalty', 'view')
  @ApiOperation({ summary: 'Extrato de transações de pontos/cashback' })
  listTransactions(
    @CurrentTenant() tenantId: number,
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listTransactions(
      tenantId, customerId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 30,
    );
  }

  @Post('customers/:customerId/adjust')
  @CanAccess('loyalty', 'edit')
  @ApiOperation({ summary: 'Ajuste manual de saldo (creditar ou debitar)' })
  adjust(
    @CurrentTenant() tenantId: number,
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() dto: AdjustLoyaltyDto,
  ) {
    return this.service.adjust(tenantId, customerId, dto);
  }

  @Post('customers/:customerId/referral-code')
  @CanAccess('loyalty', 'edit')
  @ApiOperation({ summary: 'Gera código de indicação pro cliente (idempotente)' })
  ensureReferralCode(
    @CurrentTenant() tenantId: number,
    @Param('customerId', ParseIntPipe) customerId: number,
  ) {
    return this.service.ensureReferralCode(tenantId, customerId).then((code) => ({ code }));
  }

  // ─── Resgate (preview pro PDV/Ecommerce calcular desconto) ────────────────
  // Esse fica em `orders.create` porque é parte do fluxo de criação de pedido —
  // SALES precisa conseguir aplicar resgate no PDV mesmo sem permissão de
  // gerenciar o programa em si. O backend valida via saldo do cliente.

  @Post('preview-redeem')
  @CanAccess('orders', 'create')
  @ApiOperation({ summary: 'Simula desconto possível dado saldo do cliente + intenção de uso' })
  previewRedeem(@CurrentTenant() tenantId: number, @Body() dto: PreviewRedeemDto) {
    return this.service.previewRedeem(tenantId, dto);
  }
}
