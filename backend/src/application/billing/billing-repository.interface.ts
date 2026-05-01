import { SubscriptionStatus, TenantBillingData } from '../../domain/billing/subscription.entity';

export interface IBillingRepository {
  findTenantById(tenantId: number): Promise<TenantBillingData | null>;
  findTenantByAsaasCustomerId(customerId: string): Promise<TenantBillingData | null>;
  setAsaasCustomerId(tenantId: number, asaasCustomerId: string): Promise<void>;
  setSubscription(
    tenantId: number,
    asaasSubscriptionId: string,
    planStatus: SubscriptionStatus,
    isActive: boolean,
  ): Promise<void>;
  cancelSubscription(tenantId: number, performedBy?: string | null): Promise<void>;
  updatePlanStatus(tenantId: number, planStatus: SubscriptionStatus, isActive: boolean): Promise<void>;

  /** Idempotente — se gatewayEventId já existir, retorna false e não grava nada. */
  recordSubscriptionEvent(args: {
    tenantId:       number;
    eventType:      string;
    fromStatus:     string;
    toStatus:       string;
    gatewayEventId: string | null;
    performedBy:    string | null;
    payload:        any;
  }): Promise<boolean>;

  /** Tenant.planStatus atual (pra montar fromStatus em audit antes de mudar). */
  getCurrentPlanStatus(tenantId: number): Promise<string | null>;
}

export interface IAsaasGateway {
  createCustomer(data: {
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;
    externalReference: string;
  }): Promise<{ id: string }>;

  createSubscription(data: {
    customer: string;
    billingType: string;
    value: number;
    nextDueDate: string;
    cycle: string;
    description: string;
    externalReference: string;
  }): Promise<{ id: string }>;

  deleteSubscription(subscriptionId: string): Promise<void>;

  getSubscription(subscriptionId: string): Promise<any>;

  getPaymentsByCustomer(customerId: string, limit?: number): Promise<any[]>;
}

export const BILLING_REPOSITORY = Symbol('IBillingRepository');
export const ASAAS_GATEWAY = Symbol('IAsaasGateway');
