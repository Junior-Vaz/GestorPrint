import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Extrai o tenantId do JWT do usuário autenticado.
 * Uso: @CurrentTenant() tenantId: number
 *
 * SEM fallback: se a request não trouxe um JWT válido com tenantId, é um erro
 * de configuração (rota sem JwtAuthGuard, ou guard veio antes do decorator).
 * Antes tinha `?? 1` que mascarava o bug e jogava operações no tenant 1
 * silenciosamente — vetor real de cross-tenant data leak.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    if (typeof tenantId !== 'number') {
      throw new UnauthorizedException(
        'Tenant não identificado. Verifique se o endpoint exige autenticação (JwtAuthGuard).',
      );
    }
    return tenantId;
  },
);
