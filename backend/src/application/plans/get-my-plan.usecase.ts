import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureKey } from '../../domain/entitlement/feature-key.enum';
import { CheckFeatureUseCase } from '../entitlement/check-feature.usecase';
import { IPlanRepository, PLAN_REPOSITORY } from './plan-repository.interface';

export interface MyPlanResult {
  plan: string;
  planStatus: string;
  isActive: boolean;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
  displayName: string;
  price: number;
  maxUsers: number;
  maxOrders: number;
  maxCustomers: number;
  usersCount: number;
  ordersThisMonth: number;
  customersCount: number;
  hasPdf: boolean;
  hasReports: boolean;
  hasKanban: boolean;
  hasFileUpload: boolean;
  hasWhatsapp: boolean;
  hasPix: boolean;
  hasAudit: boolean;
  hasCommissions: boolean;
  hasApiAccess: boolean;
  hasPlotterEstimate: boolean;
  hasCuttingEstimate: boolean;
  hasEmbroideryEstimate: boolean;
  hasReceivables: boolean;
  // Ecommerce / loja online
  hasEcommerce: boolean;
  hasMpCard: boolean;
  hasMelhorEnvios: boolean;
  // Programa de Fidelidade — pontos, cashback, tiers, aniversário, referral
  hasLoyalty: boolean;
}

@Injectable()
export class GetMyPlanUseCase {
  constructor(
    private readonly checkFeature: CheckFeatureUseCase,
    @Inject(PLAN_REPOSITORY)
    private readonly planRepo: IPlanRepository,
  ) {}

  async execute(tenantId: number): Promise<MyPlanResult> {
    const tenantPlanInfo = await this.planRepo.getTenantPlanInfo(tenantId);
    if (!tenantPlanInfo) throw new NotFoundException('Tenant não encontrado');

    const planConfig = await this.planRepo.findByName(tenantPlanInfo.plan);

    // Resolve all feature flags in parallel via CheckFeatureUseCase
    const features = await Promise.all(
      Object.values(FeatureKey).map((f) => this.checkFeature.check(tenantId, f).then((v) => [f, v] as const)),
    );
    const can = Object.fromEntries(features) as Record<FeatureKey, boolean>;

    // Usage counts come from the plan repository (already computed by PrismaEntitlementRepository)
    const usageCounts = await this.planRepo.getUsageCounts(tenantId);

    return {
      plan: tenantPlanInfo.plan,
      planStatus: tenantPlanInfo.planStatus,
      isActive: tenantPlanInfo.isActive,
      trialEndsAt: tenantPlanInfo.trialEndsAt,
      planExpiresAt: tenantPlanInfo.planExpiresAt,
      displayName: planConfig?.displayName ?? tenantPlanInfo.plan,
      price: planConfig?.price ?? 0,
      maxUsers: tenantPlanInfo.maxUsers,
      maxOrders: tenantPlanInfo.maxOrders,
      maxCustomers: tenantPlanInfo.maxCustomers,
      usersCount: usageCounts.users,
      ordersThisMonth: usageCounts.orders,
      customersCount: usageCounts.customers,
      hasPdf: can[FeatureKey.PDF_GENERATION],
      hasReports: can[FeatureKey.FINANCIAL_REPORTS],
      hasKanban: can[FeatureKey.KANBAN_BOARD],
      hasFileUpload: can[FeatureKey.FILE_UPLOAD],
      hasWhatsapp: can[FeatureKey.WHATSAPP_AI],
      hasPix: can[FeatureKey.PIX_PAYMENTS],
      hasAudit: can[FeatureKey.AUDIT_LOG],
      hasCommissions: can[FeatureKey.COMMISSIONS],
      hasApiAccess: can[FeatureKey.API_ACCESS],
      hasPlotterEstimate: can[FeatureKey.PLOTTER_ESTIMATE],
      hasCuttingEstimate: can[FeatureKey.CUTTING_ESTIMATE],
      hasEmbroideryEstimate: can[FeatureKey.EMBROIDERY_ESTIMATE],
      hasReceivables: can[FeatureKey.RECEIVABLES],
      hasEcommerce: can[FeatureKey.ECOMMERCE],
      hasMpCard: can[FeatureKey.MP_CARD],
      hasMelhorEnvios: can[FeatureKey.MELHOR_ENVIOS],
      hasLoyalty: can[FeatureKey.LOYALTY_PROGRAM],
    };
  }
}
