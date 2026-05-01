import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { CanAccessGuard } from './can-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Action } from './permissions.service';

export const CAN_ACCESS_META = 'canAccess';

/**
 * Decorator que protege endpoint baseado na matriz RolePermission.
 * Substitui (ou complementa) `@Roles('ADMIN')` em endpoints sensíveis.
 *
 *   @Post(':id')
 *   @CanAccess('orders', 'edit')
 *   updateOrder(...) {}
 *
 * Comportamento:
 *  - Super admin sempre passa
 *  - Lê role do JWT (req.user.role)
 *  - Consulta RolePermission tenant×role×resource×action
 *  - 403 se o toggle está false
 *
 * IMPORTANTE: declaramos JwtAuthGuard JUNTO no mesmo `UseGuards` pra garantir
 * que ele rode ANTES do CanAccessGuard. Sem isso, quando o controller mistura
 * `@UseGuards(JwtAuthGuard)` no método com `@CanAccess(...)`, a ordem de
 * aplicação dos decorators (bottom-up) faz com que o CanAccessGuard execute
 * primeiro — e aí req.user está undefined, derrubando todo request com
 * "Não autenticado" mesmo pra super admin.
 */
export function CanAccess(resource: string, action: Action) {
  return applyDecorators(
    SetMetadata(CAN_ACCESS_META, { resource, action }),
    UseGuards(JwtAuthGuard, CanAccessGuard),
  );
}
