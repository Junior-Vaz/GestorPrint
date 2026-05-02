import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { PaginationDto, PaginatedResult, paginateResult } from '../../../shared/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(createSupplierDto: CreateSupplierDto, tenantId: number) {
    const created = await (this.prisma as any).supplier.create({
      data: { ...createSupplierDto, tenantId },
    });
    await this.audit.logAction(
      null,
      'CREATE',
      'Supplier',
      created.id,
      { name: created.name, category: created.category, email: created.email },
      tenantId,
    );
    return created;
  }

  async findAll(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<any>> {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await (this.prisma as any).$transaction([
      (this.prisma as any).supplier.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
      (this.prisma as any).supplier.count({ where }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async findAllInternal(tenantId: number) {
    return (this.prisma as any).supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async findOne(id: number, tenantId: number) {
    return (this.prisma as any).supplier.findFirst({
      where: { id, tenantId },
      include: { expenses: true },
    });
  }

  async update(id: number, updateSupplierDto: UpdateSupplierDto, tenantId: number) {
    const result = await (this.prisma as any).supplier.updateMany({
      where: { id, tenantId },
      data: updateSupplierDto,
    });
    await this.audit.logAction(
      null,
      'UPDATE',
      'Supplier',
      id,
      { changedFields: Object.keys(updateSupplierDto) },
      tenantId,
    );
    return result;
  }

  async remove(id: number, tenantId: number) {
    const result = await (this.prisma as any).supplier.deleteMany({
      where: { id, tenantId },
    });
    await this.audit.logAction(null, 'DELETE', 'Supplier', id, {}, tenantId);
    return result;
  }
}
