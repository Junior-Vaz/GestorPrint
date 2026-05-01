import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { IEntitlementRepository } from '../../application/entitlement/entitlement-repository.interface';
import {
  TenantEntitlement,
  EntitlementData,
  TenantStatus,
  FeatureOverride,
} from '../../domain/entitlement/entitlement.entity';
import { FeatureKey, FEATURE_TO_PLAN_FIELD } from '../../domain/entitlement/feature-key.enum';

/**
 * PrismaEntitlementRepository — implementa IEntitlementRepository usando Prisma.
 *
 * Resolve o entitlement de um tenant combinando:
 *  1. planStatus do Tenant → TenantStatus
 *  2. PlanConfig → quais FeatureKeys estão habilitadas
 *  3. TenantFeatureOverride → overrides individuais (liberar ou bloquear)
 *  4. TenantEntitlement → limites de quota customizados
 *  5. Contagens atuais → uso de quota
 *
 * Compatibilidade: lê tanto o novo modelo (TenantEntitlement/overrides) quanto
 * o antigo (PlanConfig booleans) — migração gradual sem quebrar nada.
 */
@Injectable()
export class PrismaEntitlementRepository implements IEntitlementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(tenantId: number): Promise<TenantEntitlement> {
    // Busca tenant + plano + entitlement + overrides em paralelo
    const [tenant, entitlementRecord, usageCounts] = await Promise.all([
      (this.prisma as any).tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          plan: true,
          planStatus: true,
          isActive: true,
          maxUsers: true,
          maxOrders: true,
          maxCustomers: true,
        },
      }),
      (this.prisma as any).tenantEntitlement
        ?.findUnique({
          where: { tenantId },
          include: { overrides: true },
        })
        .catch(() => null), // tabela pode não existir antes da migration
      this.fetchUsageCounts(tenantId),
    ]);

    if (!tenant) {
      // Fail-closed: se tenant não encontrado, sem acesso
      return this.buildEmpty(tenantId);
    }

    // Resolve status da assinatura
    const status = this.resolveStatus(tenant);

    // Resolve features do plano
    const planFeatures = await this.resolvePlanFeatures(tenant.plan);

    // Resolve overrides individuais
    const overrides = this.resolveOverrides(entitlementRecord?.overrides ?? []);

    // Resolve limites (usa override do entitlement se existir, senão usa o tenant)
    const limits = entitlementRecord ?? tenant;

    const data: EntitlementData = {
      tenantId,
      status,
      planFeatures,
      overrides,
      quotas: {
        users: { max: limits.maxUsers, current: usageCounts.users },
        orders: { max: limits.maxOrders, current: usageCounts.orders },
        customers: { max: limits.maxCustomers, current: usageCounts.customers },
      },
    };

    return new TenantEntitlement(data);
  }

  /**
   * invalidate: sem Redis por enquanto — no-op.
   * Quando Redis for adicionado, limpa o cache aqui.
   */
  async invalidate(_tenantId: number): Promise<void> {
    // TODO Fase Cache: await this.redis.del(`entitlement:${_tenantId}`)
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private resolveStatus(tenant: {
    isActive: boolean;
    planStatus: string;
  }): TenantStatus {
    if (!tenant.isActive) return 'SUSPENDED';

    const map: Record<string, TenantStatus> = {
      TRIAL: 'TRIALING',
      ACTIVE: 'ACTIVE',
      SUSPENDED: 'SUSPENDED',
      CANCELLED: 'CANCELLED',
    };
    return map[tenant.planStatus] ?? 'SUSPENDED';
  }

  private async resolvePlanFeatures(planName: string): Promise<Set<FeatureKey>> {
    const planConfig = await (this.prisma as any).planConfig.findUnique({
      where: { name: planName },
    });

    if (!planConfig) return new Set<FeatureKey>();

    const features = new Set<FeatureKey>();
    for (const [featureKey, planField] of Object.entries(FEATURE_TO_PLAN_FIELD)) {
      if (planConfig[planField] === true) {
        features.add(featureKey as FeatureKey);
      }
    }
    return features;
  }

  private resolveOverrides(rawOverrides: any[]): FeatureOverride[] {
    return rawOverrides.map((o) => ({
      feature: o.feature as FeatureKey,
      granted: o.granted,
      expiresAt: o.expiresAt ?? undefined,
    }));
  }

  private async fetchUsageCounts(tenantId: number) {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const [users, orders, customers] = await Promise.all([
      // Conta só usuários TENANT na quota (PLATFORM users são internos da plataforma)
      (this.prisma as any).user.count({ where: { tenantId, userType: 'TENANT' } }),
      (this.prisma as any).order.count({
        where: { tenantId, createdAt: { gte: startOfMonth } },
      }),
      (this.prisma as any).customer.count({ where: { tenantId } }),
    ]);

    return { users, orders, customers };
  }

  private buildEmpty(tenantId: number): TenantEntitlement {
    return new TenantEntitlement({
      tenantId,
      status: 'SUSPENDED',
      planFeatures: new Set<FeatureKey>(),
      overrides: [],
      quotas: {
        users: { max: 0, current: 0 },
        orders: { max: 0, current: 0 },
        customers: { max: 0, current: 0 },
      },
    });
  }
}
