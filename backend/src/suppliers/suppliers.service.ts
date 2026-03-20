import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(createSupplierDto: CreateSupplierDto, tenantId: number) {
    return (this.prisma as any).supplier.create({
      data: { ...createSupplierDto, tenantId },
    });
  }

  async findAll(tenantId: number) {
    return (this.prisma as any).supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
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
