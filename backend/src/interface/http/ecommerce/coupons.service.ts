import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

export type CouponType = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';

export interface CouponDiscount {
  code:           string;
  type:           CouponType;
  discountAmount: number;   // valor abatido do total (em reais)
  freeShipping:   boolean;
  description?:   string;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Públicos (checkout) ─────────────────────────────────────────────────────
  /**
   * Valida um cupom para um pedido em construção.
   * Retorna o desconto a aplicar OU lança BadRequest com mensagem amigável.
   *
   * @param code        código digitado pelo cliente (case-insensitive)
   * @param subtotal    valor dos produtos (sem frete)
   * @param shippingCost valor do frete escolhido
   * @param customerId  cliente logado (opcional — usado pra checar firstOrderOnly e maxUsesPerCustomer)
   */
  async validate(
    tenantId: number,
    code: string,
    subtotal: number,
    shippingCost: number,
    customerId?: number,
  ): Promise<CouponDiscount> {
    if (!code) throw new BadRequestException('Informe o código do cupom');
    const normalized = code.trim().toUpperCase();

    const coupon = await (this.prisma as any).coupon.findFirst({
      where: { tenantId, code: normalized },
    });
    if (!coupon)              throw new BadRequestException('Cupom inválido');
    if (!coupon.active)       throw new BadRequestException('Cupom desativado');

    const now = new Date();
    if (coupon.validFrom  && now < coupon.validFrom)  throw new BadRequestException('Cupom ainda não está valendo');
    if (coupon.validUntil && now > coupon.validUntil) throw new BadRequestException('Cupom expirado');

    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Cupom atingiu o limite de usos');
    }

    if (coupon.minPurchase != null && subtotal < coupon.minPurchase) {
      throw new BadRequestException(
        `Pedido mínimo de R$ ${coupon.minPurchase.toFixed(2).replace('.', ',')} para usar esse cupom`
      );
    }

    if (coupon.firstOrderOnly && customerId) {
      const previousOrders = await (this.prisma as any).order.count({
        where: { tenantId, customerId, source: 'ECOMMERCE', paymentStatus: 'APPROVED' },
      });
      if (previousOrders > 0) throw new BadRequestException('Cupom válido só pra primeira compra');
    }

    if (customerId && coupon.maxUsesPerCustomer > 0) {
      // Conta usos prévios desse cliente com esse cupom (via order details.coupon.code)
      const myUses = await this.countUsesByCustomer(tenantId, normalized, customerId);
      if (myUses >= coupon.maxUsesPerCustomer) {
        throw new BadRequestException('Você já usou esse cupom o máximo de vezes permitido');
      }
    }

    // Calcula desconto
    let discountAmount = 0;
    let freeShipping = false;
    if (coupon.type === 'PERCENT') {
      discountAmount = +(subtotal * (coupon.value / 100)).toFixed(2);
    } else if (coupon.type === 'FIXED') {
      discountAmount = Math.min(coupon.value, subtotal);
    } else if (coupon.type === 'FREE_SHIPPING') {
      freeShipping = true;
      discountAmount = shippingCost || 0;
    } else {
      throw new BadRequestException('Tipo de cupom desconhecido');
    }

    return {
      code:           coupon.code,
      type:           coupon.type,
      discountAmount: +discountAmount.toFixed(2),
      freeShipping,
      description:    coupon.description || undefined,
    };
  }

  /** Conta quantas vezes esse cupom foi aplicado em pedidos APROVADOS desse cliente */
  private async countUsesByCustomer(tenantId: number, code: string, customerId: number): Promise<number> {
    // Carrega pedidos pagos do cliente e filtra no JS pelo coupon code dentro do details.coupon
    const orders = await (this.prisma as any).order.findMany({
      where: { tenantId, customerId, source: 'ECOMMERCE', paymentStatus: { in: ['APPROVED', 'PENDING'] } },
      select: { details: true },
    });
    let count = 0;
    for (const o of orders) {
      const c = (o.details as any)?.coupon?.code;
      if (c === code) count++;
    }
    return count;
  }

  /** Incrementa usedCount após uso bem-sucedido */
  async incrementUse(tenantId: number, code: string) {
    return (this.prisma as any).coupon.updateMany({
      where: { tenantId, code },
      data:  { usedCount: { increment: 1 } },
    });
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
  /**
   * Lista cupons com paginação. Cupons normalmente são poucos por tenant
   * mas paginação aqui evita cair em casos raros de abuso ou tenant grande.
   */
  async list(tenantId: number, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(100, Math.max(10, Math.floor(pageSize) || 20));
    const skip = (safePage - 1) * safeSize;
    const where = { tenantId };
    const [data, total] = await Promise.all([
      (this.prisma as any).coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeSize,
      }),
      (this.prisma as any).coupon.count({ where }),
    ]);
    return { data, total, page: safePage, pageSize: safeSize };
  }

  async getOne(tenantId: number, id: number) {
    const c = await (this.prisma as any).coupon.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Cupom não encontrado');
    return c;
  }

  async create(tenantId: number, data: any) {
    if (!data.code || !data.type) throw new BadRequestException('Código e tipo obrigatórios');
    if (!['PERCENT', 'FIXED', 'FREE_SHIPPING'].includes(data.type)) {
      throw new BadRequestException('Tipo inválido (use PERCENT, FIXED ou FREE_SHIPPING)');
    }
    const code = String(data.code).trim().toUpperCase();
    return (this.prisma as any).coupon.create({
      data: {
        tenantId,
        code,
        description:        data.description || null,
        type:               data.type,
        value:              Number(data.value || 0),
        minPurchase:        data.minPurchase != null ? Number(data.minPurchase) : null,
        maxUses:            data.maxUses != null ? Number(data.maxUses) : null,
        maxUsesPerCustomer: data.maxUsesPerCustomer != null ? Number(data.maxUsesPerCustomer) : 1,
        validFrom:          data.validFrom ? new Date(data.validFrom) : null,
        validUntil:         data.validUntil ? new Date(data.validUntil) : null,
        firstOrderOnly:     !!data.firstOrderOnly,
        active:             data.active !== false,
      },
    });
  }

  async update(tenantId: number, id: number, data: any) {
    await this.getOne(tenantId, id);
    return (this.prisma as any).coupon.update({
      where: { id },
      data: {
        code:               data.code ? String(data.code).trim().toUpperCase() : undefined,
        description:        data.description,
        type:               data.type,
        value:              data.value != null ? Number(data.value) : undefined,
        minPurchase:        data.minPurchase != null ? Number(data.minPurchase) : undefined,
        maxUses:            data.maxUses != null ? Number(data.maxUses) : undefined,
        maxUsesPerCustomer: data.maxUsesPerCustomer != null ? Number(data.maxUsesPerCustomer) : undefined,
        validFrom:          data.validFrom !== undefined ? (data.validFrom ? new Date(data.validFrom) : null) : undefined,
        validUntil:         data.validUntil !== undefined ? (data.validUntil ? new Date(data.validUntil) : null) : undefined,
        firstOrderOnly:     data.firstOrderOnly,
        active:             data.active,
      },
    });
  }

  async delete(tenantId: number, id: number) {
    await this.getOne(tenantId, id);
    await (this.prisma as any).coupon.delete({ where: { id } });
    return { ok: true };
  }
}
