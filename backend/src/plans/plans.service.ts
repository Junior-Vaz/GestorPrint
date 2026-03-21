import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return (this.prisma as any).planConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: number) {
    const plan = await (this.prisma as any).planConfig.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async create(dto: CreatePlanDto) {
    const exists = await (this.prisma as any).planConfig.findUnique({ where: { name: dto.name } });
    if (exists) throw new BadRequestException(`Plano com nome "${dto.name}" já existe`);
    return (this.prisma as any).planConfig.create({ data: dto });
  }

  async update(id: number, dto: UpdatePlanDto) {
    await this.findOne(id);
    return (this.prisma as any).planConfig.update({ where: { id }, data: dto });
  }

  async deactivate(id: number) {
    const plan = await this.findOne(id);
    const tenantsCount = await (this.prisma as any).tenant.count({
      where: { plan: plan.name, isActive: true },
    });
    if (tenantsCount > 0) {
      // Has active tenants — just mark as inactive (don't delete)
      return (this.prisma as any).planConfig.update({
        where: { id },
        data: { isActive: false },
      });
    }
    // No active tenants — can safely delete
    return (this.prisma as any).planConfig.delete({ where: { id } });
  }

  // ── Feature enforcement helper ─────────────────────────────────────────────
  // Called by other services to check if a tenant's plan includes a feature.
  async requireFeature(tenantId: number, feature: string): Promise<void> {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, isActive: true, planStatus: true },
    });
    if (!tenant?.isActive || ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
      throw new ForbiddenException('Conta suspensa ou cancelada. Entre em contato com o suporte.');
    }
    const plan = await (this.prisma as any).planConfig.findUnique({
      where: { name: tenant.plan },
    });
    if (!plan || !plan[feature]) {
      const planName = plan?.displayName || tenant.plan;
      throw new ForbiddenException(
        `Este recurso não está disponível no plano ${planName}. Faça upgrade do seu plano.`,
      );
    }
  }

  // ── Get plan features for a tenant ────────────────────────────────────────
  async getPlanFeatures(tenantId: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    const plan = await (this.prisma as any).planConfig.findUnique({
      where: { name: tenant.plan },
    });
    return plan ?? null;
  }
}
