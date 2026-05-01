import {
  Inject, Injectable, InternalServerErrorException,
} from '@nestjs/common';
import { CheckFeatureUseCase } from '../entitlement/check-feature.usecase';
import { FeatureKey } from '../../domain/entitlement/feature-key.enum';
import { extractValidDocument } from '../../domain/payments/payment.entity';
import {
  IMercadoPagoGateway, IPaymentRepository,
  MERCADO_PAGO_GATEWAY, PAYMENT_REPOSITORY,
} from './payment-repository.interface';
import { MessagingService } from '../../interface/http/messaging/messaging.service';
import { OrdersGateway } from '../../interface/websocket/orders.gateway';
import { NotificationsService } from '../../interface/http/notifications/notifications.service';

@Injectable()
export class ProcessPaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepo: IPaymentRepository,
    @Inject(MERCADO_PAGO_GATEWAY) private readonly mpGateway: IMercadoPagoGateway,
    private readonly checkFeature: CheckFeatureUseCase,
    private readonly messagingService: MessagingService,
    private readonly ordersGateway: OrdersGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async checkIntegration() {
    return { integrated: await this.mpGateway.isConfigured() };
  }

  async createPayment(orderId: number, type: 'PIX' | 'LINK' = 'PIX') {
    const order = await this.paymentRepo.findOrderWithCustomer(orderId);
    if (!order) throw new InternalServerErrorException('Pedido não encontrado');

    if (order.tenantId) {
      await this.checkFeature.execute(order.tenantId, FeatureKey.PIX_PAYMENTS);
    }

    const configured = await this.mpGateway.isConfigured();
    if (!configured) throw new InternalServerErrorException('Mercado Pago não configurado. Vá em Configurações.');

    try {
      const docNumber = extractValidDocument(order.customer.document);
      const firstName = order.customer.name.split(' ')[0];
      const lastName = order.customer.name.split(' ').slice(1).join(' ') || 'Cliente';

      const response = await this.mpGateway.createPixPayment({
        amount: Number(order.amount.toFixed(2)),
        description: `Pedido #${order.id} - GestorPrint`,
        payerEmail: order.customer.email || 'guest@example.com',
        payerFirstName: firstName,
        payerLastName: lastName,
        documentType: docNumber ? (docNumber.length === 11 ? 'CPF' : 'CNPJ') : undefined,
        documentNumber: docNumber ?? undefined,
      });

      return this.paymentRepo.createTransaction({
        orderId: order.id,
        amount: Number(order.amount.toFixed(2)),
        status: 'PENDING',
        paymentType: type,
        gatewayId: response.id,
        paymentUrl: response.paymentUrl ?? null,
        qrCode: response.qrCode ?? null,
        qrCodeBase64: response.qrCodeBase64 ?? null,
      });
    } catch (error: any) {
      let errorMessage = 'Erro ao gerar pagamento no Gateway.';
      const mpError = error.message || '';
      if (mpError.includes('Collector user without key enabled')) {
        errorMessage = 'Sua conta Mercado Pago não possui uma Chave Pix cadastrada. Ative o Pix no seu painel do Mercado Pago.';
      } else if (error.cause?.[0]?.description === 'Invalid user identification number') {
        errorMessage = 'O CPF/CNPJ do cliente é inválido para o Mercado Pago.';
      }
      throw new InternalServerErrorException(errorMessage);
    }
  }

  async handleWebhook(data: any) {
    if (data.type !== 'payment' && data.action !== 'payment.updated') return { ok: true };

    const paymentId = data.data?.id || data.id;
    const configured = await this.mpGateway.isConfigured();
    if (!configured) return { ok: false, error: 'MP not configured' };

    try {
      const details = await this.mpGateway.getPaymentStatus(paymentId);
      if (details.status === 'approved') {
        const transaction = await this.paymentRepo.findTransactionByGatewayId(paymentId.toString());
        if (transaction && transaction.status !== 'PAID') {
          await this._finalizePayment(transaction.id, transaction.orderId);
        }
      }
    } catch (error) {
      console.error('Error processing webhook payment:', error);
    }
    return { ok: true };
  }

  async checkPaymentStatus(transactionId: number) {
    const transaction = await this.paymentRepo.findTransactionById(transactionId);
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status === 'PAID') return transaction;
    if (!transaction.gatewayId) throw new Error('Gateway ID missing');

    const details = await this.mpGateway.getPaymentStatus(transaction.gatewayId);
    if (details.status === 'approved') {
      return this._finalizePayment(transaction.id, transaction.orderId);
    }
    return transaction;
  }

  async confirmPaymentManually(transactionId: number) {
    const transaction = await this.paymentRepo.findTransactionById(transactionId);
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status === 'PAID') return transaction;
    return this._finalizePayment(transaction.id, transaction.orderId);
  }

  getFinancialStats() { return this.paymentRepo.getFinancialStats(); }
  getAllTransactions() { return this.paymentRepo.getAllTransactions(); }
  getTransactionsPaginated(tenantId: number, dto: any) { return this.paymentRepo.getTransactionsPaginated(tenantId, dto); }

  private async _finalizePayment(transactionId: number, orderId: number) {
    const result = await this.paymentRepo.finalizePayment(transactionId, orderId);
    // Pega o tenantId do pedido pra emitir só pra sala daquele tenant (multi-tenancy WS)
    const order = await this.paymentRepo.findOrderWithCustomer(orderId).catch(() => null);
    const tenantId = order?.tenantId;

    await this.messagingService.notifyOrderStatus(orderId, 'PRODUCTION');
    this.ordersGateway.notifyOrderUpdated({ id: orderId, tenantId, status: 'PRODUCTION', customerName: '' });
    // Sem tenantId não tem como rotear pra sala correta — falha alto em vez de
    // poluir o tenant 1 (que era o comportamento do antigo `?? 1`).
    if (tenantId) {
      await this.notificationsService.create({
        tenantId,
        title:   'Pagamento Confirmado',
        message: `O pagamento do Pedido #${orderId} foi aprovado.`,
        type:    'SUCCESS',
      });
    } else {
      console.warn(`_finalizePayment: tenantId ausente para orderId=${orderId} — notificação pulada`);
    }
    return result;
  }
}
