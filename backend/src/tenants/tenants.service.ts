import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

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
    name: string;
    slug: string;
    plan?: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
  }) {
    return (this.prisma as any).tenant.create({ data });
  }

  async update(id: number, data: {
    name?: string;
    plan?: string;
    planStatus?: string;
    planExpiresAt?: string | null;
    trialEndsAt?: string | null;
    maxUsers?: number;
    maxOrders?: number;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    isActive?: boolean;
  }) {
    return (this.prisma as any).tenant.update({ where: { id }, data });
  }

  async getDashboard() {
    const MRR_BY_PLAN: Record<string, number> = { FREE: 0, BASIC: 49, PRO: 149, ENTERPRISE: 299 };

    const [byPlan, byStatus, totalUsers, totalOrders, totalCustomers, totalTenants, recentTenants] =
      await Promise.all([
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

    const mrr = byPlan.reduce((sum: number, r: any) => sum + (MRR_BY_PLAN[r.plan] ?? 0) * r._count._all, 0);

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
