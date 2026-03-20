import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_VALUES: Record<string, number> = {
  FREE: 0,
  BASIC: 49,
  PRO: 149,
  ENTERPRISE: 299,
};

@Injectable()
export class BillingService {
  private readonly baseUrl =
    process.env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

  constructor(private readonly prisma: PrismaService) {}

  // ─── HTTP helper ────────────────────────────────────────────────────────────

  private async asaas(method: string, path: string, data?: any) {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) throw new BadRequestException('ASAAS_API_KEY não configurada');

    const res = await axios({
      method,
      url: `${this.baseUrl}${path}`,
      data,
      headers: {
        access_token: apiKey,
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  }

  // ─── Config status ──────────────────────────────────────────────────────────

  getConfig() {
    return {
      configured: !!process.env.ASAAS_API_KEY,
      env: process.env.ASAAS_ENV || 'sandbox',
      webhookUrl: `${process.env.API_URL || 'https://api.gestorprint.com.br'}/api/billing/webhooks`,
    };
  }

  // ─── Customer ───────────────────────────────────────────────────────────────

  async createCustomer(tenantId: number): Promise<{ asaasCustomerId: string }> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (tenant.asaasCustomerId) {
      return { asaasCustomerId: tenant.asaasCustomerId };
    }

    const result = await this.asaas('POST', '/customers', {
      name: tenant.ownerName || tenant.name,
      email: tenant.ownerEmail || undefined,
      mobilePhone: tenant.ownerPhone || undefined,
      externalReference: String(tenantId),
    });

    await (this.prisma as any).tenant.update({
      where: { id: tenantId },
      data: { asaasCustomerId: result.id },
    });

    return { asaasCustomerId: result.id };
  }

  // ─── Subscription ───────────────────────────────────────────────────────────

  async createSubscription(tenantId: number, billingType: string): Promise<{ asaasSubscriptionId: string }> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasCustomerId) {
      throw new BadRequestException('Crie o cliente no Asaas antes de gerar a assinatura');
    }

    const value = PLAN_VALUES[tenant.plan];
    if (!value) throw new BadRequestException(`Plano ${tenant.plan} não tem cobrança (FREE)`);

    // nextDueDate = amanhã (primeiro vencimento)
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().split('T')[0];

    // Se já tem assinatura, cancela antes de criar nova
    if (tenant.asaasSubscriptionId) {
      await this.asaas('DELETE', `/subscriptions/${tenant.asaasSubscriptionId}`).catch(() => null);
    }

    const result = await this.asaas('POST', '/subscriptions', {
      customer: tenant.asaasCustomerId,
      billingType,
      value,
      nextDueDate: dueDateStr,
      cycle: 'MONTHLY',
      description: `GestorPrint — Plano ${tenant.plan}`,
      externalReference: String(tenantId),
    });

    await (this.prisma as any).tenant.update({
      where: { id: tenantId },
      data: { asaasSubscriptionId: result.id },
    });

    return { asaasSubscriptionId: result.id };
  }

  async cancelSubscription(tenantId: number): Promise<void> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasSubscriptionId) throw new BadRequestException('Tenant não tem assinatura ativa');

    await this.asaas('DELETE', `/subscriptions/${tenant.asaasSubscriptionId}`);

    await (this.prisma as any).tenant.update({
      where: { id: tenantId },
      data: { asaasSubscriptionId: null, planStatus: 'CANCELLED', isActive: false },
    });
  }

  // ─── Invoices ───────────────────────────────────────────────────────────────

  async getInvoices(tenantId: number): Promise<any[]> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasCustomerId) return [];

    const result = await this.asaas('GET', `/payments?customer=${tenant.asaasCustomerId}&limit=20`);
    return result.data || [];
  }

  // ─── Webhook ────────────────────────────────────────────────────────────────

  async handleWebhook(payload: any): Promise<void> {
    const event: string = payload?.event;
    const customerId: string = payload?.payment?.customer;

    if (!customerId) return;

    const tenant = await (this.prisma as any).tenant.findFirst({
      where: { asaasCustomerId: customerId },
    });
    if (!tenant) return;

    const statusMap: Record<string, { planStatus: string; isActive: boolean }> = {
      PAYMENT_CONFIRMED:   { planStatus: 'ACTIVE',     isActive: true  },
      PAYMENT_RECEIVED:    { planStatus: 'ACTIVE',     isActive: true  },
      PAYMENT_OVERDUE:     { planStatus: 'SUSPENDED',  isActive: false },
      PAYMENT_DELETED:     { planStatus: 'CANCELLED',  isActive: false },
      SUBSCRIPTION_INACTIVATED: { planStatus: 'CANCELLED', isActive: false },
    };

    const update = statusMap[event];
    if (update) {
      await (this.prisma as any).tenant.update({
        where: { id: tenant.id },
        data: update,
      });
    }
  }
}
