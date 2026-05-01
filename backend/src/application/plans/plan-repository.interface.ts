export interface PlanConfig {
  id: number;
  name: string;
  displayName: string;
  description?: string | null;
  price: number;
  maxUsers: number;
  maxOrders: number;
  maxCustomers: number;
  isActive: boolean;
  sortOrder: number;
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
  // Programa de Fidelidade
  hasLoyalty: boolean;
}

export interface TenantPlanInfo {
  plan: string;
  planStatus: string;
  isActive: boolean;
  maxUsers: number;
  maxOrders: number;
  maxCustomers: number;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
}

export interface UsageCounts {
  users: number;
  orders: number;
  customers: number;
}

export interface IPlanRepository {
  findAll(): Promise<PlanConfig[]>;
  findById(id: number): Promise<PlanConfig | null>;
  findByName(name: string): Promise<PlanConfig | null>;
  create(data: Omit<PlanConfig, 'id'>): Promise<PlanConfig>;
  update(id: number, data: Partial<Omit<PlanConfig, 'id' | 'name'>>): Promise<PlanConfig>;
  deactivate(id: number): Promise<PlanConfig | null>;
  countActiveTenantsOnPlan(planName: string): Promise<number>;
  getTenantPlanInfo(tenantId: number): Promise<TenantPlanInfo | null>;
  getUsageCounts(tenantId: number): Promise<UsageCounts>;
}

export const PLAN_REPOSITORY = Symbol('IPlanRepository');
