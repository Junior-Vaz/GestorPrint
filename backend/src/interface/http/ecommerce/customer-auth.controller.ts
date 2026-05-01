import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAreaService } from './customer-area.service';
import { CustomerAuthGuard, CurrentCustomer } from './customer-auth.guard';
import { SyncWishlistDto } from './dto/sync-wishlist.dto';

/**
 * Auth + área do cliente final do ecommerce.
 * `@Public()` em todo o controller libera do JwtAuthGuard global (que valida token de staff);
 * o `CustomerAuthGuard` é aplicado por método nas rotas que precisam.
 */
@Public()
@Controller('ecommerce')
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly area: CustomerAreaService,
  ) {}

  // ── Auth (públicos, com rate-limit estrito por IP) ─────────────────────────
  // ttl em ms, limit é o número máximo de chamadas nesse período.
  // Limites pensados pra: usuários reais não atingem; tentativas automatizadas
  // (brute force, abuse) batem na parede rapidamente.

  @Throttle({ short: { ttl: 60_000,    limit: 5  },  // 5 cadastros/min
              long:  { ttl: 3600_000,  limit: 20 } })// 20/hora
  @Post('auth/register')
  register(@Body() body: any, @Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.auth.register({ ...body, tenantId });
  }

  @Throttle({ short: { ttl: 60_000,    limit: 10 },  // 10 logins/min
              long:  { ttl: 3600_000,  limit: 60 } })
  @Post('auth/login')
  login(@Body() body: any, @Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.auth.login({ ...body, tenantId });
  }

  @Throttle({ short: { ttl: 60_000,    limit: 3  },  // 3 forgot/min — anti-spam de email
              long:  { ttl: 3600_000,  limit: 10 } })
  @Post('auth/forgot-password')
  forgotPassword(@Body() body: { email: string; storeUrl?: string }, @Query('tenantId') tenantIdQ?: string) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    return this.auth.forgotPassword({ ...body, tenantId });
  }

  @Throttle({ short: { ttl: 60_000,    limit: 5  },  // 5 reset/min — proteção contra força bruta no token
              long:  { ttl: 3600_000,  limit: 20 } })
  @Post('auth/reset-password')
  resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.auth.resetPassword(body);
  }

  /** Verifica email pelo token enviado no link */
  @Throttle({ short: { ttl: 60_000,    limit: 10 },
              long:  { ttl: 3600_000,  limit: 30 } })
  @Post('auth/verify-email')
  verifyEmail(@Body() body: { token: string }) {
    return this.auth.verifyEmail(body.token);
  }

  /** Reenvia o email de verificação (cliente logado) */
  @Throttle({ short: { ttl: 60_000,    limit: 2  },  // 2 reenvios/min — não permite spam
              long:  { ttl: 3600_000,  limit: 5  } })
  @UseGuards(CustomerAuthGuard)
  @Post('customer/resend-verification')
  resendVerification(@CurrentCustomer('sub') customerId: number, @Body() body: { storeUrl?: string }) {
    return this.auth.resendVerification(customerId, body?.storeUrl);
  }

  // ── Perfil ─────────────────────────────────────────────────────────────────
  @UseGuards(CustomerAuthGuard)
  @Get('customer/me')
  me(@CurrentCustomer('sub') customerId: number) {
    return this.auth.getProfile(customerId);
  }

  @UseGuards(CustomerAuthGuard)
  @Patch('customer/me')
  updateMe(@CurrentCustomer('sub') customerId: number, @Body() body: any) {
    return this.auth.updateProfile(customerId, body);
  }

  @UseGuards(CustomerAuthGuard)
  @Post('customer/change-password')
  changePassword(@CurrentCustomer('sub') customerId: number, @Body() body: { current: string; next: string }) {
    return this.auth.changePassword(customerId, body.current, body.next);
  }

  // ── Endereços ──────────────────────────────────────────────────────────────
  @UseGuards(CustomerAuthGuard)
  @Get('customer/addresses')
  listAddresses(@CurrentCustomer('sub') customerId: number) {
    return this.area.listAddresses(customerId);
  }

  @UseGuards(CustomerAuthGuard)
  @Post('customer/addresses')
  createAddress(@CurrentCustomer() c: any, @Body() body: any) {
    return this.area.createAddress(c.sub, c.tenantId, body);
  }

  @UseGuards(CustomerAuthGuard)
  @Put('customer/addresses/:id')
  updateAddress(@CurrentCustomer('sub') customerId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.area.updateAddress(customerId, id, body);
  }

  @UseGuards(CustomerAuthGuard)
  @Delete('customer/addresses/:id')
  deleteAddress(@CurrentCustomer('sub') customerId: number, @Param('id', ParseIntPipe) id: number) {
    return this.area.deleteAddress(customerId, id);
  }

  // ── Pedidos ────────────────────────────────────────────────────────────────
  @UseGuards(CustomerAuthGuard)
  @Get('customer/orders')
  listOrders(
    @CurrentCustomer() c: any,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const page     = pageQ     ? parseInt(pageQ, 10)     : 1;
    const pageSize = pageSizeQ ? parseInt(pageSizeQ, 10) : 10;
    return this.area.listOrders(c.sub, c.tenantId, page, pageSize);
  }

  @UseGuards(CustomerAuthGuard)
  @Get('customer/orders/:uuid')
  getOrder(@CurrentCustomer() c: any, @Param('uuid') uuid: string) {
    return this.area.getOrder(c.sub, c.tenantId, uuid);
  }

  // ── Wishlist ──────────────────────────────────────────────────────────────
  @UseGuards(CustomerAuthGuard)
  @Get('customer/wishlist')
  listWishlist(@CurrentCustomer() c: any) {
    return this.area.listWishlist(c.sub, c.tenantId);
  }

  // ⚠ ORDEM DAS ROTAS IMPORTA: rotas estáticas (/sync) DEVEM vir antes das
  // dinâmicas (/:productId). Caso contrário NestJS casa "sync" com :productId
  // e o ParseIntPipe falha com "numeric string is expected".
  @UseGuards(CustomerAuthGuard)
  @Post('customer/wishlist/sync')
  syncWishlist(@CurrentCustomer() c: any, @Body() body: SyncWishlistDto) {
    return this.area.syncWishlist(c.sub, c.tenantId, body.productIds || []);
  }

  @UseGuards(CustomerAuthGuard)
  @Post('customer/wishlist/:productId')
  addToWishlist(@CurrentCustomer() c: any, @Param('productId', ParseIntPipe) productId: number) {
    return this.area.addToWishlist(c.sub, productId, c.tenantId);
  }

  @UseGuards(CustomerAuthGuard)
  @Delete('customer/wishlist/:productId')
  removeFromWishlist(@CurrentCustomer() c: any, @Param('productId', ParseIntPipe) productId: number) {
    return this.area.removeFromWishlist(c.sub, productId);
  }
}
