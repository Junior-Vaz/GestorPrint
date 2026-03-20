import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extrai o tenantId do JWT do usuário autenticado.
 * Uso: @CurrentTenant() tenantId: number
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId ?? 1;
  },
);
