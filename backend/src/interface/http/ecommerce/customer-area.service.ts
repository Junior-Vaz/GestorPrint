import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class CustomerAreaService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Endereços ──────────────────────────────────────────────────────────────
  listAddresses(customerId: number) {
    return (this.prisma as any).customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
  }

  async createAddress(customerId: number, tenantId: number, data: any) {
    // Validação básica antes de tocar no DB
    if (!data?.cep || !data?.street || !data?.number || !data?.neighborhood || !data?.city || !data?.state) {
      throw new BadRequestException('Endereço incompleto. Preencha CEP, rua, número, bairro, cidade e estado.');
    }
    // Coerção de tipos defensiva — frontend pode mandar number/null/undefined
    // em campos string. Prisma rejeita type mismatch e gera 500 genérico.
    const cep = String(data.cep || '').replace(/\D/g, '');
    if (cep.length !== 8) throw new BadRequestException('CEP inválido (precisa ter 8 dígitos).');

    const state = String(data.state || '').toUpperCase().slice(0, 2);
    if (state.length !== 2) throw new BadRequestException('UF inválida.');

    // Garante que o customer existe antes de criar — evita FK violation P2003
    // quando o JWT é válido mas o customer foi deletado/migrado. Devolve 401
    // pra forçar logout no SPA (apiFetch → clearCustomerSession → login).
    const customerExists = await (this.prisma as any).customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true },
    });
    if (!customerExists) {
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }

    try {
      // Se for o primeiro endereço ou marcado como default, garante que só ele é default
      if (data.isDefault) {
        await (this.prisma as any).customerAddress.updateMany({
          where: { customerId },
          data:  { isDefault: false },
        });
      }
      const count = await (this.prisma as any).customerAddress.count({ where: { customerId } });
      return await (this.prisma as any).customerAddress.create({
        data: {
          tenantId,
          customerId,
          label:        data.label ? String(data.label).slice(0, 50) : null,
          cep,
          street:       String(data.street).slice(0, 200),
          number:       String(data.number).slice(0, 20),
          complement:   data.complement ? String(data.complement).slice(0, 100) : null,
          neighborhood: String(data.neighborhood).slice(0, 100),
          city:         String(data.city).slice(0, 100),
          state,
          isDefault:    !!data.isDefault || count === 0,    // primeiro vira default
        },
      });
    } catch (e: any) {
      // Loga o erro real do Prisma — antes só dava 500 genérico sem pista
      console.error('[createAddress] Falha Prisma:', e?.message, e?.code, e?.meta);
      throw new BadRequestException(
        e?.code === 'P2002' ? 'Endereço duplicado' :
        e?.code === 'P2003' ? 'Cliente inválido' :
        'Erro ao salvar endereço. Tente novamente.',
      );
    }
  }

  async updateAddress(customerId: number, addressId: number, data: any) {
    const addr = await (this.prisma as any).customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!addr) throw new NotFoundException('Endereço não encontrado');

    if (data.isDefault) {
      await (this.prisma as any).customerAddress.updateMany({
        where: { customerId, id: { not: addressId } },
        data:  { isDefault: false },
      });
    }
    return (this.prisma as any).customerAddress.update({
      where: { id: addressId },
      data:  {
        label:        data.label,
        cep:          data.cep ? String(data.cep).replace(/\D/g, '') : undefined,
        street:       data.street,
        number:       data.number,
        complement:   data.complement,
        neighborhood: data.neighborhood,
        city:         data.city,
        state:        data.state ? String(data.state).toUpperCase().slice(0, 2) : undefined,
        isDefault:    data.isDefault,
      },
    });
  }

  async deleteAddress(customerId: number, addressId: number) {
    const addr = await (this.prisma as any).customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!addr) throw new NotFoundException('Endereço não encontrado');
    await (this.prisma as any).customerAddress.delete({ where: { id: addressId } });
    // Se o deletado era default, promove outro
    if (addr.isDefault) {
      const next = await (this.prisma as any).customerAddress.findFirst({
        where: { customerId },
        orderBy: { id: 'asc' },
      });
      if (next) {
        await (this.prisma as any).customerAddress.update({
          where: { id: next.id },
          data:  { isDefault: true },
        });
      }
    }
    return { ok: true };
  }

  // ── Pedidos do cliente ─────────────────────────────────────────────────────
  async listOrders(customerId: number, tenantId: number, page = 1, pageSize = 10) {
    const where = { customerId, tenantId, source: 'ECOMMERCE' };
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(50, Math.max(1, Math.floor(pageSize) || 10));
    const skip = (safePage - 1) * safeSize;

    const [data, total] = await Promise.all([
      (this.prisma as any).order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeSize,
        select: {
          id: true, uuid: true, productDescription: true, amount: true,
          status: true, paymentStatus: true, paymentMethod: true,
          shippingService: true, shippingCarrier: true, trackingCode: true,
          shippingStatus: true, createdAt: true, deliveryDate: true,
          details: true,
        },
      }),
      (this.prisma as any).order.count({ where }),
    ]);
    return { data, total, page: safePage, pageSize: safeSize };
  }

  async getOrder(customerId: number, tenantId: number, orderUuid: string) {
    const order = await (this.prisma as any).order.findFirst({
      where: { uuid: orderUuid, customerId, tenantId, source: 'ECOMMERCE' },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }

  // ── Wishlist ───────────────────────────────────────────────────────────────
  async listWishlist(customerId: number, tenantId: number) {
    const items = await (this.prisma as any).wishlistItem.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true, name: true, slug: true, photos: true,
            unitPrice: true, unit: true, stock: true, visibleInStore: true,
            productType: { select: { name: true, color: true, visibleInStore: true } },
          },
        },
      },
    });
    // Filtra produtos que viraram invisíveis ou foram removidos
    return items
      .filter((i: any) => i.product?.visibleInStore && i.product?.productType?.visibleInStore)
      .map((i: any) => ({
        id:           i.id,
        productId:    i.product.id,
        slug:         i.product.slug,
        name:         i.product.name,
        unitPrice:    i.product.unitPrice,
        unit:         i.product.unit,
        stock:        i.product.stock,
        photo:        i.product.photos?.[0] || null,
        category:     i.product.productType?.name,
        categoryColor: i.product.productType?.color,
        addedAt:      i.createdAt,
      }));
  }

  async addToWishlist(customerId: number, productId: number, tenantId: number) {
    // Verifica que o produto existe no tenant
    const product = await (this.prisma as any).product.findFirst({
      where: { id: productId, tenantId, visibleInStore: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    // Idempotente: se já tá lá, não falha (upsert via unique constraint)
    return (this.prisma as any).wishlistItem.upsert({
      where:  { customerId_productId: { customerId, productId } },
      create: { customerId, productId },
      update: {},
    });
  }

  async removeFromWishlist(customerId: number, productId: number) {
    await (this.prisma as any).wishlistItem.deleteMany({
      where: { customerId, productId },
    });
    return { ok: true };
  }

  /**
   * Sincroniza wishlist local (do localStorage do guest) com o servidor.
   * Faz merge sem duplicar — útil pra quando o cliente faz login.
   */
  async syncWishlist(customerId: number, tenantId: number, productIds: any) {
    // Coerção defensiva: cliente pode mandar array misto (números, strings, null,
    // NaN). Convertemos cada item pra número e filtramos só inteiros positivos.
    const arr = Array.isArray(productIds) ? productIds : [];
    const cleanIds: number[] = arr
      .map(v => Number(v))
      .filter(n => Number.isInteger(n) && n > 0);

    if (!cleanIds.length) return this.listWishlist(customerId, tenantId);

    // Filtra apenas IDs válidos do tenant
    const validProducts = await (this.prisma as any).product.findMany({
      where: { id: { in: cleanIds }, tenantId, visibleInStore: true },
      select: { id: true },
    });
    const validIds: number[] = validProducts.map((p: any) => p.id);

    // Insere todos via createMany com skipDuplicates (a unique constraint garante idempotência)
    if (validIds.length) {
      await (this.prisma as any).wishlistItem.createMany({
        data: validIds.map(productId => ({ customerId, productId })),
        skipDuplicates: true,
      });
    }
    return this.listWishlist(customerId, tenantId);
  }
}
