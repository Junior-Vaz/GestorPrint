import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  private readonly baseUrl =
    process.env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

  constructor(private readonly prisma: PrismaService) {}

  // ─── HTTP helper ────────────────────────────────────────────────────────────

  private async asaas(method: string, path: string, data?: any) {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) throw new BadRequestException('ASAAS_API_KEY não configurada');

    try {
      const res = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        data,
        headers: {
          access_token: apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
      return res.data;
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const apiErrors = axiosErr.response?.data?.errors;
      if (apiErrors?.length) {
        const messages = apiErrors.map((e: any) => e.description || e.code).join(', ');
        this.logger.error(`Asaas API error [${method} ${path}]: ${messages}`);
        throw new BadRequestException(`Asaas: ${messages}`);
      }
      const fallback = axiosErr.response?.data?.message || axiosErr.message || 'Erro na API Asaas';
      this.logger.error(`Asaas request failed [${method} ${path}]: ${fallback}`);
      throw new BadRequestException(fallback);
    }
  }

  // ─── Config status ──────────────────────────────────────────────────────────

  getConfig() {
    return {
      configured: !!process.env.ASAAS_API_KEY,
      env: process.env.ASAAS_ENV || 'sandbox',
      webhookUrl: `${process.env.API_URL || 'https://api.gestorprint.com.br'}/api/billing/webhooks`,
    };
  }

  getPlatformSettings() {
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN || '';
    const smtpHost = process.env.SMTP_HOST || '';
    return {
      asaasConfigured: !!process.env.ASAAS_API_KEY,
      asaasEnv: process.env.ASAAS_ENV || 'sandbox',
      webhookUrl: `${process.env.API_URL || 'https://api.gestorprint.com.br'}/api/billing/webhooks`,
      webhookTokenConfigured: !!webhookToken,
      webhookTokenMask: webhookToken ? `${webhookToken.slice(0, 8)}${'*'.repeat(8)}` : '',
      smtpConfigured: !!smtpHost,
      smtpHost: smtpHost || '',
    };
  }

  // ─── Customer ───────────────────────────────────────────────────────────────

  async createCustomer(tenantId: number): Promise<{ asaasCustomerId: string }> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (tenant.asaasCustomerId) {
      return { asaasCustomerId: tenant.asaasCustomerId };
    }

    if (!tenant.cpfCnpj) {
      throw new BadRequestException(
        'Cadastre o CPF/CNPJ do responsável no tenant antes de criar o cliente no Asaas',
      );
    }

    const result = await this.asaas('POST', '/customers', {
      name: tenant.ownerName || tenant.name,
      cpfCnpj: tenant.cpfCnpj,
      email: tenant.ownerEmail || undefined,
      mobilePhone: tenant.ownerPhone || undefined,
      externalReference: String(tenantId),
      notificationDisabled: false,
    });

    await (this.prisma as any).tenant.update({
      where: { id: tenantId },
      data: { asaasCustomerId: result.id },
    });

    this.logger.log(`Asaas customer created for tenant ${tenantId}: ${result.id}`);
    return { asaasCustomerId: result.id };
  }

  // ─── Subscription ───────────────────────────────────────────────────────────

  async createSubscription(tenantId: number, billingType: string): Promise<{ asaasSubscriptionId: string }> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasCustomerId) {
      throw new BadRequestException('Crie o cliente no Asaas antes de gerar a assinatura');
    }

    const planConfig = await (this.prisma as any).planConfig.findUnique({ where: { name: tenant.plan } });
    const value = planConfig?.price ?? 0;
    if (!value) throw new BadRequestException(`Plano ${tenant.plan} é gratuito e não possui cobrança`);

    // nextDueDate = amanhã (primeiro vencimento)
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().split('T')[0];

    // Se já tem assinatura, cancela antes de criar nova
    if (tenant.asaasSubscriptionId) {
      try {
        await this.asaas('DELETE', `/subscriptions/${tenant.asaasSubscriptionId}`);
      } catch (err) {
        this.logger.warn(`Could not delete old subscription ${tenant.asaasSubscriptionId}: ${err}`);
      }
    }

    const result = await this.asaas('POST', '/subscriptions', {
      customer: tenant.asaasCustomerId,
      billingType,
      value,
      nextDueDate: dueDateStr,
      cycle: 'MONTHLY',
      description: `GestorPrint — Plano ${tenant.plan} (${tenant.name})`,
      externalReference: tenant.slug || String(tenantId),
      fine: { value: 2, type: 'PERCENTAGE' },
      interest: { value: 1 },
    });

    await (this.prisma as any).tenant.update({
      where: { id: tenantId },
      data: { asaasSubscriptionId: result.id, planStatus: 'ACTIVE', isActive: true },
    });

    this.logger.log(`Asaas subscription created for tenant ${tenantId}: ${result.id}`);
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

    this.logger.log(`Asaas subscription cancelled for tenant ${tenantId}`);
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

    this.logger.log(`Webhook received: event=${event}, customer=${customerId}`);

    if (!customerId) return;

    const tenant = await (this.prisma as any).tenant.findFirst({
      where: { asaasCustomerId: customerId },
    });
    if (!tenant) {
      this.logger.warn(`Webhook: no tenant found for Asaas customer ${customerId}`);
      return;
    }

    const statusMap: Record<string, { planStatus: string; isActive: boolean }> = {
      PAYMENT_CONFIRMED:              { planStatus: 'ACTIVE',     isActive: true  },
      PAYMENT_RECEIVED:               { planStatus: 'ACTIVE',     isActive: true  },
      PAYMENT_OVERDUE:                { planStatus: 'SUSPENDED',  isActive: false },
      PAYMENT_DELETED:                { planStatus: 'CANCELLED',  isActive: false },
      PAYMENT_REFUNDED:               { planStatus: 'SUSPENDED',  isActive: false },
      PAYMENT_CHARGEBACK_REQUESTED:   { planStatus: 'SUSPENDED',  isActive: false },
      SUBSCRIPTION_INACTIVATED:       { planStatus: 'CANCELLED',  isActive: false },
    };

    const update = statusMap[event];
    if (update) {
      await (this.prisma as any).tenant.update({
        where: { id: tenant.id },
        data: update,
      });
      this.logger.log(`Tenant ${tenant.id} updated to ${update.planStatus} via webhook event ${event}`);
    }
    // Eventos informativos — sem ação de estado
    // PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_DUEDATE_WARNING, PAYMENT_ANTICIPATED → apenas log
  }

  // ─── Subscription status ────────────────────────────────────────────────────

  async getSubscription(tenantId: number): Promise<any> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasSubscriptionId) throw new BadRequestException('Tenant não tem assinatura ativa');

    return this.asaas('GET', `/subscriptions/${tenant.asaasSubscriptionId}`);
  }
}
