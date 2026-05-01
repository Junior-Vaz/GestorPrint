import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Guard que só deixa passar PLATFORM users (equipe da plataforma SaaS).
 * Usado em endpoints do SaaS Admin Panel que devem ser inacessíveis pra
 * operadores de gráfica, mesmo que tenham JWT válido.
 *
 * Requer que JwtAuthGuard tenha rodado antes (req.user populado).
 */
@Injectable()
export class PlatformOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Não autenticado');
    }
    // Aceita qualquer um dos dois — userType (canônico) OU isSuperAdmin (legado).
    if (user.userType === 'PLATFORM' || user.isSuperAdmin) {
      return true;
    }
    throw new ForbiddenException('Acesso restrito à equipe da plataforma.');
  }
}
