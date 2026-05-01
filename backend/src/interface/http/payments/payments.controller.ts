import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { PaymentsService } from './payments.service';

/**
 * JwtAuthGuard no nível do controller garante que `req.user` esteja
 * populado ANTES dos guards aplicados via decorators (`@CanAccess`).
 * Sem isso, a ordem reversa de decorators do TS faz o CanAccessGuard
 * rodar antes do JwtAuthGuard e o req.user fica undefined → "Não autenticado".
 *
 * Endpoints públicos (webhook do MP, criar cobrança via SPA do ecommerce)
 * são marcados com @Public() — JwtAuthGuard respeita esse flag.
 */
@ApiTags('payments')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('create/:orderId')
  createPayment(@Param('orderId') orderId: string, @Query('type') type: 'PIX' | 'LINK') {
    return this.paymentsService.createPayment(+orderId, type);
  }

  @Public()
  @Post('webhook')
  handleWebhook(@Body() body: any) {
    return this.paymentsService.handleWebhook(body);
  }

  @Get('stats')
  @CanAccess('financial', 'view')
  getStats() {
    return this.paymentsService.getFinancialStats();
  }

  @Get('history')
  @CanAccess('financial', 'view')
  async getHistory(@CurrentTenant() tenantId: number, @Query() dto: any) {
    if (dto.page || dto.limit || dto.search || dto.status) {
      return this.paymentsService.getTransactionsPaginated(tenantId, dto);
    }
    return this.paymentsService.getAllTransactions();
  }

  @Post('confirm/:id')
  @CanAccess('financial', 'edit')
  async confirmPayment(@Param('id') id: string) {
    return this.paymentsService.confirmPaymentManually(+id);
  }

  @Get('check/:id')
  @CanAccess('financial', 'view')
  async checkStatus(@Param('id') id: string) {
    return this.paymentsService.checkPaymentStatus(+id);
  }

  @Get('config-status')
  @CanAccess('financial', 'view')
  async getConfigStatus() {
    return this.paymentsService.checkIntegration();
  }
}
