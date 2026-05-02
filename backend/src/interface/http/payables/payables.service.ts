import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CreatePayableDto } from './dto/create-payable.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { PayPayableDto } from './dto/pay-payable.dto';
import { PaginationDto, paginateResult } from '../../../shared/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PayablesService {
  private readonly logger = new Logger(PayablesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreatePayableDto, tenantId: number) {
    return (this.prisma as any).bill.create({
      data: {
        ...dto,
        tenantId,
        dueDate: new Date(dto.dueDate),
        status: 'PENDING',
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
  }

  async findAll(tenantId: number, dto: PaginationDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, status } = dto;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (search) where.description = { contains: search, mode: 'insensitive' };

    const [data, total] = await (this.prisma as any).$transaction([
      (this.prisma as any).bill.findMany({
        where, skip, take: limit,
        orderBy: { dueDate: 'asc' },
        include: { supplier: { select: { id: true, name: true } } },
      }),
      (this.prisma as any).bill.count({ where }),
    ]);
    return paginateResult(data, total, page, limit);
  }

  async findOne(id: number, tenantId: number) {
    const bill = await (this.prisma as any).bill.findFirst({
      where: { id, tenantId },
      include: { supplier: { select: { id: true, name: true, email: true } } },
    });
    if (!bill) throw new NotFoundException('Conta a pagar não encontrada');
    return bill;
  }

  async update(id: number, dto: UpdatePayableDto, tenantId: number) {
    await this.findOne(id, tenantId);
    return (this.prisma as any).bill.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
  }

  async markAsPaid(id: number, dto: PayPayableDto, tenantId: number) {
    await this.findOne(id, tenantId);
    const result = await (this.prisma as any).bill.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAmount: dto.paidAmount,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      },
    });
    await this.audit.logAction(
      null,
      'MARK_PAID',
      'Bill',
      id,
      { paidAmount: dto.paidAmount },
      tenantId,
    );
    return result;
  }

  async cancel(id: number, tenantId: number) {
    await this.findOne(id, tenantId);
    const result = await (this.prisma as any).bill.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.logAction(null, 'CANCEL', 'Bill', id, {}, tenantId);
    return result;
  }

  async remove(id: number, tenantId: number) {
    await this.findOne(id, tenantId);
    await this.audit.logAction(null, 'DELETE', 'Bill', id, {}, tenantId);
    return (this.prisma as any).bill.delete({ where: { id } });
  }

  async getTotals(tenantId: number) {
    const [pending, overdue] = await Promise.all([
      (this.prisma as any).bill.aggregate({
        where: { tenantId, status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      (this.prisma as any).bill.aggregate({
        where: { tenantId, status: 'OVERDUE' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      pendingAmount: pending._sum.amount ?? 0,
      pendingCount: pending._count,
      overdueAmount: overdue._sum.amount ?? 0,
      overdueCount: overdue._count,
    };
  }

  // Roda todo dia às 03:05 — offset de 5min em relação ao job de invoices
  @Cron('5 3 * * *')
  async handleOverdueBills() {
    this.logger.log('Verificando contas a pagar vencidas...');
    const result = await (this.prisma as any).bill.updateMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} conta(s) a pagar marcada(s) como OVERDUE`);
    }
  }
}
