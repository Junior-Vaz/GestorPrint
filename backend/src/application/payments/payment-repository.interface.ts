import { OrderForPayment, PaymentTransaction } from '../../domain/payments/payment.entity';
import { PaginatedResult, PaginationDto } from '../../shared/dto/pagination.dto';

export interface IMercadoPagoGateway {
  createPixPayment(data: {
    amount: number;
    description: string;
    payerEmail: string;
    payerFirstName: string;
    payerLastName: string;
    documentType?: 'CPF' | 'CNPJ';
    documentNumber?: string;
  }): Promise<{
    id: string;
    paymentUrl?: string;
    qrCode?: string;
    qrCodeBase64?: string;
  }>;

  getPaymentStatus(gatewayId: string): Promise<{ status: string }>;
  isConfigured(): Promise<boolean>;

  /** Reembolso total (sem amount) ou parcial (com amount) via /v1/payments/{id}/refunds */
  refundPayment(paymentId: string, amount?: number): Promise<{
    id: string;
    amount: number;
    status: string;
    paymentStatus: string;
  }>;
}

export interface IPaymentRepository {
  findOrderWithCustomer(orderId: number): Promise<OrderForPayment | null>;
  findTransactionById(id: number): Promise<PaymentTransaction | null>;
  findTransactionByGatewayId(gatewayId: string): Promise<PaymentTransaction | null>;
  createTransaction(data: Omit<PaymentTransaction, 'id'>): Promise<PaymentTransaction>;
  finalizePayment(transactionId: number, orderId: number): Promise<PaymentTransaction>;
  getFinancialStats(): Promise<{ totalRevenue: number; paidCount: number; pendingCount: number }>;
  getAllTransactions(): Promise<any[]>;
  getTransactionsPaginated(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<any>>;
  getMpAccessToken(): Promise<string | null>;
}

export const MERCADO_PAGO_GATEWAY = Symbol('IMercadoPagoGateway');
export const PAYMENT_REPOSITORY = Symbol('IPaymentRepository');
