import { Inject, Injectable } from '@nestjs/common';
import { buildProductDescription, EstimateType } from '../../domain/estimates/estimate.entity';
import {
  IEstimateRepository, ESTIMATE_REPOSITORY,
} from './estimate-repository.interface';
import { OrdersGateway } from '../../interface/websocket/orders.gateway';
import { NotificationsService } from '../../interface/http/notifications/notifications.service';

@Injectable()
export class ConvertEstimateUseCase {
  constructor(
    @Inject(ESTIMATE_REPOSITORY) private readonly estimateRepo: IEstimateRepository,
    private readonly ordersGateway: OrdersGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async execute(id: number, tenantId: number, opts: { deliveryDate?: string | null; priority?: string } = {}) {
    const estimate = await this.estimateRepo.findOne(id, tenantId);
    if (!estimate) throw new Error('Orcamento nao encontrado');

    const estimateType = (estimate.estimateType || 'service') as EstimateType;
    const productDescription = buildProductDescription(estimateType, estimate.details);

    let deliveryDate: Date | null | undefined;
    if (opts.deliveryDate === null || opts.deliveryDate === '') deliveryDate = null;
    else if (typeof opts.deliveryDate === 'string') {
      deliveryDate = opts.deliveryDate.length === 10
        ? new Date(`${opts.deliveryDate}T00:00:00.000Z`)
        : new Date(opts.deliveryDate);
    }

    const order = await this.estimateRepo.createOrder({
      customerId: estimate.customerId,
      estimateId: estimate.id,
      salespersonId: estimate.salespersonId,
      tenantId,
      productDescription,
      amount: estimate.totalPrice,
      status: 'PENDING',
      ...(deliveryDate !== undefined ? { deliveryDate } : {}),
      ...(opts.priority ? { priority: opts.priority } : {}),
    } as any);

    try {
      await this.estimateRepo.migrateAttachments(estimate.id, order.id);
    } catch (e) {
      console.error('Falha ao migrar anexos do orcamento para o pedido', e);
    }

    const updatedEstimate = await this.estimateRepo.updateStatus(id, 'APPROVED');

    this.ordersGateway.notifyNewOrder({
      id: order.id,
      tenantId,
      customerName: estimate.customer.name,
      productDescription: order.productDescription,
      amount: order.amount,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    });

    await this.notificationsService.create({
      tenantId,
      title: 'Novo Pedido (Orcamento)',
      message: `O Orcamento #${id} (${estimate.customer.name}) foi aprovado e convertido em Pedido.`,
      type: 'INFO',
    });

    return { order, estimate: updatedEstimate };
  }
}
