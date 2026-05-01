import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { IPaymentRepository } from '../../application/payments/payment-repository.interface';
import { OrderForPayment, PaymentTransaction } from '../../domain/payments/payment.entity';
import { PaginationDto, PaginatedResult, paginateResult } from '../../shared/dto/pagination.dto';

@Injectable()
export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderWithCustomer(orderId: number): Promise<OrderForPayment | null> {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    }) as any;
  }

  findTransactionById(id: number): Promise<PaymentTransaction | null> {
    return (this.prisma as any).transaction.findUnique({ where: { id } });
  }

  findTransactionByGatewayId(gatewayId: string): Promise<PaymentTransaction | null> {
    return (this.prisma as any).transaction.findUnique({ where: { gatewayId } });
  }

  createTransaction(data: Omit<PaymentTransaction, 'id'>): Promise<PaymentTransaction> {
    return (this.prisma as any).transaction.create({ data });
  }

  async finalizePayment(transactionId: number, orderId: number): Promise<PaymentTransaction> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await (tx as any).transaction.update({
        where: { id: transactionId },
        data: { status: 'PAID' },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'PRODUCTION' } });
      return updated;
    });
  }

  async getFinancialStats() {
    const transactions = await (this.prisma as any).transaction.findMany({ where: { status: 'PAID' } });
    const totalRevenue = transactions.reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    const pendingCount = await (this.prisma as any).transaction.count({ where: { status: 'PENDING' } });
    return { totalRevenue, paidCount: transactions.length, pendingCount };
  }

  getAllTransactions(): Promise<any[]> {
    return (this.prisma as any).transaction.findMany({
      include: { order: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTransactionsPaginated(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<any>> {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, status, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where: any = { order: { tenantId } };
    if (status) where.status = status;
    if (search) where.order = { ...where.order, productDescription: { contains: search, mode: 'insensitive' } };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const include = { order: { include: { customer: true } } };

    const [data, total] = await (this.prisma as any).$transaction([
      (this.prisma as any).transaction.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      (this.prisma as any).transaction.count({ where }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async getMpAccessToken(): Promise<string | null> {
    const settings = await (this.prisma as any).settings.findUnique({ where: { id: 1 } });
    return settings?.mpAccessToken ?? null;
  }
}
