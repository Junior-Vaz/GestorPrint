import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CheckFeatureUseCase } from '../../../application/entitlement/check-feature.usecase';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { LoyaltyMailerService } from './loyalty-mailer.service';
import {
  UpdateLoyaltyConfigDto, AdjustLoyaltyDto, PreviewRedeemDto, LoyaltyTierDto,
} from './dto/loyalty-config.dto';

/**
 * LoyaltyService — núcleo do programa de fidelidade.
 *
 * Responsabilidades:
 *  - Resolver e persistir LoyaltyConfig (em Settings.loyaltyConfig JSON)
 *  - Calcular pontos/cashback ganhos por pedido (aplicando multiplicador de tier)
 *  - Creditar/debitar saldo via LoyaltyTransaction (sempre em transação Prisma)
 *  - Calcular tier do cliente baseado em spend dos últimos 12 meses
 *  - Aplicar resgate (pontos OU cashback OU cupom) no fechamento do pedido
 *  - Gerar cupom de aniversário
 *  - Resolver bônus de referral (após 1ª compra paga do indicado)
 *
 * Invariantes:
 *  - Customer.loyaltyPoints == SUM(LoyaltyTransaction.points WHERE customer)
 *  - Customer.loyaltyBalance == SUM(LoyaltyTransaction.cashback WHERE customer)
 *  - Order.loyaltyProcessed=true só depois do credit ter sido persistido
 *  - Tudo idempotente — chamar 2x não duplica
 */
