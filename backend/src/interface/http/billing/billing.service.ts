import { Injectable } from '@nestjs/common';
import { ManageSubscriptionUseCase } from '../../../application/billing/manage-subscription.usecase';

@Injectable()
export class BillingService {
  constructor(private readonly manageSubscription: ManageSubscriptionUseCase) {}

  getConfig() { return this.manageSubscription.getConfig(); }
  getPlatformSettings() { return this.manageSubscription.getPlatformSettings(); }
  createCustomer(tenantId: number) { return this.manageSubscription.createCustomer(tenantId); }
  createSubscription(tenantId: number, billingType: string) { return this.manageSubscription.createSubscription(tenantId, billingType); }
  cancelSubscription(tenantId: number, performedBy?: string | null) {
    return this.manageSubscription.cancelSubscription(tenantId, performedBy);
  }
  getInvoices(tenantId: number) { return this.manageSubscription.getInvoices(tenantId); }
  handleWebhook(payload: any) { return this.manageSubscription.handleWebhook(payload); }
  getSubscription(tenantId: number) { return this.manageSubscription.getSubscription(tenantId); }
}
