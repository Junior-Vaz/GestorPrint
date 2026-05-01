import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoyaltyService } from './loyalty.service';

/**
 * Cron jobs do programa de fidelidade.
 *
 * Rodam no processo principal (não tem worker dedicado por enquanto).
 * Todas idempotentes — múltiplas execuções são seguras.
 *
 * Schedule:
 *  - 03:30 todo dia: expira pontos vencidos + recomputa tiers
 *  - 04:00 todo dia 1º do mês: gera cupons de aniversário do mês
 */
@Injectable()
export class LoyaltyCron {
  private readonly logger = new Logger(LoyaltyCron.name);

  constructor(private readonly loyalty: LoyaltyService) {}

  /**
   * Diário 03:30 — janela tranquila (madrugada BR), evita conflito com pico operacional.
   * Job em três etapas:
   *  (1) expira tudo vencido
   *  (2) recompõe tier dos clientes que tiveram movimento recente
   *  (3) avisa clientes com pontos expirando em ~7 dias (uma vez por janela)
   */
  @Cron('30 3 * * *', { name: 'loyalty:daily', timeZone: 'America/Sao_Paulo' })
  async daily() {
    try {
      const expired = await this.loyalty.expirePoints();
      this.logger.log(`expirePoints: ${expired.processed}/${expired.found} txs processadas`);
    } catch (err: any) {
      this.logger.error(`expirePoints falhou: ${err.message}`);
    }
    try {
      const tiers = await this.loyalty.recomputeAllTiers();
      this.logger.log(`recomputeAllTiers: ${tiers.updated} clientes atualizados`);
    } catch (err: any) {
      this.logger.error(`recomputeAllTiers falhou: ${err.message}`);
    }
    try {
      const warned = await this.loyalty.notifyExpiringPoints();
      this.logger.log(`notifyExpiringPoints: ${warned.sent} emails enviados`);
    } catch (err: any) {
      this.logger.error(`notifyExpiringPoints falhou: ${err.message}`);
    }
  }

  /**
   * Mensal — 04:00 do dia 1. Gera cupom de aniversário pra todos os clientes
   * com birthDate no mês corrente, em todos os tenants com loyaltyConfig.enabled
   * E birthdayCoupon.enabled. Idempotente via código BDAY-{customerId}-{YYYYMM}.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON, { name: 'loyalty:birthday', timeZone: 'America/Sao_Paulo' })
  async birthdayMonthly() {
    try {
      const result = await this.loyalty.issueBirthdayCoupons();
      this.logger.log(`issueBirthdayCoupons: ${result.issued} cupons gerados`);
    } catch (err: any) {
      this.logger.error(`issueBirthdayCoupons falhou: ${err.message}`);
    }
  }
}