@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkFeature: CheckFeatureUseCase,
    private readonly mailer: LoyaltyMailerService,
  ) {}

  // ─── Config (Settings.loyaltyConfig JSON) ─────────────────────────────────

  /**
   * Default config quando o tenant ainda não configurou nada. Mantém o programa
   * "soft-off" (enabled=false) — admin tem que ativar conscientemente, evitando
   * que tenants que não querem fidelidade vejam pontos sendo creditados sem saber.
   */
  private defaultConfig() {
    return {
      enabled: false,
      pointsPerReal: 1,
      realsPerPoint: 0.05,
      pointsExpiryMonths: 12,
      minRedeemPoints: 100,
      cashbackPercent: 0,
      cashbackExpiryMonths: 6,
      tiers: [
        { name: 'BRONZE',   minSpend: 0,     discount: 0, pointsMultiplier: 1 },
        { name: 'SILVER',   minSpend: 1000,  discount: 2, pointsMultiplier: 1.5 },
        { name: 'GOLD',     minSpend: 5000,  discount: 5, pointsMultiplier: 2 },
        { name: 'PLATINUM', minSpend: 15000, discount: 8, pointsMultiplier: 3 },
      ] as LoyaltyTierDto[],
      birthdayCoupon: { enabled: true, discountPercent: 10, validityDays: 30 },
      referralBonusPoints: 200,
      referralBonusCashback: 0,
    };
  }

  async getConfig(tenantId: number) {
    const settings = await (this.prisma as any).settings.findUnique({
      where: { tenantId },
      select: { loyaltyConfig: true },
    });
    const cfg = (settings?.loyaltyConfig as any) ?? this.defaultConfig();
    // Merge com defaults pra cobrir campos novos adicionados depois (forward-compat
    // — se a config foi salva antes de existir `cashbackPercent`, retorna 0 em vez
    // de undefined que quebraria os cálculos).
    return { ...this.defaultConfig(), ...cfg };
  }

  async updateConfig(tenantId: number, dto: UpdateLoyaltyConfigDto) {
    // Validação cruzada: tiers ordenados por minSpend crescente, sem nomes duplicados.
    const names = new Set<string>();
    let lastSpend = -1;
    for (const t of dto.tiers) {
      if (names.has(t.name)) throw new BadRequestException(`Tier duplicado: ${t.name}`);
      names.add(t.name);
      if (t.minSpend < lastSpend) throw new BadRequestException('Tiers devem estar em ordem crescente de minSpend');
      lastSpend = t.minSpend;
    }
    if (dto.tiers.length === 0) throw new BadRequestException('Pelo menos 1 tier é necessário');

    await (this.prisma as any).settings.upsert({
      where:  { tenantId },
      update: { loyaltyConfig: dto as any },
      create: { tenantId, loyaltyConfig: dto as any },
    });
    return dto;
  }

  // ─── Cálculos de ganho ────────────────────────────────────────────────────

  /**
   * Calcula pontos + cashback que o cliente ganha por um pedido de valor X.
   * Aplica multiplicador do tier atual. NÃO persiste — só calcula.
   * Usado na hora de creditar (handleOrderPaid) e pra exibir preview na UI.
   */
  async calculateEarn(tenantId: number, customerId: number, orderAmount: number) {
    const cfg = await this.getConfig(tenantId);
    if (!cfg.enabled || orderAmount <= 0) {
      return { points: 0, cashback: 0, tier: null, multiplier: 1 };
    }
    const customer = await (this.prisma as any).customer.findUnique({
      where: { id: customerId },
      select: { loyaltyTier: true },
    });
    const tier = this.resolveTier(cfg.tiers, customer?.loyaltyTier);
    const multiplier = tier?.pointsMultiplier ?? 1;
    const points = Math.floor(orderAmount * cfg.pointsPerReal * multiplier);
    const cashback = +(orderAmount * (cfg.cashbackPercent / 100)).toFixed(2);
    return { points, cashback, tier: tier?.name ?? null, multiplier };
  }

  private resolveTier(tiers: LoyaltyTierDto[], currentTierName: string | null | undefined): LoyaltyTierDto | null {
    if (!currentTierName) return tiers[0] ?? null;
    return tiers.find((t) => t.name === currentTierName) ?? tiers[0] ?? null;
  }

  /**
   * Recalcula tier baseado no spend dos últimos 12 meses. Atualiza Customer.
   * Chamado pelo cron diário e logo após cada pedido pago (pra promover na hora).
   * Se o tier MUDOU PRA CIMA, dispara email celebratório (não envia em downgrade
   * pra não dar feedback negativo desnecessário — cliente fica triste se ver
   * "você caiu de Ouro pra Prata").
   */
  async recomputeTier(tenantId: number, customerId: number) {
    const cfg = await this.getConfig(tenantId);
    if (!cfg.enabled) return null;

    const since = new Date();
    since.setMonth(since.getMonth() - 12);

    const agg = await (this.prisma as any).order.aggregate({
      where: {
        tenantId, customerId,
        // Só conta pedidos efetivamente pagos.
        OR: [
          { paymentStatus: 'APPROVED' },
          { status: 'DELIVERED' },
          { status: 'FINISHED' },
        ],
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    const spend = agg._sum.amount ?? 0;
    // Achar o maior tier cujo minSpend o cliente atende.
    const sorted = [...cfg.tiers].sort((a, b) => b.minSpend - a.minSpend);
    const newTier = sorted.find((t) => spend >= t.minSpend) ?? cfg.tiers[0];

    // Pega tier anterior pra detectar promoção
    const prev = await (this.prisma as any).customer.findUnique({
      where: { id: customerId },
      select: { name: true, email: true, loyaltyTier: true },
    });
    const oldTier = prev?.loyaltyTier ?? null;

    await (this.prisma as any).customer.update({
      where: { id: customerId },
      data: { loyaltyTier: newTier?.name ?? null, loyaltySpend12m: spend },
    });

    // Detecta promoção: tier mudou + novo tem minSpend MAIOR que o antigo.
    // Sem isso, primeira atribuição de tier (oldTier=null) também dispararia
    // email — mas isso é desejado (o BRONZE inicial conta como "entrou no programa").
    const oldConfig = oldTier ? cfg.tiers.find((t: LoyaltyTierDto) => t.name === oldTier) : null;
    const isPromotion = newTier && newTier.name !== oldTier && (
      !oldConfig || newTier.minSpend > oldConfig.minSpend
    );
    if (isPromotion && prev?.email) {
      this.mailer.sendTierPromoted(tenantId, {
        email: prev.email,
        name: prev.name || 'Cliente',
        oldTier,
        newTier: newTier.name,
        discount: newTier.discount,
        multiplier: newTier.pointsMultiplier,
      }).catch((err) => this.logger.warn(`email tier-up falhou: ${err.message}`));
    }

    return { tier: newTier?.name ?? null, spend };
  }

  // ─── Crédito automático no fechamento de Order ────────────────────────────

  /**
   * Idempotente. Roda no hook de Order (PAID/DELIVERED). Se o pedido já tinha
   * `loyaltyProcessed=true`, retorna sem fazer nada. Caso contrário:
   *  - cria LoyaltyTransaction(EARN) com pontos + cashback
   *  - atualiza saldo cached do Customer
   *  - marca Order.loyaltyProcessed=true e salva pointsEarned/cashbackEarned
   *  - se cliente foi indicado por outro e este é o 1º pedido pago: libera referral
   *  - recalcula tier (pode ter subido)
   */
  async creditOrderEarnings(orderId: number) {
    const order = await (this.prisma as any).order.findUnique({
      where: { id: orderId },
      select: {
        id: true, tenantId: true, customerId: true, amount: true,
        loyaltyProcessed: true, paymentStatus: true, status: true,
      },
    });
    if (!order) return;
    if (order.loyaltyProcessed) return; // idempotência

    // Só credita se feature ativa pro tenant
    const allowed = await this.checkFeature.check(order.tenantId, FeatureKey.LOYALTY_PROGRAM);
    if (!allowed) return;

    const earn = await this.calculateEarn(order.tenantId, order.customerId, order.amount);
    if (earn.points <= 0 && earn.cashback <= 0) {
      // Nada a creditar mas marca como processado pra não tentar de novo.
      await (this.prisma as any).order.update({
        where: { id: orderId }, data: { loyaltyProcessed: true },
      });
      return;
    }

    const cfg = await this.getConfig(order.tenantId);
    const expiresPoints = cfg.pointsExpiryMonths > 0
      ? new Date(Date.now() + cfg.pointsExpiryMonths * 30 * 86400000) : null;
    const expiresCashback = cfg.cashbackExpiryMonths > 0
      ? new Date(Date.now() + cfg.cashbackExpiryMonths * 30 * 86400000) : null;

    // Tudo numa transação — saldo cached e ledger sempre consistentes.
    await this.prisma.$transaction(async (tx) => {
      if (earn.points > 0) {
        await (tx as any).loyaltyTransaction.create({
          data: {
            tenantId: order.tenantId, customerId: order.customerId, type: 'EARN',
            points: earn.points, cashback: 0,
            reason: `Pedido #${order.id} pago (${earn.tier ?? 'sem tier'}, x${earn.multiplier})`,
            orderId: order.id, expiresAt: expiresPoints,
          },
        });
      }
      if (earn.cashback > 0) {
        await (tx as any).loyaltyTransaction.create({
          data: {
            tenantId: order.tenantId, customerId: order.customerId, type: 'EARN',
            points: 0, cashback: earn.cashback,
            reason: `Cashback ${cfg.cashbackPercent}% do pedido #${order.id}`,
            orderId: order.id, expiresAt: expiresCashback,
          },
        });
      }
      await (tx as any).customer.update({
        where: { id: order.customerId },
        data: {
          loyaltyPoints:   { increment: earn.points },
          loyaltyBalance:  { increment: earn.cashback },
        },
      });
      await (tx as any).order.update({
        where: { id: order.id },
        data: {
          loyaltyProcessed: true,
          pointsEarned: earn.points,
          cashbackEarned: earn.cashback,
        },
      });
    });

    // Após commit: tarefas async não-críticas
    await this.recomputeTier(order.tenantId, order.customerId).catch((err) =>
      this.logger.warn(`recomputeTier falhou pra cliente ${order.customerId}: ${err.message}`),
    );
    await this.maybeReleaseReferralBonus(order.tenantId, order.customerId, order.id).catch((err) =>
      this.logger.warn(`referral bonus falhou: ${err.message}`),
    );

    // Email de pontos ganhos — não bloqueia o crédito (já persistido).
    // Busca dados do cliente + saldo final pra mensagem completa.
    try {
      const customer = await (this.prisma as any).customer.findUnique({
        where: { id: order.customerId },
        select: { name: true, email: true, loyaltyPoints: true, loyaltyBalance: true },
      });
      if (customer?.email) {
        await this.mailer.sendPointsEarned(order.tenantId, {
          email: customer.email,
          name: customer.name || 'Cliente',
          orderId: order.id,
          orderAmount: order.amount,
          points: earn.points,
          cashback: earn.cashback,
          tier: earn.tier,
          multiplier: earn.multiplier,
          newBalance: customer.loyaltyPoints,
          newCashbackBalance: customer.loyaltyBalance,
          pointsValue: +(customer.loyaltyPoints * cfg.realsPerPoint).toFixed(2),
        });
      }
    } catch (err: any) {
      this.logger.warn(`email pontos-ganhos falhou: ${err.message}`);
    }
  }

  // ─── Resgate de pontos/cashback no checkout ───────────────────────────────

  /**
   * Calcula desconto possível dado o saldo do cliente + intenção de uso.
   * NÃO debita — só simula. O debit acontece quando o pedido é criado/pago.
   * Limita o desconto a 100% do orderAmount (não permite saldo negativo no pedido).
   */
  async previewRedeem(tenantId: number, dto: PreviewRedeemDto) {
    const cfg = await this.getConfig(tenantId);
    if (!cfg.enabled) {
      return { discount: 0, points: 0, cashback: 0, message: 'Programa desativado' };
    }

    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: dto.customerId, tenantId },
      select: { loyaltyPoints: true, loyaltyBalance: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    let pointsToUse = Math.min(dto.points ?? 0, customer.loyaltyPoints);
    let cashbackToUse = Math.min(dto.cashback ?? 0, customer.loyaltyBalance);

    if (pointsToUse > 0 && pointsToUse < cfg.minRedeemPoints) {
      pointsToUse = 0; // abaixo do mínimo configurado
    }

    let discountFromPoints = +(pointsToUse * cfg.realsPerPoint).toFixed(2);
    let discount = discountFromPoints + cashbackToUse;

    // Limita ao valor do pedido (não dá pra ficar com troco virando saldo negativo)
    if (discount > dto.orderAmount) {
      const overflow = discount - dto.orderAmount;
      // Prioriza limitar cashback primeiro (mais "valioso" deixar pontos pra próxima)
      if (cashbackToUse >= overflow) {
        cashbackToUse -= overflow;
      } else {
        const stillOver = overflow - cashbackToUse;
        cashbackToUse = 0;
        const pointsToReduce = Math.ceil(stillOver / cfg.realsPerPoint);
        pointsToUse = Math.max(0, pointsToUse - pointsToReduce);
        discountFromPoints = +(pointsToUse * cfg.realsPerPoint).toFixed(2);
      }
      discount = +(discountFromPoints + cashbackToUse).toFixed(2);
    }

    return {
      discount, points: pointsToUse, cashback: cashbackToUse,
      maxPointsAvailable: customer.loyaltyPoints,
      maxCashbackAvailable: customer.loyaltyBalance,
      pointsValue: discountFromPoints,
    };
  }

  /**
   * Aplica o resgate de fato — debita do saldo e registra no Order.
   * Chamado na criação do pedido (PDV/Ecommerce/ERP) quando o usuário escolhe usar.
   */
  async applyRedeem(tenantId: number, orderId: number, points: number, cashback: number) {
    if (points === 0 && cashback === 0) return;
    const order = await (this.prisma as any).order.findUnique({
      where: { id: orderId }, select: { customerId: true, amount: true, loyaltyDiscount: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    const cfg = await this.getConfig(tenantId);
    const discountFromPoints = +(points * cfg.realsPerPoint).toFixed(2);
    const totalDiscount = +(discountFromPoints + cashback).toFixed(2);

    await this.prisma.$transaction(async (tx) => {
      if (points > 0) {
        await (tx as any).loyaltyTransaction.create({
          data: {
            tenantId, customerId: order.customerId, type: 'REDEEM',
            points: -points, cashback: 0,
            reason: `Pontos aplicados no pedido #${orderId}`,
            orderId, expiresAt: null,
          },
        });
      }
      if (cashback > 0) {
        await (tx as any).loyaltyTransaction.create({
          data: {
            tenantId, customerId: order.customerId, type: 'REDEEM',
            points: 0, cashback: -cashback,
            reason: `Cashback aplicado no pedido #${orderId}`,
            orderId, expiresAt: null,
          },
        });
      }
      await (tx as any).customer.update({
        where: { id: order.customerId },
        data: {
          loyaltyPoints:  { decrement: points },
          loyaltyBalance: { decrement: cashback },
        },
      });
      await (tx as any).order.update({
        where: { id: orderId },
        data: {
          pointsRedeemed: points,
          cashbackRedeemed: cashback,
          loyaltyDiscount: totalDiscount,
        },
      });
    });
  }

  // ─── Ajuste manual (admin) ────────────────────────────────────────────────

  async adjust(tenantId: number, customerId: number, dto: AdjustLoyaltyDto) {
    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: customerId, tenantId },
      select: { loyaltyPoints: true, loyaltyBalance: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    // Não deixa zerar abaixo do saldo atual (debit > saldo).
    if (dto.points < 0 && Math.abs(dto.points) > customer.loyaltyPoints) {
      throw new BadRequestException(`Saldo de pontos insuficiente (${customer.loyaltyPoints})`);
    }
    if (dto.cashback < 0 && Math.abs(dto.cashback) > customer.loyaltyBalance) {
      throw new BadRequestException(`Saldo de cashback insuficiente (R$ ${customer.loyaltyBalance.toFixed(2)})`);
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).loyaltyTransaction.create({
        data: {
          tenantId, customerId, type: 'ADJUST',
          points: dto.points, cashback: dto.cashback,
          reason: dto.reason, expiresAt: null,
        },
      });
      await (tx as any).customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints:  { increment: dto.points },
          loyaltyBalance: { increment: dto.cashback },
        },
      });
    });

    return { ok: true };
  }

  // ─── Extrato (LoyaltyTransactions) ────────────────────────────────────────

  async listTransactions(tenantId: number, customerId: number, page = 1, pageSize = 30) {
    const skip = (Math.max(1, page) - 1) * pageSize;
    const [items, total] = await Promise.all([
      (this.prisma as any).loyaltyTransaction.findMany({
        where: { tenantId, customerId },
        orderBy: { createdAt: 'desc' },
        skip, take: pageSize,
      }),
      (this.prisma as any).loyaltyTransaction.count({ where: { tenantId, customerId } }),
    ]);
    return { items, total, page, pageSize };
  }

  async getCustomerSummary(tenantId: number, customerId: number) {
    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: customerId, tenantId },
      select: {
        id: true, name: true, email: true, phone: true,
        loyaltyPoints: true, loyaltyBalance: true, loyaltyTier: true,
        loyaltySpend12m: true, referralCode: true, birthDate: true,
        referredById: true,
      },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    const cfg = await this.getConfig(tenantId);
    const tier = this.resolveTier(cfg.tiers, customer.loyaltyTier);

    // Pendência de referral: se o cliente foi indicado por alguém E ainda não
    // teve o bônus liberado, retorna { points, cashback } pra UI mostrar
    // "você ganha X ao finalizar a 1ª compra". Se já teve qualquer transação
    // do tipo REFERRAL, considera bônus já creditado e não mostra mais.
    let pendingReferral: { points: number; cashback: number } | null = null;
    if (customer.referredById) {
      const already = await (this.prisma as any).loyaltyTransaction.findFirst({
        where: { tenantId, customerId, type: 'REFERRAL' },
        select: { id: true },
      });
      if (!already && (cfg.referralBonusPoints > 0 || cfg.referralBonusCashback > 0)) {
        pendingReferral = {
          points:   cfg.referralBonusPoints,
          cashback: cfg.referralBonusCashback,
        };
      }
    }

    return {
      ...customer,
      tierConfig: tier,
      pointsValue: +(customer.loyaltyPoints * cfg.realsPerPoint).toFixed(2),
      pendingReferral,
    };
  }

  // ─── Referral ─────────────────────────────────────────────────────────────

  /**
   * Gera código único de indicação pra cliente (idempotente — se já tem, retorna).
   * Formato: 6 chars alfanuméricos, evita ambiguidade (sem O/0/I/1).
   */
  async ensureReferralCode(tenantId: number, customerId: number) {
    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, referralCode: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    if (customer.referralCode) return customer.referralCode;

    // Tenta até 5 vezes contra colisão (improvável mas não impossível)
    for (let i = 0; i < 5; i++) {
      const code = this.generateReferralCode();
      try {
        await (this.prisma as any).customer.update({
          where: { id: customerId }, data: { referralCode: code },
        });
        return code;
      } catch (e: any) {
        if (e.code !== 'P2002') throw e; // P2002 = unique constraint
      }
    }
    throw new Error('Não foi possível gerar código único após 5 tentativas');
  }

  private generateReferralCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1
    let code = '';
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  /**
   * Aplicado no signup do ecommerce: cliente novo informa código de quem indicou.
   * Liga `referredById` mas NÃO credita bônus ainda (anti-fraude — só libera após
   * 1ª compra paga via maybeReleaseReferralBonus).
   */
  async applyReferralCode(tenantId: number, newCustomerId: number, code: string) {
    const referrer = await (this.prisma as any).customer.findFirst({
      where: { tenantId, referralCode: code.toUpperCase() },
      select: { id: true },
    });
    if (!referrer) throw new BadRequestException('Código de indicação inválido');
    if (referrer.id === newCustomerId) throw new BadRequestException('Não pode indicar a si mesmo');
    await (this.prisma as any).customer.update({
      where: { id: newCustomerId }, data: { referredById: referrer.id },
    });
    return { referrerId: referrer.id };
  }

  /**
   * Chamado após 1º pedido pago do indicado. Credita bônus pra ambos (referrer + indicado).
   * Idempotente via flag — checamos se já existe LoyaltyTransaction tipo REFERRAL pra esse par.
   */
  private async maybeReleaseReferralBonus(tenantId: number, newCustomerId: number, orderId: number) {
    const customer = await (this.prisma as any).customer.findUnique({
      where: { id: newCustomerId },
      select: { referredById: true },
    });
    if (!customer?.referredById) return;

    // Já liberou pra esse cliente? (chave: LoyaltyTransaction com type=REFERRAL e customer=newCustomer)
    const already = await (this.prisma as any).loyaltyTransaction.findFirst({
      where: { tenantId, customerId: newCustomerId, type: 'REFERRAL' },
      select: { id: true },
    });
    if (already) return;

    const cfg = await this.getConfig(tenantId);
    if (cfg.referralBonusPoints <= 0 && cfg.referralBonusCashback <= 0) return;

    const expires = cfg.pointsExpiryMonths > 0
      ? new Date(Date.now() + cfg.pointsExpiryMonths * 30 * 86400000) : null;

    await this.prisma.$transaction(async (tx) => {
      // Bônus pro indicado
      await (tx as any).loyaltyTransaction.create({
        data: {
          tenantId, customerId: newCustomerId, type: 'REFERRAL',
          points: cfg.referralBonusPoints, cashback: cfg.referralBonusCashback,
          reason: 'Bônus de boas-vindas (você usou um código de indicação)',
          orderId, expiresAt: expires,
        },
      });
      // Bônus pro referrer
      await (tx as any).loyaltyTransaction.create({
        data: {
          tenantId, customerId: customer.referredById, type: 'REFERRAL',
          points: cfg.referralBonusPoints, cashback: cfg.referralBonusCashback,
          reason: `Indicação fez 1ª compra (cliente #${newCustomerId})`,
          orderId, expiresAt: expires,
        },
      });
      // Atualiza ambos saldos
      await (tx as any).customer.update({
        where: { id: newCustomerId },
        data: {
          loyaltyPoints:  { increment: cfg.referralBonusPoints },
          loyaltyBalance: { increment: cfg.referralBonusCashback },
        },
      });
      await (tx as any).customer.update({
        where: { id: customer.referredById },
        data: {
          loyaltyPoints:  { increment: cfg.referralBonusPoints },
          loyaltyBalance: { increment: cfg.referralBonusCashback },
        },
      });
    });

    // Email pro INDICADOR (quem deu o código). O indicado já recebe email de
    // pontos-ganhos pelo creditOrderEarnings com o REFERRAL incluído no saldo.
    try {
      const [referrer, indicated] = await Promise.all([
        (this.prisma as any).customer.findUnique({
          where: { id: customer.referredById },
          select: { name: true, email: true, loyaltyPoints: true },
        }),
        (this.prisma as any).customer.findUnique({
          where: { id: newCustomerId },
          select: { name: true },
        }),
      ]);
      if (referrer?.email && indicated?.name) {
        await this.mailer.sendReferralConverted(tenantId, {
          email: referrer.email,
          name: referrer.name || 'Cliente',
          referredCustomerName: indicated.name,
          bonusPoints: cfg.referralBonusPoints,
          bonusCashback: cfg.referralBonusCashback,
          newBalance: referrer.loyaltyPoints,
        });
      }
    } catch (err: any) {
      this.logger.warn(`email referral-converted falhou: ${err.message}`);
    }
  }

  // ─── Cron jobs (chamados pelo loyalty.cron.ts) ────────────────────────────

  /**
   * Para cada LoyaltyTransaction expirada (expiresAt < now AND expired=false),
   * cria EXPIRE compensatório com pontos/cashback negativos pra zerar a entrada.
   * Idempotente via flag `expired`.
   */
  async expirePoints() {
    const now = new Date();
    const expired = await (this.prisma as any).loyaltyTransaction.findMany({
      where: { expired: false, expiresAt: { lt: now }, type: { in: ['EARN', 'BONUS', 'REFERRAL'] } },
      select: { id: true, tenantId: true, customerId: true, points: true, cashback: true, reason: true },
    });

    let processed = 0;
    for (const tx of expired) {
      try {
        await this.prisma.$transaction(async (db) => {
          await (db as any).loyaltyTransaction.create({
            data: {
              tenantId: tx.tenantId, customerId: tx.customerId, type: 'EXPIRE',
              points: -tx.points, cashback: -tx.cashback,
              reason: `Expiração: ${tx.reason ?? 'crédito vencido'}`,
              expiresAt: null,
            },
          });
          await (db as any).loyaltyTransaction.update({
            where: { id: tx.id }, data: { expired: true },
          });
          await (db as any).customer.update({
            where: { id: tx.customerId },
            data: {
              loyaltyPoints:  { decrement: tx.points },
              loyaltyBalance: { decrement: tx.cashback },
            },
          });
        });
        processed++;
      } catch (err: any) {
        this.logger.error(`Falha ao expirar tx ${tx.id}: ${err.message}`);
      }
    }
    return { processed, found: expired.length };
  }

  /**
   * Cron mensal — gera cupons de aniversário pra clientes com birthDate no mês.
   * Idempotente: usa código `BDAY-{customerId}-{YYYYMM}` único por cliente/mês.
   */
  async issueBirthdayCoupons() {
    const today = new Date();
    const month = today.getMonth() + 1; // 1-12
    const yearMonth = `${today.getFullYear()}${String(month).padStart(2, '0')}`;

    // Busca tenants com loyaltyConfig.enabled e birthdayCoupon.enabled
    const settings = await (this.prisma as any).settings.findMany({
      select: { tenantId: true, loyaltyConfig: true },
    });
    let issued = 0;

    for (const s of settings) {
      const cfg = (s.loyaltyConfig as any) ?? {};
      if (!cfg.enabled || !cfg.birthdayCoupon?.enabled) continue;
      const allowed = await this.checkFeature.check(s.tenantId, FeatureKey.LOYALTY_PROGRAM);
      if (!allowed) continue;

      // Clientes do tenant com aniversário este mês
      const customers = await (this.prisma as any).$queryRawUnsafe(
        `SELECT id FROM "Customer" WHERE "tenantId" = $1 AND EXTRACT(MONTH FROM "birthDate") = $2`,
        s.tenantId, month,
      );

      for (const c of customers) {
        const code = `BDAY-${c.id}-${yearMonth}`;
        try {
          const validUntil = new Date(Date.now() + cfg.birthdayCoupon.validityDays * 86400000);
          await (this.prisma as any).coupon.create({
            data: {
              tenantId: s.tenantId, code,
              description: `Cupom de aniversário (${cfg.birthdayCoupon.discountPercent}% off)`,
              type: 'PERCENT', value: cfg.birthdayCoupon.discountPercent,
              maxUses: 1, maxUsesPerCustomer: 1,
              validFrom: new Date(), validUntil,
              source: 'BIRTHDAY', customerId: c.id, active: true,
            },
          });
          issued++;
        } catch (e: any) {
          // P2002 = duplicado (já gerou esse mês). Esperado nas reexecuções do cron.
          if (e.code !== 'P2002') this.logger.warn(`birthday coupon falhou tenant=${s.tenantId} customer=${c.id}: ${e.message}`);
        }
      }
    }
    return { issued };
  }

  // ─── Dashboard (KPIs + agregações) ────────────────────────────────────────

  /**
   * Snapshot do programa pro admin: top clientes, distribuição por tier,
   * fluxo de pontos (circulando/resgatados/expirados), conversão de indicação.
   *
   * Tudo numa requisição só (várias queries paralelas) pra não criar 7 endpoints.
   * Agregações são server-side (Prisma) — nada vem em raw pro front.
   */
  async getDashboard(tenantId: number) {
    const cfg = await this.getConfig(tenantId);

    const [
      topClients,
      tierDistribution,
      pointsFlow,
      referralStats,
      activeCustomers,
      totalCustomers,
    ] = await Promise.all([
      // Top 10 clientes por saldo total (pontos × valor + cashback)
      (this.prisma as any).customer.findMany({
        where: { tenantId, OR: [{ loyaltyPoints: { gt: 0 } }, { loyaltyBalance: { gt: 0 } }] },
        select: {
          id: true, name: true, email: true,
          loyaltyPoints: true, loyaltyBalance: true,
          loyaltyTier: true, loyaltySpend12m: true,
        },
        orderBy: [{ loyaltySpend12m: 'desc' }],
        take: 10,
      }),

      // Distribuição por tier — usa $queryRawUnsafe pra GROUP BY com count
      (this.prisma as any).$queryRawUnsafe(
        `SELECT COALESCE("loyaltyTier", '_NONE_') AS tier, COUNT(*)::int AS count
         FROM "Customer" WHERE "tenantId" = $1 GROUP BY "loyaltyTier"`,
        tenantId,
      ),

      // Fluxo de pontos: agrega por tipo somando absoluto pra mostrar total movimentado
      (this.prisma as any).loyaltyTransaction.groupBy({
        by: ['type'],
        where: { tenantId },
        _sum: { points: true, cashback: true },
        _count: true,
      }),

      // Stats de referral: indicações cadastradas vs convertidas
      Promise.all([
        (this.prisma as any).customer.count({ where: { tenantId, referredById: { not: null } } }),
        (this.prisma as any).loyaltyTransaction.count({ where: { tenantId, type: 'REFERRAL', points: { gt: 0 } } }),
      ]).then(([cadastros, conversoes]) => ({
        cadastros,
        // dividido por 2 porque o REFERRAL cria 2 transactions (uma pra cada lado)
        conversoes: Math.floor(conversoes / 2),
      })),

      // Clientes ativos no mês (com qualquer transação nos últimos 30d)
      (this.prisma as any).$queryRawUnsafe(
        `SELECT COUNT(DISTINCT "customerId")::int AS count
         FROM "LoyaltyTransaction"
         WHERE "tenantId" = $1 AND "createdAt" >= NOW() - INTERVAL '30 days'`,
        tenantId,
      ).then((rows: any[]) => rows[0]?.count ?? 0),

      // Total de clientes do tenant (denominador pro % ativos)
      (this.prisma as any).customer.count({ where: { tenantId } }),
    ]);

    // Normaliza fluxo: separa earned/redeemed/expired/bonus pra UI consumir fácil.
    // Tipo INLINE direto no objeto pra não vazar alias privado no tipo de
    // retorno inferido do método público (TS strict reclama disso).
    const flow: {
      earned:      { points: number; cashback: number };
      redeemed:    { points: number; cashback: number };
      expired:     { points: number; cashback: number };
      circulating: { points: number; cashback: number };
    } = {
      earned:      { points: 0, cashback: 0 },  // EARN + BONUS + REFERRAL
      redeemed:    { points: 0, cashback: 0 },  // REDEEM (absoluto)
      expired:     { points: 0, cashback: 0 },  // EXPIRE
      circulating: { points: 0, cashback: 0 },  // preenchido depois
    };
    for (const row of pointsFlow as any[]) {
      const p = Math.abs(row._sum.points ?? 0);
      const c = Math.abs(row._sum.cashback ?? 0);
      if (row.type === 'EARN' || row.type === 'BONUS' || row.type === 'REFERRAL') {
        flow.earned.points += p;
        flow.earned.cashback += c;
      } else if (row.type === 'REDEEM') {
        flow.redeemed.points += p;
        flow.redeemed.cashback += c;
      } else if (row.type === 'EXPIRE') {
        flow.expired.points += p;
        flow.expired.cashback += c;
      }
    }

    // Saldo circulante = ganho - resgatado - expirado
    flow.circulating = {
      points:   flow.earned.points - flow.redeemed.points - flow.expired.points,
      cashback: +(flow.earned.cashback - flow.redeemed.cashback - flow.expired.cashback).toFixed(2),
    };

    // Enriquece top clientes com pointsValue
    const enrichedTop = topClients.map((c: any) => ({
      ...c,
      pointsValue: +(c.loyaltyPoints * cfg.realsPerPoint).toFixed(2),
    }));

    return {
      enabled: cfg.enabled,
      topClients: enrichedTop,
      tierDistribution: (tierDistribution as any[]).map((r) => ({
        tier: r.tier === '_NONE_' ? null : r.tier,
        count: Number(r.count),
      })),
      flow,
      referral: {
        ...referralStats,
        conversionRate: (referralStats as any).cadastros > 0
          ? +((referralStats as any).conversoes / (referralStats as any).cadastros * 100).toFixed(1)
          : 0,
      },
      activity: {
        activeLast30d: activeCustomers,
        totalCustomers,
        engagementRate: totalCustomers > 0
          ? +((activeCustomers as number) / (totalCustomers as number) * 100).toFixed(1)
          : 0,
      },
      tiers: cfg.tiers,
    };
  }

  /**
   * Cron diário — manda email pra clientes que têm pontos/cashback expirando
   * em ~7 dias. Agrega por cliente (mesmo cliente pode ter várias transactions
   * vencendo no mesmo dia — mandamos 1 email só com a soma).
   *
   * Idempotência: usa marker no Customer (loyaltyExpiryWarnedAt) — só envia se
   * a última warning foi há mais de 6 dias. Evita spam se o cron rodar 2x no
   * mesmo dia ou se manualmente disparado pelo admin.
   *
   * NOTA sobre o marker: como NÃO temos campo dedicado no schema, usamos
   * uma transaction LoyaltyTransaction tipo BONUS de 0 pontos com reason
   * "_expiry_warning_YYYYMMDD" — barato, registra no ledger sem mexer schema.
   */
  async notifyExpiringPoints() {
    const cfg = await (this.prisma as any).settings.findMany({
      select: { tenantId: true, loyaltyConfig: true },
    });

    const today = new Date();
    const sevenDays = new Date(today.getTime() + 7 * 86400000);
    const sixDays   = new Date(today.getTime() + 6 * 86400000);

    let sent = 0;
    for (const s of cfg) {
      const config = (s.loyaltyConfig as any) ?? {};
      if (!config.enabled) continue;
      const allowed = await this.checkFeature.check(s.tenantId, FeatureKey.LOYALTY_PROGRAM);
      if (!allowed) continue;

      // Busca transactions com expiresAt na janela [hoje+6, hoje+7] que ainda
      // não foram expiradas. Agrupa por customer.
      const expiring = await (this.prisma as any).loyaltyTransaction.findMany({
        where: {
          tenantId: s.tenantId,
          expired: false,
          expiresAt: { gte: sixDays, lte: sevenDays },
          type: { in: ['EARN', 'BONUS', 'REFERRAL'] },
        },
        select: { customerId: true, points: true, cashback: true, expiresAt: true },
      });

      // Agrega por cliente
      const byCustomer = new Map<number, { points: number; cashback: number; expiresAt: Date }>();
      for (const tx of expiring) {
        const cur = byCustomer.get(tx.customerId) || { points: 0, cashback: 0, expiresAt: tx.expiresAt };
        cur.points += tx.points;
        cur.cashback += tx.cashback;
        // Pega a data MAIS PRÓXIMA (pra mensagem urgente)
        if (tx.expiresAt < cur.expiresAt) cur.expiresAt = tx.expiresAt;
        byCustomer.set(tx.customerId, cur);
      }

      for (const [customerId, data] of byCustomer) {
        try {
          // Idempotência: já avisou esse cliente nos últimos 6 dias?
          const sixDaysAgo = new Date(today.getTime() - 6 * 86400000);
          const already = await (this.prisma as any).loyaltyTransaction.findFirst({
            where: {
              tenantId: s.tenantId, customerId, type: 'BONUS', points: 0,
              reason: { startsWith: '_expiry_warning_' },
              createdAt: { gte: sixDaysAgo },
            },
          });
          if (already) continue;

          const customer = await (this.prisma as any).customer.findUnique({
            where: { id: customerId },
            select: { name: true, email: true },
          });
          if (!customer?.email) continue;

          await this.mailer.sendPointsExpiringSoon(s.tenantId, {
            email: customer.email,
            name: customer.name || 'Cliente',
            points: data.points,
            cashback: data.cashback,
            expiresAt: data.expiresAt,
            pointsValue: +(data.points * (config.realsPerPoint || 0.05)).toFixed(2),
          });

          // Marker: registra que avisamos. Tipo BONUS com pts=0/cash=0 não
          // afeta saldo, só serve como timestamp idempotente.
          await (this.prisma as any).loyaltyTransaction.create({
            data: {
              tenantId: s.tenantId, customerId, type: 'BONUS', points: 0, cashback: 0,
              reason: `_expiry_warning_${today.toISOString().slice(0, 10)}`,
              expiresAt: null,
            },
          });
          sent++;
        } catch (err: any) {
          this.logger.warn(`notify expiring falhou (customer=${customerId}): ${err.message}`);
        }
      }
    }
    return { sent };
  }

  /**
   * Cron diário — recompõe loyaltyTier de todos os clientes com transações
   * recentes (otimização: não roda em todos pra não estourar). Mantém o tier
   * fresco pros descontos serem aplicados corretamente nos próximos pedidos.
   */
  async recomputeAllTiers() {
    const recent = await (this.prisma as any).$queryRawUnsafe(
      `SELECT DISTINCT "customerId", "tenantId" FROM "Order"
       WHERE "createdAt" >= NOW() - INTERVAL '30 days'`,
    );
    let updated = 0;
    for (const r of recent) {
      try {
        await this.recomputeTier(r.tenantId, r.customerId);
        updated++;
      } catch {/* swallow */}
    }
    return { updated };
  }
}
