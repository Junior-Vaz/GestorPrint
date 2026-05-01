import { Body, Controller, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ShippingService } from './shipping.service';

/** Endpoint público — consumido pelo checkout do site da loja */
@Public()
@Controller('ecommerce/shipping')
export class ShippingController {
  constructor(private readonly svc: ShippingService) {}

  @Post('calculate')
  calculate(
    @Body() body: { destinationCep?: string; cep?: string; items: { productId: number; qty: number }[] },
    @Query('tenantId') tenantIdQ?: string,
  ) {
    const tenantId = tenantIdQ ? parseInt(tenantIdQ, 10) : 1;
    // Aceita tanto `destinationCep` quanto `cep` (compat com SPA antigo)
    const destinationCep = body.destinationCep || body.cep || '';
    return this.svc.calculate({ tenantId, destinationCep, items: body.items || [] });
  }
}
