import { Injectable, OnModuleInit, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async onModuleInit() {
    // Seed default tenant if none exists
    const tenantCount = await (this.prisma as any).tenant.count();
    if (tenantCount === 0) {
      await (this.prisma as any).tenant.create({
        data: {
          id: 1,
          name: 'GestorPrint',
          slug: 'gestorprint',
          plan: 'PRO',
          planStatus: 'ACTIVE',
        },
      });
      console.log('Default tenant seeded: GestorPrint (id=1)');
    }

    // Seed admin user if none exists, and ensure isSuperAdmin is set
    const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await this.prisma.user.create({
        data: {
          email: 'admin@gestorprint.com',
          password: hashedPassword,
          name: 'Administrador',
          role: 'ADMIN',
          tenantId: 1,
          isSuperAdmin: true,
        } as any,
      });
      console.log('Admin user seeded: admin@gestorprint.com / admin123');
    } else {
      // Ensure the platform admin has isSuperAdmin=true (idempotent)
      await (this.prisma as any).user.updateMany({
        where: { email: 'admin@gestorprint.com' },
        data: { isSuperAdmin: true },
      });
    }
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await (this.prisma.user as any).findFirst({ where: { email } });
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      return null;
    }

    // Check tenant suspension — super admins are always exempt
    if (!user.isSuperAdmin && user.tenantId) {
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: user.tenantId },
        select: { planStatus: true },
      });
      if (tenant && ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
        throw new ForbiddenException(
          'Sua conta está suspensa ou cancelada. Entre em contato com o suporte para reativá-la.',
        );
      }
    }

    const { password, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role, tenantId: user.tenantId, isSuperAdmin: user.isSuperAdmin ?? false };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      }
    };
  }

  async register(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
  }
}
