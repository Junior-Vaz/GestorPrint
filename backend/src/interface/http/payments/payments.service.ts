import { Injectable } from '@nestjs/common';
import { ProcessPaymentUseCase } from '../../../application/payments/process-payment.usecase';

@Injectable()
export class PaymentsService {
  constructor(private readonly processPayment: ProcessPaymentUseCase) {}

  checkIntegration() { return this.processPayment.checkIntegration(); }
  createPayment(orderId: number, type: 'PIX' | 'LINK' = 'PIX') { return this.processPayment.createPayment(orderId, type); }
  handleWebhook(data: any) { return this.processPayment.handleWebhook(data); }
  checkPaymentStatus(transactionId: number) { return this.processPayment.checkPaymentStatus(transactionId); }
  confirmPaymentManually(transactionId: number) { return this.processPayment.confirmPaymentManually(transactionId); }
  getFinancialStats() { return this.processPayment.getFinancialStats(); }
  getAllTransactions() { return this.processPayment.getAllTransactions(); }
  getTransactionsPaginated(tenantId: number, dto: any) { return this.processPayment.getTransactionsPaginated(tenantId, dto); }
}
