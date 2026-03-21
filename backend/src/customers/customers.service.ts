import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto, tenantId: number) {
    // ── Enforce plan limits ────────────────────────────────────────────────
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { maxCustomers: true, isActive: true, planStatus: true },
    });
    if (!tenant?.isActive || ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
      throw new ForbiddenException('Conta suspensa ou cancelada. Entre em contato com o suporte.');
    }
    const customerCount = await (this.prisma as any).customer.count({ where: { tenantId } });
    if (customerCount >= (tenant?.maxCustomers ?? 50)) {
      throw new ForbiddenException(
        `Limite de ${tenant.maxCustomers} cliente(s) atingido. Faça upgrade do seu plano.`,
      );
    }
    // ──────────────────────────────────────────────────────────────────────
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
