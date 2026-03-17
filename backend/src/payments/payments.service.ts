import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MessagingService } from '../messaging/messaging.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private client: MercadoPagoConfig | null = null;

  constructor(
    private prisma: PrismaService,
    private messagingService: MessagingService,
    private ordersGateway: OrdersGateway,
    private notificationsService: NotificationsService,
  ) {}

  private async getClient() {
    const settings = await (this.prisma as any).settings.findUnique({ where: { id: 1 } });
    const accessToken = settings?.mpAccessToken;

    if (!accessToken) {
      console.error('❌ Mercado Pago Access Token não configurado no banco de dados');
      return null;
    }

    if (!this.client || (this.client as any).accessToken !== accessToken) {
      this.client = new MercadoPagoConfig({ accessToken });
    }
    return this.client;
  }

  async createPayment(orderId: number, type: 'PIX' | 'LINK' = 'PIX') {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    const client = await this.getClient();
    if (!client) throw new InternalServerErrorException('Mercado Pago não configurado. Vá em Configurações.');

    const payment = new Payment(client);

    try {
      const docNumber = order!.customer.document?.replace(/\D/g, '') || '';
      const isValidDoc = docNumber.length === 11 || docNumber.length === 14;

      const body: any = {
        transaction_amount: Number(order!.amount.toFixed(2)),
        description: `Pedido #${order!.id} - GestorPrint`,
        payment_method_id: 'pix',
        payer: {
          email: order!.customer.email || 'guest@example.com',
          first_name: order!.customer.name.split(' ')[0],
          last_name: order!.customer.name.split(' ').slice(1).join(' ') || 'Cliente',
        },
      };

      // Only add identification if we have a valid-looking CPF/CNPJ
      if (isValidDoc) {
        body.payer.identification = {
          type: docNumber.length === 11 ? 'CPF' : 'CNPJ',
          number: docNumber,
        };
      }

      console.log('Generating Pix for:', body.payer.email, isValidDoc ? '(with document)' : '(without document)');
      const response: any = await payment.create({ body });

      // Save Transaction record
      return (this.prisma as any).transaction.create({
        data: {
          orderId: order!.id,
          amount: Number(order!.amount.toFixed(2)),
          status: 'PENDING',
          paymentType: type,
          gatewayId: response.id?.toString(),
          paymentUrl: response.point_of_interaction?.transaction_data?.ticket_url || response.init_point,
          qrCode: response.point_of_interaction?.transaction_data?.qr_code,
          qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
        }
      });
    } catch (error: any) {
      console.error('Mercado Pago Error Detail:', JSON.stringify(error, null, 2));
      
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
    console.log('Webhook received:', JSON.stringify(data, null, 2));

    if (data.type === 'payment' || data.action === 'payment.updated') {
      const paymentId = data.data?.id || data.id;
      console.log(`Processing payment update for ID: ${paymentId}`);
      const client = await this.getClient();
      if (!client) {
        console.error('Mercado Pago client not initialized for webhook');
        return { ok: false, error: 'MP not configured' };
      }

      const mpPayment = new Payment(client);
      try {
        const details: any = await mpPayment.get({ id: paymentId });

        if (details.status === 'approved') {
          const transaction = await (this.prisma as any).transaction.findUnique({
            where: { gatewayId: paymentId.toString() }
          });

          if (transaction && transaction.status !== 'PAID') {
            await this.finalizePayment(transaction.id, transaction.orderId);
          }
        }
      } catch (error) {
        console.error('Error processing webhook payment:', error);
      }
    }
    return { ok: true };
  }

  async checkPaymentStatus(transactionId: number) {
    const transaction = await (this.prisma as any).transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status === 'PAID') return transaction;
    if (!transaction.gatewayId) throw new Error('Gateway ID missing');

    const client = await this.getClient();
    if (!client) throw new Error('MP not configured');

    const mpPayment = new Payment(client);
    try {
      const details: any = await mpPayment.get({ id: transaction.gatewayId });
      
      if (details.status === 'approved') {
        return this.finalizePayment(transaction.id, transaction.orderId);
      }
      return transaction;
    } catch (error) {
      console.error('Error checking payment status:', error);
      throw error;
    }
  }

  async confirmPaymentManually(transactionId: number) {
    const transaction = await (this.prisma as any).transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status === 'PAID') return transaction;

    return this.finalizePayment(transaction.id, transaction.orderId);
  }

  private async finalizePayment(transactionId: number, orderId: number) {
    return this.prisma.$transaction(async (tx) => {
      const updatedTransaction = await (tx as any).transaction.update({
        where: { id: transactionId },
        data: { status: 'PAID' }
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PRODUCTION' }
      });

      await this.messagingService.notifyOrderStatus(orderId, 'PRODUCTION');

      // Notify real-time UI
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { customer: true } });
      this.ordersGateway.notifyOrderUpdated({
        id: order!.id,
        status: 'PRODUCTION',
        customerName: order!.customer.name
      });

      // Create System Notification
      await this.notificationsService.create({
        title: 'Pagamento Confirmado',
        message: `O pagamento do Pedido #${orderId} (${order!.customer.name}) foi aprovado.`,
        type: 'SUCCESS',
      });

      return updatedTransaction;
    });
  }

  async getFinancialStats() {
    try {
      console.log('Fetching financial stats...');
      const transactions = await (this.prisma as any).transaction.findMany({
        where: { status: 'PAID' }
      });
      console.log(`Found ${transactions.length} paid transactions`);
      
      const totalRevenue = transactions.reduce((acc: number, t: any) => acc + Number(t.amount), 0);
      const pendingTransactions = await (this.prisma as any).transaction.count({
        where: { status: 'PENDING' }
      });

      return {
        totalRevenue,
        paidCount: transactions.length,
        pendingCount: pendingTransactions
      };
    } catch (error) {
      console.error('Error in getFinancialStats:', error);
      throw error;
    }
  }

  async getAllTransactions() {
    try {
      console.log('Fetching all transactions...');
      const transactions = await (this.prisma as any).transaction.findMany({
        include: { 
          order: {
            include: { customer: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log(`Returning ${transactions.length} transactions`);
      return transactions;
    } catch (error) {
      console.error('Error in getAllTransactions:', error);
      throw error;
    }
  }
}
