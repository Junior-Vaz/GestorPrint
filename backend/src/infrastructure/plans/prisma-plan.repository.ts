import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';
import {
  IPlanRepository, PlanConfig, TenantPlanInfo, UsageCounts,
} from '../../application/plans/plan-repository.interface';

@Injectable()
export class PrismaPlanRepository implements IPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<PlanConfig[]> {
    return (this.prisma as any).planConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  findById(id: number): Promise<PlanConfig | null> {
    return (this.prisma as any).planConfig.findUnique({ where: { id } });
  }

  findByName(name: string): Promise<PlanConfig | null> {
    return (this.prisma as any).planConfig.findUnique({ where: { name } });
  }

  create(data: Omit<PlanConfig, 'id'>): Promise<PlanConfig> {
    return (this.prisma as any).planConfig.create({ data });
  }

  update(id: number, data: Partial<Omit<PlanConfig, 'id' | 'name'>>): Promise<PlanConfig> {
    return (this.prisma as any).planConfig.update({ where: { id }, data });
  }

  async deactivate(id: number): Promise<PlanConfig | null> {
    return (this.prisma as any).planConfig.delete({ where: { id } });
  }

  countActiveTenantsOnPlan(planName: string): Promise<number> {
    return (this.prisma as any).tenant.count({
      where: { plan: planName, isActive: true },
    });
  }

  getTenantPlanInfo(tenantId: number): Promise<TenantPlanInfo | null> {
    return (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        planStatus: true,
        isActive: true,
        maxUsers: true,
        maxOrders: true,
        maxCustomers: true,
        trialEndsAt: true,
        planExpiresAt: true,
      },
    });
  }

  async getUsageCounts(tenantId: number): Promise<UsageCounts> {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [users, orders, customers] = await Promise.all([
      // Conta só usuários TENANT (operadores de gráfica). PLATFORM users
      // são internos da plataforma SaaS — não fazem parte da equipe operacional.
      (this.prisma as any).user.count({ where: { tenantId, userType: 'TENANT' } }),
      (this.prisma as any).order.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      (this.prisma as any).customer.count({ where: { tenantId } }),
    ]);
    return { users, orders, customers };
  }
}
