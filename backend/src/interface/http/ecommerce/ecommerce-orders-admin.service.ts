import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { EcommerceMailerService } from './ecommerce-mailer.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

export interface AdminOrderFilters {
  status?: string;          // PENDING | PRODUCTION | FINISHED | DELIVERED
  paymentStatus?: string;   // PENDING | APPROVED | REJECTED
  search?: string;          // busca em #id ou nome do cliente
}

// Status de produção que dispara crédito de fidelidade. FINISHED já é OK pra
// creditar (cliente comprou e pagou — produto pronto), DELIVERED reforça caso
// a gráfica pule de PRODUCTION direto pra DELIVERED. Idempotência fica no
// LoyaltyService via Order.loyaltyProcessed.
const LOYALTY_TRIGGER_STATUSES = new Set(['FINISHED', 'DELIVERED']);

@Injectable()
export class EcommerceOrdersAdminService {
  private readonly logger = new Logger(EcommerceOrdersAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: EcommerceMailerService,
    private readonly loyalty: LoyaltyService,
  ) {}

  /** Lista pedidos do ecommerce com filtros + paginação */
  async list(tenantId: number, filters: AdminOrderFilters = {}, page = 1, pageSize = 20) {
    const where: any = { tenantId, source: 'ECOMMERCE' };
    if (filters.status)        where.status = filters.status;
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters.search) {
      const s = filters.search.trim();
      const idMatch = s.replace(/[^0-9]/g, '');
      where.OR = [
        ...(idMatch ? [{ id: parseInt(idMatch, 10) }] : []),
        { customer: { name: { contains: s, mode: 'insensitive' } } },
        { customer: { email: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(100, Math.max(5, Math.floor(pageSize) || 20));
    const skip = (safePage - 1) * safeSize;

    const [data, total] = await Promise.all([
      (this.prisma as any).order.findMany({
        where,
        include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeSize,
      }),
      (this.prisma as any).order.count({ where }),
    ]);

    return { data, total, page: safePage, pageSize: safeSize };
  }

  /** KPIs do dashboard de pedidos */
  async stats(tenantId: number) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const baseWhere: any = { tenantId, source: 'ECOMMERCE' };
    const [awaitingPayment, paidToday, inProduction, awaitingShipping, todayCount, todayRevenue] = await Promise.all([
      (this.prisma as any).order.count({ where: { ...baseWhere, paymentStatus: 'PENDING' } }),
      (this.prisma as any).order.count({ where: { ...baseWhere, paymentStatus: 'APPROVED', createdAt: { gte: todayStart } } }),
      (this.prisma as any).order.count({ where: { ...baseWhere, status: 'PRODUCTION' } }),
      (this.prisma as any).order.count({ where: { ...baseWhere, status: 'FINISHED', shippingStatus: { not: 'POSTED' } } }),
      (this.prisma as any).order.count({ where: { ...baseWhere, createdAt: { gte: todayStart } } }),
      (this.prisma as any).order.aggregate({
        where: { ...baseWhere, paymentStatus: 'APPROVED', createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
    ]);

    return {
      awaitingPayment,
      paidToday,
      inProduction,
      awaitingShipping,
      todayCount,
      todayRevenue: todayRevenue?._sum?.amount || 0,
    };
  }

  /** Detalhe completo do pedido */
  async getOne(tenantId: number, orderId: number) {
    const order = await (this.prisma as any).order.findFirst({
      where: { id: orderId, tenantId, source: 'ECOMMERCE' },
      include: { customer: true, attachments: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }

  /** Atualiza status de produção (PENDING → PRODUCTION → FINISHED → DELIVERED) */
  async updateStatus(tenantId: number, orderId: number, newStatus: string) {
    const allowed = ['PENDING', 'PRODUCTION', 'FINISHED', 'DELIVERED'];
    if (!allowed.includes(newStatus)) throw new BadRequestException('Status inválido');

    // updateMany c/ tenantId+source ancora a checagem na query — sem race
    // condition entre find e update.
    const result = await (this.prisma as any).order.updateMany({
      where: { id: orderId, tenantId, source: 'ECOMMERCE' },
      data:  { status: newStatus },
    });
    if (result.count === 0) throw new NotFoundException('Pedido não encontrado');

    // Crédito de fidelidade: dispara quando o pedido fecha. Fire-and-forget —
    // erro aqui não derruba o update (a fidelidade é um feature secundário).
    if (LOYALTY_TRIGGER_STATUSES.has(newStatus)) {
      this.loyalty.creditOrderEarnings(orderId).catch((err) =>
        this.logger.warn(`Loyalty credit falhou pro ecommerce order ${orderId}: ${err.message}`),
      );
    }

    return (this.prisma as any).order.findUnique({ where: { id: orderId } });
  }

  /** Atualiza tracking + status de envio. Dispara email se for o primeiro tracking. */
  async updateShipping(tenantId: number, orderId: number, data: { trackingCode?: string; shippingStatus?: string; shippingLabelUrl?: string }) {
    const order = await (this.prisma as any).order.findFirst({
      where: { id: orderId, tenantId, source: 'ECOMMERCE' },
      include: { customer: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    // updateMany aqui também — o find é só pra ler order.customer pro email,
    // mas o write precisa ancorar tenantId pra defesa em camadas.
    await (this.prisma as any).order.updateMany({
      where: { id: orderId, tenantId, source: 'ECOMMERCE' },
      data: {
        trackingCode:     data.trackingCode     ?? order.trackingCode,
        shippingStatus:   data.shippingStatus   ?? order.shippingStatus,
        shippingLabelUrl: data.shippingLabelUrl ?? order.shippingLabelUrl,
      },
    });
    const updated = await (this.prisma as any).order.findUnique({ where: { id: orderId } });

    // Se acabou de receber tracking (não tinha antes), avisa o cliente
    const newTracking = data.trackingCode && data.trackingCode !== order.trackingCode;
    if (newTracking && order.customer?.email) {
      const items = (order.details as any)?.items || [];
      this.mailer.sendOrderShipped(tenantId, {
        orderId:       order.id,
        orderUuid:     order.uuid,
        customerName:  order.customer.name || '',
        customerEmail: order.customer.email,
        amount:        order.amount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        items:         items.map((i: any) => ({ name: i.name, qty: i.qty, lineTotal: i.lineTotal })),
        trackingCode:  data.trackingCode!,
        carrier:       order.shippingCarrier,
      }).catch(() => { /* logado no mailer */ });
    }

    return updated;
  }
}
