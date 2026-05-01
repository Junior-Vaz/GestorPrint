import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { resolveJwtSecret } from '../../../shared/jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => (req?.query?.token as string) || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: any) {
    // userType é a fonte canônica de "plataforma vs gráfica" desde a fase 2.
    //   PLATFORM → equipe da plataforma SaaS (login via /auth/saas-login)
    //   TENANT   → operador de gráfica (login via /auth/login)
    // Default 'TENANT' pra JWTs antigos sem o campo (compat curta — token
    // expira em 1d, depois disso todos os tokens novos têm o campo).
    const userType = payload.userType ?? 'TENANT';
    const isSuperAdmin = userType === 'PLATFORM';

    // PLATFORM users sao isentos da checagem de suspensao (operam o SaaS, nao
    // sao afetados pelo plano de tenant). Tenant 1 também isento (ghost
    // tenant que hospeda PLATFORM users — não faz sentido suspender a si mesmo).
    if (!isSuperAdmin && payload.tenantId && payload.tenantId !== 1) {
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: payload.tenantId },
        select: { planStatus: true },
      });
      if (tenant && ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
        throw new ForbiddenException(
          'Sua conta esta suspensa ou cancelada. Entre em contato com o suporte.',
        );
      }
    }
    return {
      id:           payload.sub,
      email:        payload.email,
      role:         payload.role,
      tenantId:     payload.tenantId,
      userType,
      isSuperAdmin,
    };
  }
}
