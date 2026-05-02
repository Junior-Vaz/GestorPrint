import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto, PaginatedResult, paginateResult } from '../../../shared/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
    this.normalize(data);
    const created = await this.prisma.customer.create({ data });
    await this.audit.logAction(
      null,
      'CREATE',
      'Customer',
      created.id,
      { name: created.name, email: created.email, phone: created.phone },
      tenantId,
    );
    return created;
  }

  /**
   * Normaliza campos antes de gravar:
   *  - email/document/notes vazios → null (evita unique constraint em string vazia)
   *  - phone e document SEM máscara (só dígitos) — Evolution e validações ficam consistentes
   *  - birthDate string → Date completo (Prisma exige DateTime)
   */
  private normalize(data: any) {
    if (data.document === '') data.document = null;
    if (data.email === '')    data.email = null;
    if (data.notes === '')    data.notes = null;
    if (data.complement === '') data.complement = null;
    if (data.photoUrl === '')  data.photoUrl = null;
    if (typeof data.phone === 'string')    data.phone    = data.phone.replace(/\D+/g, '') || null;
    if (typeof data.document === 'string') data.document = data.document.replace(/\D+/g, '') || null;
    if (typeof data.zipCode === 'string')  data.zipCode  = data.zipCode.replace(/\D+/g, '') || null;
    if (typeof data.state === 'string')    data.state    = data.state.toUpperCase().slice(0, 2);
    if (data.birthDate) {
      const s = String(data.birthDate);
      data.birthDate = s.length === 10 ? new Date(`${s}T00:00:00.000Z`) : new Date(s);
    } else if (data.birthDate === '' || data.birthDate === null) {
      data.birthDate = null;
    }
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
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { document: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await (this.prisma as any).$transaction([
      this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
      this.prisma.customer.count({ where }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  findAllInternal(tenantId: number) {
    return this.prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  findOne(id: number, tenantId: number) {
    return this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto, tenantId: number) {
    const data: any = { ...updateCustomerDto };
    this.normalize(data);
    // updateMany ancora tenantId — antes operador podia editar customer de
    // outro tenant via PATCH /customers/:id forjando o id na URL.
    const result = await this.prisma.customer.updateMany({
      where: { id, tenantId },
      data,
    });
    if (result.count === 0) throw new NotFoundException('Cliente não encontrado');
    await this.audit.logAction(
      null,
      'UPDATE',
      'Customer',
      id,
      { changedFields: Object.keys(data) },
      tenantId,
    );
    return this.prisma.customer.findUnique({ where: { id } });
  }

  async remove(id: number, tenantId: number) {
    const result = await this.prisma.customer.deleteMany({
      where: { id, tenantId },
    });
    await this.audit.logAction(null, 'DELETE', 'Customer', id, {}, tenantId);
    return result;
  }
}
