import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { UpdateReceivableDto } from './dto/update-receivable.dto';
import { PayReceivableDto } from './dto/pay-receivable.dto';
import { PaginationDto, paginateResult } from '../../../shared/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReceivablesService {
  private readonly logger = new Logger(ReceivablesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateReceivableDto, tenantId: number) {
    return (this.prisma as any).invoice.create({
      data: {
        ...dto,
        tenantId,
        dueDate: new Date(dto.dueDate),
        status: 'PENDING',
      },
      include: { customer: { select: { id: true, name: true } } },
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
      (this.prisma as any).invoice.findMany({
        where, skip, take: limit,
        orderBy: { dueDate: 'asc' },
        include: { customer: { select: { id: true, name: true } } },
      }),
      (this.prisma as any).invoice.count({ where }),
    ]);
    return paginateResult(data, total, page, limit);
  }

  async findOne(id: number, tenantId: number) {
    const invoice = await (this.prisma as any).invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, productDescription: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Recebível não encontrado');
    return invoice;
  }

  async update(id: number, dto: UpdateReceivableDto, tenantId: number) {
    await this.findOne(id, tenantId);
    return (this.prisma as any).invoice.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: { customer: { select: { id: true, name: true } } },
    });
  }

  async markAsPaid(id: number, dto: PayReceivableDto, tenantId: number) {
    await this.findOne(id, tenantId);
    const result = await (this.prisma as any).invoice.update({
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
      'Invoice',
      id,
      { paidAmount: dto.paidAmount },
      tenantId,
    );
    return result;
  }

  async cancel(id: number, tenantId: number) {
    await this.findOne(id, tenantId);
    const result = await (this.prisma as any).invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.logAction(null, 'CANCEL', 'Invoice', id, {}, tenantId);
    return result;
  }

  async remove(id: number, tenantId: number) {
    await this.findOne(id, tenantId);
    await this.audit.logAction(null, 'DELETE', 'Invoice', id, {}, tenantId);
    return (this.prisma as any).invoice.delete({ where: { id } });
  }

  async getTotals(tenantId: number) {
    const [pending, overdue] = await Promise.all([
      (this.prisma as any).invoice.aggregate({
        where: { tenantId, status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      (this.prisma as any).invoice.aggregate({
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

  // Roda todo dia às 03:00 — flipa PENDING → OVERDUE onde dueDate < agora
  @Cron('0 3 * * *')
  async handleOverdueInvoices() {
    this.logger.log('Verificando recebíveis vencidos...');
    const result = await (this.prisma as any).invoice.updateMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} fatura(s) marcada(s) como OVERDUE`);
    }
  }
}
