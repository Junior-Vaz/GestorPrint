import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
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
    // Seed default tenant and admin user if none exists
    const tenantCount = await this.prisma.tenant.count();
    if (tenantCount === 0) {
      // Create default tenant
      const defaultTenant = await this.prisma.tenant.create({
        data: {
          name: 'Default Tenant',
          slug: 'default-tenant',
        },
      });
      console.log('Default tenant created (ID:', defaultTenant.id, ')');

      // Create admin user for default tenant
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await this.prisma.user.create({
        data: {
          email: 'admin@gestorprint.com',
          password: hashedPassword,
          name: 'Administrador',
          role: 'ADMIN',
          tenantId: defaultTenant.id, // ← NOVO: Assign to default tenant
        },
      });
      console.log('Admin user seeded: admin@gestorprint.com / admin123 (Tenant ID:', defaultTenant.id, ')');
    }
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId, // ← NOVO: Include tenantId in JWT payload
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId, // ← NOVO: Return tenantId in response
      }
    };
  }

  async register(data: any) {
    // Get the tenant from the request or use default
    // In a real scenario, this would be from JWT or request context
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: 'default-tenant' }
    }) || await this.prisma.tenant.findFirst();

    if (!tenant) {
      throw new Error('No tenant available for registration');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        tenantId: tenant.id, // ← NOVO: Assign to tenant
      },
    });
  }
}
