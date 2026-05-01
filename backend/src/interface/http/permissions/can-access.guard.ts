import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAN_ACCESS_META } from './can-access.decorator';
import { PermissionsService, Action } from './permissions.service';

@Injectable()
export class CanAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{ resource: string; action: Action }>(
      CAN_ACCESS_META,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!meta) return true;   // sem decorator → libera (não é endpoint protegido)

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Não autenticado');

    // Super admin (PLATFORM user) bypassa toda checagem — usado pra suporte
    // / operação interna. Fonte canônica é `userType === 'PLATFORM'`,
    // refletido em isSuperAdmin pelo JwtStrategy.
    if (user.isSuperAdmin) return true;

    const ok = await this.permissions.check(user.tenantId, user.role, meta.resource, meta.action);
    if (!ok) {
      throw new ForbiddenException(
        `Sem permissão pra ${meta.action} em ${meta.resource}. Fale com o administrador da conta.`,
      );
    }
    return true;
  }
}
