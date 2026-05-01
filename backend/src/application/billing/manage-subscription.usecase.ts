import {
  Inject, Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { resolveWebhookEvent } from '../../domain/billing/subscription.entity';
import {
  IBillingRepository, IAsaasGateway,
  BILLING_REPOSITORY, ASAAS_GATEWAY,
} from './billing-repository.interface';
import { PlatformSettingsService } from '../../shared/platform-settings.service';

@Injectable()
export class ManageSubscriptionUseCase {
  private readonly logger = new Logger(ManageSubscriptionUseCase.name);

  constructor(
    @Inject(BILLING_REPOSITORY) private readonly billingRepo: IBillingRepository,
    @Inject(ASAAS_GATEWAY) private readonly asaasGateway: IAsaasGateway,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async getConfig() {
    const apiKey = await this.platformSettings.get('asaasApiKey');
    const env    = await this.platformSettings.get('asaasEnv');
    const apiUrl = await this.platformSettings.get('apiUrl');
    return {
      configured: !!apiKey,
      env: env || 'sandbox',
      webhookUrl: `${apiUrl || 'https://api.gestorprint.com.br'}/api/billing/webhooks`,
    };
  }

  async getPlatformSettings() {
    const apiKey       = await this.platformSettings.get('asaasApiKey');
    const env          = await this.platformSettings.get('asaasEnv');
    const apiUrl       = await this.platformSettings.get('apiUrl');
    const webhookToken = await this.platformSettings.get('asaasWebhookToken');
    const smtpHost     = await this.platformSettings.get('smtpHost');
    return {
      asaasConfigured: !!apiKey,
      asaasEnv: env || 'sandbox',
      webhookUrl: `${apiUrl || 'https://api.gestorprint.com.br'}/api/billing/webhooks`,
      webhookTokenConfigured: !!webhookToken,
      webhookTokenMask: webhookToken ? `${webhookToken.slice(0, 8)}${'*'.repeat(8)}` : '',
      smtpConfigured: !!smtpHost,
      smtpHost,
    };
  }

  async createCustomer(tenantId: number): Promise<{ asaasCustomerId: string }> {
    const tenant = await this.billingRepo.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    if (tenant.asaasCustomerId) return { asaasCustomerId: tenant.asaasCustomerId };

    if (!tenant.cpfCnpj) {
      throw new BadRequestException(
        'Cadastre o CPF/CNPJ do responsável no tenant antes de criar o cliente no Asaas',
      );
    }

    const result = await this.asaasGateway.createCustomer({
      name: tenant.ownerName || tenant.name,
      cpfCnpj: tenant.cpfCnpj,
      email: tenant.ownerEmail ?? undefined,
      mobilePhone: tenant.ownerPhone ?? undefined,
      externalReference: String(tenantId),
    });

    await this.billingRepo.setAsaasCustomerId(tenantId, result.id);
    this.logger.log(`Asaas customer created for tenant ${tenantId}: ${result.id}`);
    return { asaasCustomerId: result.id };
  }

  async createSubscription(
    tenantId: number,
    billingType: string,
  ): Promise<{ asaasSubscriptionId: string }> {
    const tenant = await this.billingRepo.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasCustomerId) {
      throw new BadRequestException('Crie o cliente no Asaas antes de gerar a assinatura');
    }
    if (!tenant.planPrice) {
      throw new BadRequestException(`Plano ${tenant.plan} é gratuito e não possui cobrança`);
    }

    if (tenant.asaasSubscriptionId) {
      try {
        await this.asaasGateway.deleteSubscription(tenant.asaasSubscriptionId);
      } catch (err) {
        this.logger.warn(`Could not delete old subscription ${tenant.asaasSubscriptionId}: ${err}`);
      }
    }

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().split('T')[0];

    const result = await this.asaasGateway.createSubscription({
      customer: tenant.asaasCustomerId,
      billingType,
      value: tenant.planPrice,
      nextDueDate: dueDateStr,
      cycle: 'MONTHLY',
      description: `GestorPrint — Plano ${tenant.plan} (${tenant.name})`,
      externalReference: tenant.slug || String(tenantId),
    });

    await this.billingRepo.setSubscription(tenantId, result.id, 'ACTIVE', true);
    this.logger.log(`Asaas subscription created for tenant ${tenantId}: ${result.id}`);
    return { asaasSubscriptionId: result.id };
  }

  async cancelSubscription(tenantId: number, performedBy?: string | null): Promise<void> {
    const tenant = await this.billingRepo.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasSubscriptionId) throw new BadRequestException('Tenant não tem assinatura ativa');

    await this.asaasGateway.deleteSubscription(tenant.asaasSubscriptionId);
    await this.billingRepo.cancelSubscription(tenantId, performedBy ?? 'admin');
    this.logger.log(`Asaas subscription cancelled for tenant ${tenantId} by ${performedBy ?? 'system'}`);
  }

  async getInvoices(tenantId: number): Promise<any[]> {
    const tenant = await this.billingRepo.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasCustomerId) return [];

    return this.asaasGateway.getPaymentsByCustomer(tenant.asaasCustomerId, 20);
  }

  /**
   * Processa webhook do Asaas.
   * - Idempotente: SubscriptionEvent.gatewayEventId @unique impede reprocessamento.
   * - Grace period: PAYMENT_OVERDUE não suspende imediatamente; só após
   *   `asaasGracePeriodDays` dias (default 3) corridos sem pagamento.
   * - Audit trail: cada transição grava SubscriptionEvent com payload completo.
   */
  async handleWebhook(payload: any): Promise<void> {
    const event: string = payload?.event;
    const customerId: string = payload?.payment?.customer;
    const gatewayEventId: string | null = payload?.id || payload?.payment?.id || null;

    this.logger.log(`Webhook received: event=${event}, customer=${customerId}, eventId=${gatewayEventId}`);
    if (!customerId) return;

    const tenant = await this.billingRepo.findTenantByAsaasCustomerId(customerId);
    if (!tenant) {
      this.logger.warn(`Webhook: no tenant found for Asaas customer ${customerId}`);
      return;
    }

    const update = resolveWebhookEvent(event);
    if (!update) return; // Evento informativo (PAYMENT_CREATED, etc) — só log

    // Grace period pra OVERDUE: damos N dias antes de suspender
    if (event === 'PAYMENT_OVERDUE') {
      const graceDays = await this.platformSettings.getNumber('asaasGracePeriodDays', 3);
      const dueDate = payload?.payment?.dueDate
        ? new Date(payload.payment.dueDate)
        : new Date();
      const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue < graceDays) {
        this.logger.log(
          `Tenant ${tenant.id} OVERDUE há ${daysOverdue}d — dentro do grace period (${graceDays}d). Mantendo ativo.`,
        );
        // Mesmo dentro do grace, gravamos o evento pra rastreio
        await this.billingRepo.recordSubscriptionEvent({
          tenantId:       tenant.id,
          eventType:      event,
          fromStatus:     await this.billingRepo.getCurrentPlanStatus(tenant.id) ?? 'UNKNOWN',
          toStatus:       'GRACE_PERIOD',
          gatewayEventId,
          performedBy:    'webhook',
          payload,
        });
        return;
      }
    }

    const fromStatus = await this.billingRepo.getCurrentPlanStatus(tenant.id) ?? 'UNKNOWN';

    // Idempotência: se gatewayEventId já existe, recordSubscriptionEvent retorna false
    const recorded = await this.billingRepo.recordSubscriptionEvent({
      tenantId:       tenant.id,
      eventType:      event,
      fromStatus,
      toStatus:       update.planStatus,
      gatewayEventId,
      performedBy:    'webhook',
      payload,
    });

    if (!recorded) {
      this.logger.warn(`Webhook idempotency: event ${gatewayEventId} já processado, skip`);
      return;
    }

    await this.billingRepo.updatePlanStatus(tenant.id, update.planStatus, update.isActive);
    this.logger.log(`Tenant ${tenant.id} ${fromStatus} → ${update.planStatus} via ${event}`);
  }

  async getSubscription(tenantId: number): Promise<any> {
    const tenant = await this.billingRepo.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.asaasSubscriptionId) throw new BadRequestException('Tenant não tem assinatura ativa');

    return this.asaasGateway.getSubscription(tenant.asaasSubscriptionId);
  }
}
