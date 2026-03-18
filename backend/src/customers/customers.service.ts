import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  create(createCustomerDto: CreateCustomerDto) {
    const data = { ...createCustomerDto };
    if (data.document === "") data.document = null;
    if (data.email === "") data.email = null;
    return this.prisma.customer.create({
      data,
    });
  }

  findAll() {
    return this.prisma.customer.findMany({
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.customer.findUnique({
      where: { id },
    });
  }

  update(id: number, updateCustomerDto: UpdateCustomerDto) {
    const data = { ...updateCustomerDto };
    if (data.document === "") data.document = null;
    if (data.email === "") data.email = null;
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.customer.delete({
      where: { id },
    });
  }
}
