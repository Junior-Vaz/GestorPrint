import { TenantEntitlement } from '../../domain/entitlement/entitlement.entity';

/**
 * Port — interface que o domínio/aplicação conhece.
 * A infraestrutura (Prisma) implementa este contrato.
 *
 * Inversão de Dependência: o Use Case depende desta interface,
 * não da implementação concreta.
 */
export interface IEntitlementRepository {
  /**
   * Resolve o entitlement atual de um tenant.
   * Combina: plano ativo + overrides + quotas de uso atual.
   */
  findByTenantId(tenantId: number): Promise<TenantEntitlement>;

  /**
   * Invalida o cache do entitlement de um tenant.
   * Deve ser chamado após mudança de plano, override ou suspensão.
   */
  invalidate(tenantId: number): Promise<void>;
}

export const ENTITLEMENT_REPOSITORY = Symbol('IEntitlementRepository');
