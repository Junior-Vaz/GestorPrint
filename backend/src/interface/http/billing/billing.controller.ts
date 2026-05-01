import {
  Controller, Get, Post, Delete, Param, Body, Headers, Req,
  UseGuards, ParseIntPipe, HttpCode, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { PlatformSettingsService } from '../../../shared/platform-settings.service';

@ApiTags('billing')
@ApiBearerAuth('JWT')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  // Webhook público — Asaas não envia JWT
  // Valida o header asaas-access-token contra o token configurado no SaaS Admin.
  // CRÍTICO: se o token não estiver configurado, o webhook fica fechado em prod.
  // Em dev (NODE_ENV !== 'production') aceitamos sem token pra facilitar testes.
  @Public()
  @Post('webhooks')
  @HttpCode(200)
  async webhook(
    @Body() payload: any,
    @Headers('asaas-access-token') token: string,
  ) {
    const expected = await this.platformSettings.get('asaasWebhookToken');
    const isProd = process.env.NODE_ENV === 'production';

    if (!expected) {
      if (isProd) {
        // Em produção, sem token configurado = porta aberta. Recusa.
        throw new UnauthorizedException(
          'Webhook token não configurado no SaaS Admin — webhook bloqueado em produção',
        );
      }
      // Em dev, loga warning mas aceita
      console.warn('[Asaas Webhook] Token não configurado — aceitando em modo dev');
    } else if (token !== expected) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    await this.billingService.handleWebhook(payload);
    return { received: true };
  }

  // Demais endpoints: apenas ADMIN
  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('settings', 'view')
  @Get('config')
  getConfig() {
    return this.billingService.getConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('settings', 'view')
  @Get('platform-settings')
  getPlatformSettings() {
    return this.billingService.getPlatformSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('settings', 'create')
  @Post('customers/:tenantId')
  createCustomer(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.billingService.createCustomer(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('settings', 'create')
  @Post('subscriptions/:tenantId')
  createSubscription(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() body: CreateSubscriptionDto,
  ) {
    return this.billingService.createSubscription(tenantId, body.billingType);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('settings', 'delete')
  @Delete('subscriptions/:tenantId')
  cancelSubscription(@Param('tenantId', ParseIntPipe) tenantId: number, @Req() req: any) {
    const performedBy = req?.user?.id ? `user:${req.user.id}` : 'admin';
    return this.billingService.cancelSubscription(tenantId, performedBy);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('settings', 'view')
  @Get('invoices/:tenantId')
  getInvoices(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.billingService.getInvoices(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('settings', 'view')
  @Get('subscriptions/:tenantId')
  getSubscription(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.billingService.getSubscription(tenantId);
  }
}
