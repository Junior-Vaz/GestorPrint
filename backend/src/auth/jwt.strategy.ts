import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => (req?.query?.token as string) || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: 'gestorprint-secret-key-2026', // In production, move to env
    });
  }

  async validate(payload: any) {
    // Super admins (isSuperAdmin=true in token) are exempt from tenant suspension checks
    if (!payload.isSuperAdmin && payload.tenantId) {
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: payload.tenantId },
        select: { planStatus: true },
      });
      if (tenant && ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
        throw new ForbiddenException(
          'Sua conta está suspensa ou cancelada. Entre em contato com o suporte.',
        );
      }
    }
    return { id: payload.sub, email: payload.email, role: payload.role, tenantId: payload.tenantId, isSuperAdmin: payload.isSuperAdmin ?? false };
  }
}
