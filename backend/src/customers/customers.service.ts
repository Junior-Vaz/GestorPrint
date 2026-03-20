import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  create(createCustomerDto: CreateCustomerDto, tenantId: number) {
    const data: any = { ...createCustomerDto, tenantId };
    if (data.document === '') data.document = null;
    if (data.email === '') data.email = null;
    return this.prisma.customer.create({ data });
  }

  findAll(tenantId: number) {
    return this.prisma.customer.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: number, tenantId: number) {
    return this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
  }

  update(id: number, updateCustomerDto: UpdateCustomerDto, tenantId: number) {
    const data: any = { ...updateCustomerDto };
    if (data.document === '') data.document = null;
    if (data.email === '') data.email = null;
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  remove(id: number, tenantId: number) {
    return this.prisma.customer.deleteMany({
      where: { id, tenantId },
    });
  }
}
