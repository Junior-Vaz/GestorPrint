import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import {
  shouldDeductStock, shouldNotifyStatus, ORDER_STATUS_LABELS, OrderStatus,
} from '../../domain/orders/order.entity';
import { CheckFeatureUseCase } from '../entitlement/check-feature.usecase';
import { FeatureKey } from '../../domain/entitlement/feature-key.enum';
import {
  IOrderRepository, CreateOrderData, ORDER_REPOSITORY,
} from './order-repository.interface';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { MessagingService } from '../../interface/http/messaging/messaging.service';
import { OrdersGateway } from '../../interface/websocket/orders.gateway';
import { NotificationsService } from '../../interface/http/notifications/notifications.service';
import { AuditService } from '../../interface/http/audit/audit.service';
import { ProductsService } from '../../interface/http/products/products.service';

@Injectable()
export class ManageOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
    private readonly checkFeature: CheckFeatureUseCase,
    private readonly messagingService: MessagingService,
    private readonly ordersGateway: OrdersGateway,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly productsService: ProductsService,
  ) {}

  async create(data: CreateOrderData) {
    const { tenantId } = data;

    // Enforce plan limits
    const tenant = await this.orderRepo.findTenantLimits(tenantId);
    if (!tenant?.isActive || ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
      throw new ForbiddenException('Conta suspensa ou cancelada. Entre em contato com o suporte.');
    }
    const orderCount = await this.orderRepo.countOrdersThisMonth(tenantId);
    if (orderCount >= tenant.maxOrders) {
      throw new ForbiddenException(
        `Limite de ${tenant.maxOrders} pedido(s)/mês atingido. Faça upgrade do seu plano.`,
      );
    }

    // FK ownership: salespersonId, producerId e estimateId precisam ser do tenant
    await this.orderRepo.assertFkOwnership(
      {
        salespersonId: (data as any).salespersonId,
        producerId:    (data as any).producerId,
        estimateId:    data.estimateId,
      },
      tenantId,
    );

    // Resolução do cliente:
    //  1. Se `customerId` foi enviado (PDV/checkout do ecommerce), prefere isso —
    //     evita ambiguidade de lookup por nome quando há clientes homônimos.
    //  2. Senão cai no findOrCreate por nome (compat com AI agent / WhatsApp).
    let customer: { id: number; name: string };
    if ((data as any).customerId) {
      const found = await this.orderRepo.findCustomerById((data as any).customerId, tenantId);
      if (!found) throw new ForbiddenException('Cliente não encontrado neste tenant.');
      customer = found;
    } else {
      customer = await this.orderRepo.findOrCreateCustomer(data.customerName, tenantId);
    }
    const initialStatus: OrderStatus = data.isPdv ? 'DELIVERED' : 'PENDING';

    const newOrder = await this.orderRepo.createOrder({
      ...data,
      customerId: customer.id,
      initialStatus,
    });

    this.ordersGateway.notifyNewOrder(newOrder);

    await this.notificationsService.create({
      title: data.isPdv ? 'Venda PDV Realizada' : 'Novo Pedido Recebido',
      message: `Pedido #${newOrder.id} - ${customer.name} - R$ ${(newOrder.amount as number).toFixed(2)}`,
      type: data.isPdv ? 'SUCCESS' : 'INFO',
      tenantId,
    });

    if (data.isPdv) {
      await this.orderRepo.createTransaction({
        orderId: newOrder.id,
        amount: newOrder.amount as number,
        status: 'PAID',
        paymentType: data.paymentMethod || 'DINHEIRO',
        gatewayId: `PDV-${newOrder.id}-${Date.now()}`,
      });

      if (data.details && Array.isArray(data.details.items)) {
        for (const item of data.details.items) {
          if (item.id && item.quantity > 0 && item.hasStock) {
            try {
              await this.productsService.updateStock(item.id, -item.quantity, 'SALE', tenantId, `Venda PDV - Pedido #${newOrder.id}`);
            } catch (e) {
              console.error(`PDV Stock deduction failed for product ${item.id}:`, e);
            }
          }
        }
      }
    }

    this.ordersGateway.notifyNewOrder(newOrder);
    return newOrder;
  }

  findAll(tenantId: number) { return this.orderRepo.findAll(tenantId); }
  findAllPaginated(tenantId: number, dto: PaginationDto) { return this.orderRepo.findAllPaginated(tenantId, dto); }
  findOne(id: number, tenantId: number) { return this.orderRepo.findOne(id, tenantId); }

  async update(id: number, updateData: any, tenantId: number, userId?: number | null) {
    const previousOrder = await this.orderRepo.findOneRaw(id, tenantId);
    // Normaliza deliveryDate: string "YYYY-MM-DD" ou ISO vira Date; "" desativa.
    if (updateData && 'deliveryDate' in updateData) {
      const v = updateData.deliveryDate;
      if (v === null || v === '') updateData.deliveryDate = null;
      else if (typeof v === 'string') {
        updateData.deliveryDate = v.length === 10 ? new Date(`${v}T00:00:00.000Z`) : new Date(v);
      } else if (v === undefined) {
        delete updateData.deliveryDate;
      }
    }
    // Remove chaves explicitamente undefined — Prisma prefere não receber a chave a receber undefined
    for (const k of Object.keys(updateData || {})) {
      if (updateData[k] === undefined) delete updateData[k];
    }
    const updatedOrder = await this.orderRepo.update(id, updateData);

    // userId real do operador (chat ERP/Kanban via JWT) — null se chamada
    // veio de contexto de sistema sem auth (cron, hooks).
    await this.auditService.logAction(userId ?? null, 'UPDATE', 'Order', id, {
      oldStatus: previousOrder?.status,
      newStatus: updatedOrder.status,
      fields: Object.keys(updateData),
    }, tenantId);

    const prevStatus = previousOrder?.status as OrderStatus;
    const nextStatus = updatedOrder.status as OrderStatus;

    if (prevStatus !== nextStatus) {
      const statusName = ORDER_STATUS_LABELS[nextStatus] || nextStatus;
      await this.notificationsService.create({
        tenantId,
        title:   'Atualização de Pedido',
        message: `O Pedido #${id} (${updatedOrder.customerName}) mudou para: ${statusName}`,
        type:    nextStatus === 'DELIVERED' || nextStatus === 'COMPLETED' ? 'SUCCESS' : 'INFO',
      });
    }

    if (shouldDeductStock(prevStatus, nextStatus)) {
      await this._handleStockDeduction(previousOrder, tenantId);
      await this.messagingService.notifyOrderStatus(updatedOrder.id, 'PRODUCTION');

      const hasPaidTx = await this.orderRepo.findPaidTransaction(updatedOrder.id);
      if (!hasPaidTx) {
        await this.orderRepo.createTransaction({
          orderId: updatedOrder.id,
          amount: updatedOrder.amount as number,
          status: 'PAID',
          paymentType: 'DINHEIRO',
          gatewayId: `MANUAL-${updatedOrder.id}-${Date.now()}`,
        });
      }
    }

    if (shouldNotifyStatus(prevStatus, nextStatus) && nextStatus !== 'PRODUCTION') {
      await this.messagingService.notifyOrderStatus(updatedOrder.id, nextStatus);
    }

    this.ordersGateway.notifyOrderUpdated(updatedOrder);
    return updatedOrder;
  }

  async remove(id: number, tenantId: number, userId?: number | null) {
    const order = await this.orderRepo.findOneRaw(id, tenantId);
    const deleted = await this.orderRepo.remove(id, tenantId);
    await this.auditService.logAction(userId ?? null, 'DELETE', 'Order', id, {
      customer: order?.customer?.name,
      description: order?.productDescription,
      amount: order?.amount,
    }, tenantId);
    return deleted;
  }

  async requirePdfFeature(tenantId: number) {
    await this.checkFeature.execute(tenantId, FeatureKey.PDF_GENERATION);
  }

  private async _handleStockDeduction(order: any, tenantId: number) {
    if (!order?.estimateId || !order?.estimate) return;
    try {
      const details = order.estimate.details as any;
      const paperName = details?.paperName;
      const quantity = details?.quantity || 0;
      if (paperName && quantity > 0) {
        const products = await this.productsService.findAllInternal(tenantId);
        const product = products.find((p: any) =>
          p.name.toLowerCase().includes(paperName.toLowerCase()) ||
          paperName.toLowerCase().includes(p.name.toLowerCase()),
        );
        if (product) {
          await this.productsService.updateStock(product.id, -quantity, 'SALE', tenantId, `Consumo automático - Pedido #${order.id}`);
        }
      }
    } catch (error) {
      console.error('Inventory Deduction Failed:', error);
    }
  }
}
