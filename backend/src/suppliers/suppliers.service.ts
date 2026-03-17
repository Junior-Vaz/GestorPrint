import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(createSupplierDto: CreateSupplierDto) {
    return (this.prisma as any).supplier.create({
      data: createSupplierDto,
    });
  }

  async findAll() {
    return (this.prisma as any).supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    return (this.prisma as any).supplier.findUnique({
      where: { id },
      include: { expenses: true },
    });
  }

  async update(id: number, updateSupplierDto: UpdateSupplierDto) {
    return (this.prisma as any).supplier.update({
      where: { id },
      data: updateSupplierDto,
    });
  }

  async remove(id: number) {
    return (this.prisma as any).supplier.delete({
      where: { id },
    });
  }
}
