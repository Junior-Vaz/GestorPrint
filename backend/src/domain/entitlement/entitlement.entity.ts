/**
 * TenantEntitlement — NÚCLEO do sistema de planos.
 *
 * Regras de negócio puras. Zero imports de NestJS, Prisma ou qualquer
 * framework. Pode ser testado com Jest sem banco de dados.
 *
 * Responsabilidade: responder "este tenant pode fazer X agora?"
 */
import { FeatureKey } from './feature-key.enum';

export enum BlockReason {
  NONE = 'NONE',
  TENANT_SUSPENDED = 'TENANT_SUSPENDED',
  PLAN_UPGRADE_REQUIRED = 'PLAN_UPGRADE_REQUIRED',
  OVERRIDE_BLOCKED = 'OVERRIDE_BLOCKED',
}

export interface FeatureOverride {
  feature: FeatureKey;
  granted: boolean;   // true = libera, false = bloqueia
  expiresAt?: Date;
}

export interface Quota {
  max: number;        // 99999 = ilimitado
  current: number;
}

export type TenantStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

export interface EntitlementData {
  tenantId: number;
  status: TenantStatus;
  planFeatures: Set<FeatureKey>;
  overrides: FeatureOverride[];
  quotas: {
    users: Quota;
    orders: Quota;
    customers: Quota;
  };
}

export class TenantEntitlement {
  constructor(private readonly data: EntitlementData) {}

  // ── Verificação principal ──────────────────────────────────────────────────

  /**
   * Responde: "este tenant pode usar esta feature agora?"
   *
   * Ordem de precedência:
   *  1. Tenant suspenso/cancelado → NEVER
   *  2. Override explícito (e não expirado) → grant ou block
   *  3. Feature no plano → grant
   *  4. Default → block
   */
  can(feature: FeatureKey): boolean {
    // 1. Tenant inacessível — bloqueia tudo
    if (!this.isAccessible()) return false;

    // 2. Override explícito tem prioridade máxima
    const override = this.findActiveOverride(feature);
    if (override !== null) return override.granted;

    // 3. Verifica o plano
    return this.data.planFeatures.has(feature);
  }

  /**
   * Explica POR QUE o acesso foi bloqueado.
   * Usado para mensagens de erro no frontend e nos logs.
   */
  explainBlock(feature: FeatureKey): BlockReason {
    if (!this.isAccessible()) return BlockReason.TENANT_SUSPENDED;

    const override = this.findActiveOverride(feature);
    if (override !== null && !override.granted) return BlockReason.OVERRIDE_BLOCKED;

    if (!this.data.planFeatures.has(feature)) return BlockReason.PLAN_UPGRADE_REQUIRED;

    return BlockReason.NONE;
  }

  /**
   * Verifica se o tenant ainda está dentro do limite para um recurso.
   */
  withinQuota(resource: 'users' | 'orders' | 'customers'): boolean {
    const quota = this.data.quotas[resource];
    return quota.current < quota.max;
  }

  /**
   * Tenant pode operar? TRIALING e PAST_DUE têm grace period.
   */
  isAccessible(): boolean {
    return (
      this.data.status === 'TRIALING' ||
      this.data.status === 'ACTIVE' ||
      this.data.status === 'PAST_DUE'
    );
  }

  // ── Getters de diagnóstico ─────────────────────────────────────────────────

  get tenantId(): number {
    return this.data.tenantId;
  }

  get status(): TenantStatus {
    return this.data.status;
  }

  get quotas() {
    return this.data.quotas;
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Retorna o override ativo para a feature, ou null se não houver.
   * Overrides expirados são ignorados.
   */
  private findActiveOverride(feature: FeatureKey): FeatureOverride | null {
    const now = new Date();
    const override = this.data.overrides.find((o) => o.feature === feature);
    if (!override) return null;

    // Override com data de expiração passada = ignorado (como se não existisse)
    if (override.expiresAt && override.expiresAt < now) return null;

    return override;
  }
}
