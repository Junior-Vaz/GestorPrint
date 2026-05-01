import { Body, Controller, Get, Headers, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { EcommerceOrdersService, CreateEcommerceOrderInput } from './ecommerce-orders.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CustomerAuthService } from './customer-auth.service';
import { TrackingService } from './tracking.service';
import { validateMpWebhookSignature } from './mp-webhook-validator';

/** Endpoints públicos (sem auth) — consumidos pelo checkout do site */
@Public()
@Controller('ecommerce')
export class EcommerceOrdersController {
  constructor(
    private readonly svc: EcommerceOrdersService,
    private readonly prisma: PrismaService,
    private readonly customerAuth: CustomerAuthService,
    private readonly tracking: TrackingService,
  ) {}

  @Post('orders')
  createOrder(
    @Body() body: any,
    @Headers('authorization') authHeader?: string,
    @Query('tenantId') tenantIdQ?: string,
  ) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;

    // Auth opcional: se o cliente estiver logado na loja, manda Bearer token.
    // Se válido, extrai storeCustomerId pra que o service saiba que NÃO é guest
    // (e pra associar o pedido ao customer logado, e pra validar a regra
    // "Permitir compra sem cadastro" do storeConfig).
    let storeCustomerId: number | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = this.customerAuth.verifyToken(authHeader.slice(7));
        if (payload?.tenantId === tenantId && payload?.sub) {
          storeCustomerId = Number(payload.sub);
        }
      } catch {
        // Token inválido/expirado → trata como guest (e o service decide se rejeita)
      }
    }

    const input: CreateEcommerceOrderInput = { ...body, tenantId, storeCustomerId };
    return this.svc.createOrder(input);
  }

  /** Consulta status do pedido pela URL pública (após pagamento) */
  @Get('orders/:uuid')
  getOrder(@Param('uuid') uuid: string, @Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.svc.getOrderByUuid(tenantId, uuid);
  }

  /**
   * Tracking — eventos do Melhor Envios (Postado / Em trânsito / Saiu pra
   * entrega / Entregue) com cidade/UF parseada de cada evento. SPA usa pra
   * plotar a "rota" no mapa do Brasil.
   *
   * Cacheado 5min em memória; tolerante a falhas (ME fora → retorna lista
   * vazia + flag trackingDisabled em vez de erro).
   */
  @Get('orders/:uuid/tracking')
  getTracking(@Param('uuid') uuid: string, @Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.tracking.getTracking(tenantId, uuid);
  }

  /**
   * Força sincronização do status com o Mercado Pago.
   * Usado pelo polling da SPA quando o webhook não chegou (caso comum em dev).
   */
  @Post('orders/:uuid/refresh-payment')
  refreshPayment(@Param('uuid') uuid: string, @Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.svc.refreshPaymentStatus(tenantId, uuid);
  }

  /**
   * Webhook do Mercado Pago.
   * Configurar no painel MP → URL: https://seu-dominio.com/api/ecommerce/payment-webhook
   * MP envia: { type: 'payment', data: { id: '<paymentId>' } }
   * Headers: x-signature: ts=...,v1=...   x-request-id: ...
   *
   * A assinatura é validada com HMAC-SHA256 usando o `mpWebhookSecret`.
   * Se o secret não estiver configurado, aceita o request mas loga warning (modo dev).
   */
  @Post('payment-webhook')
  async paymentWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Query('tenantId') tenantIdQ?: string,
  ) {
    const paymentId = body?.data?.id || body?.id;
    if (!paymentId) return { ok: false, reason: 'no_payment_id' };

    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    const valid = await validateMpWebhookSignature(this.prisma, tenantId, headers, String(paymentId));
    if (!valid) {
      // 401 — não confundir com 4xx do business logic; é rejeição de auth
      throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
    }

    return this.svc.handlePaymentWebhook(String(paymentId));
  }
}
