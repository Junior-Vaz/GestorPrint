import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { IOrderRepository, CreateOrderData, OrderSummary } from '../../application/orders/order-repository.interface';
import { OrderStatus } from '../../domain/orders/order.entity';
import { PaginationDto, PaginatedResult, paginateResult } from '../../shared/dto/pagination.dto';

const ORDER_INCLUDE = {
  customer: true,
  salesperson: true,
  producer: true,
  attachments: true,
  transactions: { orderBy: { createdAt: 'desc' as const } },
};

function mapOrder(o: any): OrderSummary {
  return {
    id: o.id,
    uuid: o.uuid ?? null,
    customerName: o.customer.name,
    customerPhone: o.customer.phone ?? null,
    productDescription: o.productDescription,
    amount: o.amount,
    status: o.status,
    salesperson: o.salesperson ? { id: o.salesperson.id, name: o.salesperson.name } : null,
    producer: o.producer ? { id: o.producer.id, name: o.producer.name } : null,
    createdAt: o.createdAt.toISOString(),
    deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString() : null,
    priority: o.priority ?? 'NORMAL',
    attachments: o.attachments ?? [],
    transactions: o.transactions ?? [],
    details: o.details,
    estimateId: o.estimateId,
    tenantId: o.tenantId,
    notes: o.notes ?? null,
    source: o.source ?? 'ERP',
    // Pagamento — necessário pra UI do Kanban decidir como verificar status:
    //  - Se ECOMMERCE com paymentExternalId, usa refresh-payment do MP.
    //  - Se ERP/PDV, usa transactions[].
    //  - Se já APPROVED, evita re-consultar o gateway.
    paymentStatus:     o.paymentStatus     ?? null,
    paymentMethod:     o.paymentMethod     ?? null,
    paymentExternalId: o.paymentExternalId ?? null,
  };
}

@Injectable()
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertFkOwnership(
    fks: { salespersonId?: number | null; producerId?: number | null; estimateId?: number | null },
    tenantId: number,
  ): Promise<void> {
    if (fks.salespersonId) {
      const u = await (this.prisma as any).user.findFirst({
        where: { id: fks.salespersonId, tenantId },
      });
      if (!u) throw new BadRequestException('Vendedor inválido');
    }
    if (fks.producerId) {
      const u = await (this.prisma as any).user.findFirst({
        where: { id: fks.producerId, tenantId },
      });
      if (!u) throw new BadRequestException('Produtor inválido');
    }
    if (fks.estimateId) {
      const e = await (this.prisma as any).estimate.findFirst({
        where: { id: fks.estimateId, tenantId },
      });
      if (!e) throw new BadRequestException('Orçamento inválido');
    }
  }

  findTenantLimits(tenantId: number) {
    return (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { maxOrders: true, isActive: true, planStatus: true },
    });
  }

  countOrdersThisMonth(tenantId: number): Promise<number> {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return (this.prisma as any).order.count({ where: { tenantId, createdAt: { gte: startOfMonth } } });
  }

  async findOrCreateCustomer(name: string, tenantId: number) {
    let customer = await this.prisma.customer.findFirst({ where: { name, tenantId } as any });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { name, email: `contato_${Date.now()}@exemplo.com`, tenantId } as any,
      });
    }
    return { id: customer.id, name: (customer as any).name, phone: (customer as any).phone ?? null };
  }

  /** Busca cliente pelo ID — preferido sobre findOrCreateCustomer quando o
   *  caller já tem o ID (PDV/checkout). Filtra por tenantId pra evitar
   *  cross-tenant leak. */
  async findCustomerById(customerId: number, tenantId: number) {
    const customer = await (this.prisma.customer as any).findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, name: true, phone: true },
    });
    if (!customer) return null;
    return { id: customer.id, name: customer.name, phone: customer.phone ?? null };
  }

  async createOrder(data: CreateOrderData & { customerId: number; initialStatus: OrderStatus }): Promise<OrderSummary> {
    const newOrder = await (this.prisma.order as any).create({
      data: {
        productDescription: data.productDescription,
        amount: data.amount,
        status: data.initialStatus,
        customerId: data.customerId,
        tenantId: data.tenantId,
        salespersonId: data.salespersonId || null,
        producerId: data.producerId || null,
        details: data.details || null,
        estimateId: data.estimateId || null,
      },
      include: ORDER_INCLUDE,
    });
    return mapOrder(newOrder);
  }

  async createTransaction(data: {
    orderId: number;
    amount: number;
    status: string;
    paymentType: string;
    gatewayId: string;
  }): Promise<void> {
    await (this.prisma as any).transaction.create({ data });
  }

  async findAll(tenantId: number): Promise<OrderSummary[]> {
    const orders = await (this.prisma as any).order.findMany({
      where: { tenantId },
      include: ORDER_INCLUDE,
      orderBy: { id: 'desc' },
    });
    return orders.map(mapOrder);
  }

  async findAllPaginated(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<OrderSummary>> {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, status, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { productDescription: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const [orders, total] = await (this.prisma as any).$transaction([
      (this.prisma as any).order.findMany({ where, include: ORDER_INCLUDE, orderBy: { id: 'desc' }, skip, take: limit }),
      (this.prisma as any).order.count({ where }),
    ]);

    return paginateResult(orders.map(mapOrder), total, page, limit);
  }

  async findOne(id: number, tenantId: number): Promise<OrderSummary | null> {
    const o = await (this.prisma as any).order.findFirst({ where: { id, tenantId }, include: ORDER_INCLUDE });
    return o ? mapOrder(o) : null;
  }

  findOneRaw(id: number, tenantId: number): Promise<any> {
    return (this.prisma as any).order.findFirst({
      where: { id, tenantId },
      include: { customer: true, estimate: true },
    });
  }

  async update(id: number, data: any): Promise<OrderSummary> {
    const updated = await (this.prisma.order as any).update({
      where: { id },
      data,
      include: { ...ORDER_INCLUDE, estimate: true },
    });
    return mapOrder(updated);
  }

  async findPaidTransaction(orderId: number): Promise<boolean> {
    const tx = await (this.prisma as any).transaction.findFirst({ where: { orderId, status: 'PAID' } });
    return !!tx;
  }

  async remove(id: number, tenantId: number): Promise<any> {
    return this.prisma.order.deleteMany({ where: { id, tenantId } as any });
  }
}
