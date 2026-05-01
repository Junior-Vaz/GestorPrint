import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { PaginationDto, PaginatedResult, paginateResult } from '../../../shared/dto/pagination.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(createSupplierDto: CreateSupplierDto, tenantId: number) {
    return (this.prisma as any).supplier.create({
      data: { ...createSupplierDto, tenantId },
    });
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
    return (this.prisma as any).supplier.updateMany({
      where: { id, tenantId },
      data: updateSupplierDto,
    });
  }

  async remove(id: number, tenantId: number) {
    return (this.prisma as any).supplier.deleteMany({
      where: { id, tenantId },
    });
  }
}
