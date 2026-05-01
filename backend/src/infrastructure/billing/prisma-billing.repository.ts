import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { IBillingRepository } from '../../application/billing/billing-repository.interface';
import { SubscriptionStatus, TenantBillingData } from '../../domain/billing/subscription.entity';

@Injectable()
export class PrismaBillingRepository implements IBillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTenantById(tenantId: number): Promise<TenantBillingData | null> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;

    const planConfig = await (this.prisma as any).planConfig.findUnique({
      where: { name: tenant.plan },
      select: { price: true },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      ownerName: tenant.ownerName,
      ownerEmail: tenant.ownerEmail,
      ownerPhone: tenant.ownerPhone,
      cpfCnpj: tenant.cpfCnpj,
      plan: tenant.plan,
      planPrice: planConfig?.price ?? 0,
      asaasCustomerId: tenant.asaasCustomerId,
      asaasSubscriptionId: tenant.asaasSubscriptionId,
      slug: tenant.slug,
    };
  }

  async findTenantByAsaasCustomerId(customerId: string): Promise<TenantBillingData | null> {
    const tenant = await (this.prisma as any).tenant.findFirst({
      where: { asaasCustomerId: customerId },
    });
    if (!tenant) return null;

    return {
      id: tenant.id,
      name: tenant.name,
      ownerName: tenant.ownerName,
      ownerEmail: tenant.ownerEmail,
      ownerPhone: tenant.ownerPhone,
      cpfCnpj: tenant.cpfCnpj,
      plan: tenant.plan,
      planPrice: 0,
      asaasCustomerId: tenant.asaasCustomerId,
      asaasSubscriptionId: tenant.asaasSubscriptionId,
      slug: tenant.slug,
    };
  }

  async setAsaasCustomerId(tenantId: number, asaasCustomerId: string): Promise<void> {
    await (this.prisma as any).tenant.update({ where: { id: tenantId }, data: { asaasCustomerId } });
  }

  async setSubscription(
    tenantId: number,
    asaasSubscriptionId: string,
    planStatus: SubscriptionStatus,
    isActive: boolean,
  ): Promise<void> {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    await (this.prisma as any).tenant.update({
      where: { id: tenantId },
      data: { asaasSubscriptionId, planStatus, isActive },
    });
    // Mantém também a tabela Subscription como fonte de verdade interna
    // (independente do gateway externo). Status mapping: ACTIVE → ACTIVE.
    await (this.prisma as any).subscription.upsert({
      where: { tenantId },
      update: {
        gatewayName:          'ASAAS',
        gatewaySubscriptionId: asaasSubscriptionId,
        status:               planStatus === 'ACTIVE' ? 'ACTIVE' : (planStatus === 'TRIALING' ? 'TRIALING' : planStatus),
        cancelledAt:          null,
      },
      create: {
        tenantId,
        planName:              tenant?.plan ?? 'BASIC',
        gatewayName:           'ASAAS',
        gatewaySubscriptionId: asaasSubscriptionId,
        status:                planStatus === 'ACTIVE' ? 'ACTIVE' : (planStatus === 'TRIALING' ? 'TRIALING' : planStatus),
      },
    });
  }

  async cancelSubscription(tenantId: number, performedBy: string | null = null): Promise<void> {
    const fromStatus = await this.getCurrentPlanStatus(tenantId);
    await (this.prisma as any).tenant.update({
      where: { id: tenantId },
      data: { asaasSubscriptionId: null, planStatus: 'CANCELLED', isActive: false },
    });
    await (this.prisma as any).subscription.updateMany({
      where: { tenantId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    // Audit explícito do cancelamento manual
    const sub = await (this.prisma as any).subscription.findUnique({ where: { tenantId } });
    if (sub) {
      await (this.prisma as any).subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          eventType:      'MANUAL_CANCEL',
          fromStatus:     fromStatus ?? 'UNKNOWN',
          toStatus:       'CANCELLED',
          performedBy:    performedBy ?? 'system',
          payload:        { reason: 'admin-cancel' },
        },
      });
    }
  }

  async updatePlanStatus(tenantId: number, planStatus: SubscriptionStatus, isActive: boolean): Promise<void> {
    await (this.prisma as any).tenant.update({ where: { id: tenantId }, data: { planStatus, isActive } });
    // Espelha na tabela Subscription pra manter consistência
    await (this.prisma as any).subscription.updateMany({
      where: { tenantId },
      data: {
        status: planStatus === 'ACTIVE' ? 'ACTIVE' : (planStatus === 'TRIALING' ? 'TRIALING' : planStatus),
        ...(planStatus === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
      },
    });
  }

  async getCurrentPlanStatus(tenantId: number): Promise<string | null> {
    const t = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { planStatus: true },
    });
    return t?.planStatus ?? null;
  }

  /**
   * Idempotente: se já existe SubscriptionEvent com mesmo gatewayEventId, retorna false.
   * Garantia contra reprocessamento de webhook reenviado pelo Asaas.
   */
  async recordSubscriptionEvent(args: {
    tenantId:       number;
    eventType:      string;
    fromStatus:     string;
    toStatus:       string;
    gatewayEventId: string | null;
    performedBy:    string | null;
    payload:        any;
  }): Promise<boolean> {
    if (args.gatewayEventId) {
      const existing = await (this.prisma as any).subscriptionEvent.findUnique({
        where: { gatewayEventId: args.gatewayEventId },
      });
      if (existing) return false;
    }
    const sub = await (this.prisma as any).subscription.findUnique({ where: { tenantId: args.tenantId } });
    if (!sub) return false;
    await (this.prisma as any).subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        eventType:      args.eventType,
        fromStatus:     args.fromStatus,
        toStatus:       args.toStatus,
        gatewayEventId: args.gatewayEventId,
        performedBy:    args.performedBy,
        payload:        args.payload,
      },
    });
    return true;
  }
}
