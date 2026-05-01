import {
  Body, Controller, Get, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CustomerAuthGuard, CurrentCustomer } from './customer-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { LoyaltyService } from '../loyalty/loyalty.service';

/**
 * Endpoints de fidelidade expostos pro cliente final logado na SPA Ecommerce.
 *
 * Diferente do `/api/loyalty/*` (admin do ERP, gateado por @CanAccess), aqui
 * o cliente final acessa apenas SEU PRÓPRIO saldo via JWT do `customer-auth`
 * — `req.customer.sub` é o customerId. Nunca aceita customerId externo.
 *
 * @Public porque o JwtAuthGuard global filtra por user da tabela User; aqui
 * usamos o CustomerAuthGuard separado que valida o JWT do cliente final
 * (token `ec_token` no localStorage da SPA).
 */
@ApiTags('ecommerce-loyalty')
@ApiBearerAuth('CustomerJWT')
@Controller('ecommerce/loyalty')
@Public()
@UseGuards(CustomerAuthGuard)
export class EcommerceLoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('me/summary')
  @ApiOperation({ summary: 'Saldo + tier do cliente logado (cliente final)' })
  async mySummary(@CurrentCustomer() customer: any) {
    // Se o tenant não tem fidelidade liberada, retorna estrutura vazia em vez
    // de 403 — evita poluir a UI da SPA com erro pra coisa "extra".
    try {
      return await this.loyalty.getCustomerSummary(customer.tenantId, customer.sub);
    } catch {
      return null;
    }
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'Extrato de transações do cliente logado' })
  async myTransactions(
    @CurrentCustomer() customer: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.loyalty.listTransactions(
      customer.tenantId, customer.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get('me/config')
  @ApiOperation({ summary: 'Config pública de fidelidade (regras visíveis pro cliente)' })
  async myConfig(@CurrentCustomer() customer: any) {
    const cfg = await this.loyalty.getConfig(customer.tenantId);
    // Filtra config pra expor só o que o cliente final precisa saber.
    // Esconde campos internos (multipliers, minSpend dos tiers, etc não são úteis).
    return {
      enabled: cfg.enabled,
      pointsPerReal: cfg.pointsPerReal,
      realsPerPoint: cfg.realsPerPoint,
      pointsExpiryMonths: cfg.pointsExpiryMonths,
      minRedeemPoints: cfg.minRedeemPoints,
      cashbackPercent: cfg.cashbackPercent,
      tiers: cfg.tiers,
      birthdayCoupon: cfg.birthdayCoupon,
      referralBonusPoints: cfg.referralBonusPoints,
      referralBonusCashback: cfg.referralBonusCashback,
    };
  }

  @Post('me/referral-code')
  @ApiOperation({ summary: 'Gera código de indicação do cliente logado (idempotente)' })
  async myReferralCode(@CurrentCustomer() customer: any) {
    const code = await this.loyalty.ensureReferralCode(customer.tenantId, customer.sub);
    return { code };
  }

  @Post('preview-redeem')
  @ApiOperation({ summary: 'Preview do desconto possível no checkout' })
  async previewRedeem(
    @CurrentCustomer() customer: any,
    @Body() body: { orderAmount: number; points?: number; cashback?: number },
  ) {
    return this.loyalty.previewRedeem(customer.tenantId, {
      customerId: customer.sub,        // força ser o cliente logado, ignora qualquer ID externo
      orderAmount: body.orderAmount,
      points: body.points,
      cashback: body.cashback,
    });
  }
}
