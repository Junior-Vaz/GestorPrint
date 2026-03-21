import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// "2026-03-20" → "2026-03-20T00:00:00.000Z" (Prisma DateTime exige ISO completo)
function toDateTime(s?: string | null): string | null | undefined {
  if (!s) return s === null ? null : undefined;
  return s.length === 10 ? `${s}T00:00:00.000Z` : s;
}

const DEFAULT_PLANS = [
  {
    name: 'FREE', displayName: 'Gratuito', price: 0, sortOrder: 0,
    maxUsers: 1, maxOrders: 30, maxCustomers: 50,
    hasPdf: false, hasReports: false, hasKanban: false, hasFileUpload: false,
    hasWhatsapp: false, hasPix: false, hasAudit: false, hasCommissions: false, hasApiAccess: false,
  },
  {
    name: 'BASIC', displayName: 'Básico', price: 79, sortOrder: 1,
    maxUsers: 3, maxOrders: 300, maxCustomers: 500,
    hasPdf: true, hasReports: true, hasKanban: true, hasFileUpload: true,
    hasWhatsapp: false, hasPix: false, hasAudit: false, hasCommissions: false, hasApiAccess: false,
  },
  {
    name: 'PRO', displayName: 'Pro', price: 179, sortOrder: 2,
    maxUsers: 15, maxOrders: 2000, maxCustomers: 99999,
    hasPdf: true, hasReports: true, hasKanban: true, hasFileUpload: true,
    hasWhatsapp: true, hasPix: true, hasAudit: true, hasCommissions: true, hasApiAccess: false,
  },
  {
    name: 'ENTERPRISE', displayName: 'Enterprise', price: 349, sortOrder: 3,
    maxUsers: 99999, maxOrders: 99999, maxCustomers: 99999,
    hasPdf: true, hasReports: true, hasKanban: true, hasFileUpload: true,
    hasWhatsapp: true, hasPix: true, hasAudit: true, hasCommissions: true, hasApiAccess: true,
  },
];

@Injectable()
export class TenantsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Seed default plans (idempotent — update: {} means never overwrite admin edits)
    for (const plan of DEFAULT_PLANS) {
      await (this.prisma as any).planConfig.upsert({
        where: { name: plan.name },
        update: {},
        create: plan,
      });
    }
  }

  async findAll() {
    return (this.prisma as any).tenant.findMany({
      include: {
        _count: {
          select: { users: true, orders: true, customers: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, orders: true, customers: true, products: true }
        }
      }
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  async create(data: {
    name: string; slug: string; plan?: string; planStatus?: string;
    trialEndsAt?: string | null; planExpiresAt?: string | null;
    maxUsers?: number; maxOrders?: number; maxCustomers?: number;
    ownerName?: string; ownerEmail?: string; ownerPhone?: string;
    cpfCnpj?: string; isActive?: boolean;
  }) {
    // Auto-fill limits from PlanConfig when plan is set
    if (data.plan && data.maxUsers === undefined) {
      const planCfg = await (this.prisma as any).planConfig.findUnique({ where: { name: data.plan } });
      if (planCfg) {
        data.maxUsers = planCfg.maxUsers;
        data.maxOrders = planCfg.maxOrders;
        data.maxCustomers = planCfg.maxCustomers;
      }
    }

    return (this.prisma as any).tenant.create({
      data: {
        ...data,
        trialEndsAt:   toDateTime(data.trialEndsAt),
        planExpiresAt: toDateTime(data.planExpiresAt),
      },
    });
  }

  async update(id: number, data: {
    name?: string; slug?: string; plan?: string; planStatus?: string;
    planExpiresAt?: string | null; trialEndsAt?: string | null;
    maxUsers?: number; maxOrders?: number; maxCustomers?: number;
    ownerName?: string; ownerEmail?: string; ownerPhone?: string;
    cpfCnpj?: string; isActive?: boolean;
  }) {
    // Auto-fill limits from PlanConfig when plan changes (only if limits not explicitly provided)
    if (data.plan && data.maxUsers === undefined) {
      const planCfg = await (this.prisma as any).planConfig.findUnique({ where: { name: data.plan } });
      if (planCfg) {
        data.maxUsers = planCfg.maxUsers;
        data.maxOrders = planCfg.maxOrders;
        data.maxCustomers = planCfg.maxCustomers;
      }
    }

    return (this.prisma as any).tenant.update({
      where: { id },
      data: {
        ...data,
        trialEndsAt:   toDateTime(data.trialEndsAt),
        planExpiresAt: toDateTime(data.planExpiresAt),
      },
    });
  }

  async getDashboard() {
    // MRR via DB — uses prices from PlanConfig instead of hardcoded values
    const [planConfigs, byPlan, byStatus, totalUsers, totalOrders, totalCustomers, totalTenants, recentTenants] =
      await Promise.all([
        (this.prisma as any).planConfig.findMany({ select: { name: true, price: true } }),
        (this.prisma as any).tenant.groupBy({ by: ['plan'], _count: { _all: true } }),
        (this.prisma as any).tenant.groupBy({ by: ['planStatus'], _count: { _all: true } }),
        (this.prisma as any).user.count(),
        (this.prisma as any).order.count(),
        (this.prisma as any).customer.count(),
        (this.prisma as any).tenant.count(),
        (this.prisma as any).tenant.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, slug: true, plan: true, planStatus: true, createdAt: true },
        }),
      ]);

    const MRR_BY_PLAN: Record<string, number> = Object.fromEntries(
      planConfigs.map((p: any) => [p.name, p.price])
    );
    const mrr = byPlan.reduce(
      (sum: number, r: any) => sum + (MRR_BY_PLAN[r.plan] ?? 0) * r._count._all, 0
    );

    return { totalTenants, totalUsers, totalOrders, totalCustomers, mrr, byPlan, byStatus, recentTenants };
  }

  async suspend(id: number) {
    return (this.prisma as any).tenant.update({
      where: { id },
      data: { planStatus: 'SUSPENDED', isActive: false }
    });
  }

  async activate(id: number) {
    return (this.prisma as any).tenant.update({
      where: { id },
      data: { planStatus: 'ACTIVE', isActive: true }
    });
  }
}
