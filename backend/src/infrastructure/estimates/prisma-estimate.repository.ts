import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { IEstimateRepository, EstimateData } from '../../application/estimates/estimate-repository.interface';
import { PaginationDto, PaginatedResult, paginateResult } from '../../shared/dto/pagination.dto';

const ESTIMATE_INCLUDE = {
  customer: true,
  salesperson: { select: { id: true, name: true } },
};

@Injectable()
export class PrismaEstimateRepository implements IEstimateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<EstimateData>> {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, status, type, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) where.customer = { name: { contains: search, mode: 'insensitive' } };
    if (status) where.status = status;
    if (type) where.estimateType = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const [data, total] = await (this.prisma as any).$transaction([
      (this.prisma.estimate as any).findMany({ where, include: ESTIMATE_INCLUDE, orderBy: { id: 'desc' }, skip, take: limit }),
      (this.prisma.estimate as any).count({ where }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  findOne(id: number, tenantId: number): Promise<EstimateData | null> {
    return (this.prisma.estimate as any).findFirst({
      where: { id, tenantId },
      include: ESTIMATE_INCLUDE,
    });
  }

  findWithOrders(id: number, tenantId: number): Promise<any | null> {
    return (this.prisma.estimate as any).findFirst({
      where: { id, tenantId },
      include: { ...ESTIMATE_INCLUDE, orders: true },
    });
  }

  async updateStatus(id: number, status: string): Promise<any> {
    return this.prisma.estimate.update({ where: { id }, data: { status } as any });
  }

  async createOrder(data: {
    customerId: number;
    estimateId: number;
    salespersonId?: number | null;
    tenantId: number;
    productDescription: string;
    amount: number;
    status: string;
  }) {
    return this.prisma.order.create({ data: data as any });
  }

  /** Linka todos os anexos de um orçamento ao pedido criado a partir dele. */
  async migrateAttachments(estimateId: number, orderId: number): Promise<number> {
    const result = await (this.prisma as any).attachment.updateMany({
      where: { estimateId },
      data: { orderId },
    });
    return result.count;
  }
}
