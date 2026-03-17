import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create/:orderId')
  createPayment(@Param('orderId') orderId: string, @Query('type') type: 'PIX' | 'LINK') {
    return this.paymentsService.createPayment(+orderId, type);
  }

  @Post('webhook')
  handleWebhook(@Body() body: any) {
    return this.paymentsService.handleWebhook(body);
  }

  @Get('stats')
  getStats() {
    return this.paymentsService.getFinancialStats();
  }

  @Get('history')
  async getHistory() {
    return this.paymentsService.getAllTransactions();
  }

  @Post('confirm/:id')
  async confirmPayment(@Param('id') id: string) {
    return this.paymentsService.confirmPaymentManually(+id);
  }

  @Get('check/:id')
  async checkStatus(@Param('id') id: string) {
    return this.paymentsService.checkPaymentStatus(+id);
  }
}
