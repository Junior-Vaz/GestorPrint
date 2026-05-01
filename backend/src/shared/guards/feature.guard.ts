import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureKey } from '../../domain/entitlement/feature-key.enum';
import { CheckFeatureUseCase } from '../../application/entitlement/check-feature.usecase';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';

/**
 * FeatureGuard — verifica se o tenant pode usar a feature exigida pelo endpoint.
 *
 * Fluxo:
 *  1. Lê a metadata `required_feature` do decorator @RequireFeature
 *  2. Extrai tenantId do JWT (request.user, já populado pelo JwtAuthGuard)
 *  3. Delega para CheckFeatureUseCase (única fonte de verdade)
 *  4. Se não puder: CheckFeatureUseCase lança ForbiddenException automaticamente
 *
 * Super admins (isSuperAdmin=true) são isentos de verificação de feature.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly checkFeature: CheckFeatureUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<FeatureKey>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem metadata = endpoint não exige feature específica
    if (!feature) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Se o usuário ainda não foi autenticado (JwtAuthGuard não rodou antes),
    // passa o baile pro próximo guard — ele que vai barrar com 401 se for o caso.
    // Evita "Cannot read properties of undefined" quando a ordem dos guards
    // é invertida por decorators no mesmo nível.
    if (!user) return true;

    // Super admin da plataforma é isento de feature gates
    if (user.isSuperAdmin) return true;

    // Delega para o Use Case — lança ForbiddenException se bloqueado
    await this.checkFeature.execute(user.tenantId, feature);
    return true;
  }
}
