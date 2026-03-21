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

  // ── Get plan features + usage for the current tenant (frontend use) ───────
  async getMyPlan(tenantId: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true, planStatus: true, isActive: true,
        maxUsers: true, maxOrders: true, maxCustomers: true,
        trialEndsAt: true, planExpiresAt: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const planConfig = await (this.prisma as any).planConfig.findUnique({
      where: { name: tenant.plan },
    });

    // Current usage
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [usersCount, ordersThisMonth, customersCount] = await Promise.all([
      (this.prisma as any).user.count({ where: { tenantId } }),
      (this.prisma as any).order.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      (this.prisma as any).customer.count({ where: { tenantId } }),
    ]);

    return {
      plan: tenant.plan,
      planStatus: tenant.planStatus,
      isActive: tenant.isActive,
      trialEndsAt: tenant.trialEndsAt,
      planExpiresAt: tenant.planExpiresAt,
      // Limits from tenant (may differ from planConfig if manually adjusted)
      maxUsers: tenant.maxUsers,
      maxOrders: tenant.maxOrders,
      maxCustomers: tenant.maxCustomers,
      // Current usage
      usersCount,
      ordersThisMonth,
      customersCount,
      // Feature flags from planConfig
      ...(planConfig ? {
        displayName: planConfig.displayName,
        price: planConfig.price,
        hasPdf: planConfig.hasPdf,
        hasReports: planConfig.hasReports,
        hasKanban: planConfig.hasKanban,
        hasFileUpload: planConfig.hasFileUpload,
        hasWhatsapp: planConfig.hasWhatsapp,
        hasPix: planConfig.hasPix,
        hasAudit: planConfig.hasAudit,
        hasCommissions: planConfig.hasCommissions,
        hasApiAccess: planConfig.hasApiAccess,
      } : {
        // Fallback: all features enabled if planConfig not found (safety net)
        displayName: tenant.plan,
        price: 0,
        hasPdf: true, hasReports: true, hasKanban: true, hasFileUpload: true,
        hasWhatsapp: true, hasPix: true, hasAudit: true, hasCommissions: true, hasApiAccess: true,
      }),
    };
  }
}
