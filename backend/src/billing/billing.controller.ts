import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Webhook público — Asaas não envia JWT
  @Public()
  @Post('webhooks')
  @HttpCode(200)
  async webhook(@Body() payload: any) {
    await this.billingService.handleWebhook(payload);
    return { received: true };
  }

  // Demais endpoints: apenas ADMIN
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('config')
  getConfig() {
    return this.billingService.getConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('customers/:tenantId')
  createCustomer(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.billingService.createCustomer(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('subscriptions/:tenantId')
  createSubscription(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() body: CreateSubscriptionDto,
  ) {
    return this.billingService.createSubscription(tenantId, body.billingType);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('subscriptions/:tenantId')
  cancelSubscription(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.billingService.cancelSubscription(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('invoices/:tenantId')
  getInvoices(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.billingService.getInvoices(tenantId);
  }
}
