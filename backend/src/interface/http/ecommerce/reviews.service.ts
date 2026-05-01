import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Públicos ────────────────────────────────────────────────────────────────
  /** Reviews em destaque pra home — só com comentário, ordenadas por mais recentes */
  async listFeatured(tenantId: number, limit = 6) {
    const reviews = await (this.prisma as any).review.findMany({
      where: {
        tenantId,
        status: 'PUBLISHED',
        rating: { gte: 4 },              // só reviews positivas (4 ou 5 estrelas)
        comment: { not: null },          // sem comentário não rende UI bonita
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true } },
        product:  { select: { id: true, name: true, slug: true } },
      },
      take: limit,
    });
    return reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      createdAt: r.createdAt,
      customerName: this.maskName(r.customer?.name || 'Cliente'),
      productName: r.product?.name,
      productSlug: r.product?.slug,
    }));
  }

  async listForProduct(tenantId: number, productId: number, page = 1, pageSize = 10) {
    const where = { tenantId, productId, status: 'PUBLISHED' };
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(50, Math.max(1, Math.floor(pageSize) || 10));
    const skip = (safePage - 1) * safeSize;

    const [reviews, total] = await Promise.all([
      (this.prisma as any).review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
        skip,
        take: safeSize,
      }),
      (this.prisma as any).review.count({ where }),
    ]);
    const data = reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      photos: r.photos,
      createdAt: r.createdAt,
      customerName: this.maskName(r.customer?.name || 'Cliente'),
    }));
    return { data, total, page: safePage, pageSize: safeSize };
  }

  /** Estatística agregada — usada no detalhe do produto */
  async getProductStats(tenantId: number, productId: number) {
    const where = { tenantId, productId, status: 'PUBLISHED' };
    const [agg, count] = await Promise.all([
      (this.prisma as any).review.aggregate({ where, _avg: { rating: true } }),
      (this.prisma as any).review.count({ where }),
    ]);
    return {
      reviewCount: count,
      avgRating: agg?._avg?.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    };
  }

  // ── Customer (autenticado) ──────────────────────────────────────────────────
  async createForCustomer(customerId: number, tenantId: number, data: any) {
    const productId = Number(data.productId);
    const rating = Math.max(1, Math.min(5, Number(data.rating) || 0));
    if (!productId || !rating) throw new BadRequestException('productId e rating obrigatórios');

    // Valida que o cliente tem algum pedido entregue/pronto com esse produto.
    // Carrega os últimos 10 pedidos do cliente e filtra no JS — JSON path no Prisma exige
    // scalar filter (não dá pra usar `not: undefined` direto em campo Json).
    const recentOrders = await (this.prisma as any).order.findMany({
      where: {
        tenantId,
        customerId,
        source: 'ECOMMERCE',
        status: { in: ['FINISHED', 'DELIVERED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, details: true },
    });
    let validOrderId: number | null = null;
    for (const o of recentOrders) {
      const items = (o.details as any)?.items || [];
      if (items.some((i: any) => i.id === productId)) {
        validOrderId = o.id;
        break;
      }
    }
    if (!validOrderId) {
      // Permissivo: se não encontra pedido, ainda permite mas marca PENDING pra moderação
      // (em ambientes de prod onde os pedidos foram migrados ou sem details)
    }

    // Verifica se já tem review (unique constraint cobre, mas previne erro feio)
    const existing = await (this.prisma as any).review.findUnique({
      where: { customerId_productId: { customerId, productId } },
    });
    if (existing) {
      // Atualiza em vez de criar
      return (this.prisma as any).review.update({
        where: { id: existing.id },
        data: {
          rating,
          title:   data.title || null,
          comment: data.comment || null,
          photos:  Array.isArray(data.photos) ? data.photos : existing.photos,
          status:  validOrderId ? 'PUBLISHED' : 'PENDING',
        },
      });
    }

    return (this.prisma as any).review.create({
      data: {
        tenantId,
        productId,
        customerId,
        orderId: validOrderId,
        rating,
        title:   data.title || null,
        comment: data.comment || null,
        photos:  Array.isArray(data.photos) ? data.photos : [],
        status:  validOrderId ? 'PUBLISHED' : 'PENDING',
      },
    });
  }

  listMyReviews(customerId: number) {
    return (this.prisma as any).review.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { id: true, name: true, slug: true, photos: true } } },
    });
  }

  async deleteMyReview(customerId: number, reviewId: number) {
    // deleteMany c/ customerId ancora ownership na própria query
    const result = await (this.prisma as any).review.deleteMany({
      where: { id: reviewId, customerId },
    });
    if (result.count === 0) throw new NotFoundException('Avaliação não encontrada');
    return { ok: true };
  }

  // ── Admin (moderação) ───────────────────────────────────────────────────────
  /**
   * Lista reviews paginadas pra moderação. Aceita filtro por status (PENDING,
   * PUBLISHED, REJECTED). Default pageSize 20 — admin geralmente quer ver as
   * pendentes primeiro e moderar em lote.
   */
  async listAdmin(tenantId: number, status?: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(100, Math.max(10, Math.floor(pageSize) || 20));
    const skip = (safePage - 1) * safeSize;
    const where: any = { tenantId };
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      (this.prisma as any).review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          product:  { select: { id: true, name: true, slug: true } },
        },
        skip,
        take: safeSize,
      }),
      (this.prisma as any).review.count({ where }),
    ]);
    return { data, total, page: safePage, pageSize: safeSize };
  }

  async updateStatus(tenantId: number, reviewId: number, status: string) {
    if (!['PUBLISHED', 'PENDING', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Status inválido');
    }
    const result = await (this.prisma as any).review.updateMany({
      where: { id: reviewId, tenantId },
      data:  { status },
    });
    if (result.count === 0) throw new NotFoundException('Avaliação não encontrada');
    return (this.prisma as any).review.findUnique({ where: { id: reviewId } });
  }

  async deleteAdmin(tenantId: number, reviewId: number) {
    const result = await (this.prisma as any).review.deleteMany({
      where: { id: reviewId, tenantId },
    });
    if (result.count === 0) throw new NotFoundException('Avaliação não encontrada');
    return { ok: true };
  }

  /** "Maria Silva" → "Maria S." pra preservar privacidade na exibição pública */
  private maskName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
}
