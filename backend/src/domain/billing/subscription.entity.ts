export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'TRIALING';

export interface TenantBillingData {
  id: number;
  name: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  cpfCnpj?: string | null;
  plan: string;
  planPrice: number;
  asaasCustomerId?: string | null;
  asaasSubscriptionId?: string | null;
  slug?: string | null;
}

/**
 * Maps Asaas webhook events to internal subscription status changes.
 * Pure domain logic — no framework dependencies.
 */
export const ASAAS_EVENT_TO_STATUS: Record<string, { planStatus: SubscriptionStatus; isActive: boolean } | null> = {
  PAYMENT_CONFIRMED:            { planStatus: 'ACTIVE',     isActive: true  },
  PAYMENT_RECEIVED:             { planStatus: 'ACTIVE',     isActive: true  },
  PAYMENT_OVERDUE:              { planStatus: 'SUSPENDED',  isActive: false },
  PAYMENT_DELETED:              { planStatus: 'CANCELLED',  isActive: false },
  PAYMENT_REFUNDED:             { planStatus: 'SUSPENDED',  isActive: false },
  PAYMENT_CHARGEBACK_REQUESTED: { planStatus: 'SUSPENDED',  isActive: false },
  SUBSCRIPTION_INACTIVATED:     { planStatus: 'CANCELLED',  isActive: false },
  // Informational events — no state change
  PAYMENT_CREATED:              null,
  PAYMENT_UPDATED:              null,
  PAYMENT_DUEDATE_WARNING:      null,
  PAYMENT_ANTICIPATED:          null,
};

export function resolveWebhookEvent(
  event: string,
): { planStatus: SubscriptionStatus; isActive: boolean } | null {
  if (!(event in ASAAS_EVENT_TO_STATUS)) return null;
  return ASAAS_EVENT_TO_STATUS[event];
}
