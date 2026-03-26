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

    // Seed baseline operational catalog for fresh installations.
    await this.seedDefaultCatalog(1);
  }

  private async seedDefaultCatalog(tenantId: number): Promise<void> {
    const typeMap: Record<string, number> = {};
    const defaultTypes = [
      { name: 'Papel / Mídia', color: '#f59e0b', hasStock: true },
      { name: 'Acabamento', color: '#6366f1', hasStock: true },
      { name: 'Tinta / Insumo', color: '#ec4899', hasStock: true },
      { name: 'Serviço', color: '#10b981', hasStock: false },
    ];

    for (const t of defaultTypes) {
      const created = await (this.prisma as any).productType.upsert({
        where: { name_tenantId: { name: t.name, tenantId } },
        update: {},
        create: { ...t, tenantId },
      });
      typeMap[t.name] = created.id;
    }

    const seedProducts = [
      { name: 'Couchê 300g', typeId: typeMap['Papel / Mídia'], unitPrice: 45.0, unit: 'm²', description: 'Papel padrão para cartões e capas' },
      { name: 'Sulfite 75g', typeId: typeMap['Papel / Mídia'], unitPrice: 12.0, unit: 'm²', description: 'Papel comum para formulários' },
      { name: 'Offset 90g', typeId: typeMap['Papel / Mídia'], unitPrice: 18.0, unit: 'm²', description: 'Papel branco para timbrados' },
      { name: 'Laminado Fosco', typeId: typeMap['Acabamento'], unitPrice: 0.15, unit: 'un', description: 'Plastificação fosca por unidade' },
      { name: 'Verniz Localizado', typeId: typeMap['Acabamento'], unitPrice: 0.25, unit: 'un', description: 'Brilho em pontos específicos' },
      { name: 'Tinta Preto CMYK', typeId: typeMap['Tinta / Insumo'], unitPrice: 120.0, unit: 'kg', description: 'Tinta preta para impressão' },
      { name: 'Vinil Adesivo Branco', typeId: typeMap['Tinta / Insumo'], unitPrice: 38.0, unit: 'm²', description: 'Vinil adesivo para recorte e impressão' },
      { name: 'Arte Final', typeId: typeMap['Serviço'], unitPrice: 80.0, unit: 'h', description: 'Criação/ajuste de arte para impressão' },
      { name: 'Impressão Digital', typeId: typeMap['Serviço'], unitPrice: 22.0, unit: 'm²', description: 'Serviço de impressão digital colorida' },
    ];

    for (const p of seedProducts) {
      const exists = await (this.prisma as any).product.findFirst({
        where: { name: p.name, typeId: p.typeId, tenantId },
      });
      if (!exists) {
        await (this.prisma as any).product.create({ data: { ...p, tenantId } });
      }
    }

    const expenseCategories = ['Sangria', 'Insumos', 'Aluguel', 'Salários', 'Energia', 'Marketing', 'Manutenção', 'Impostos', 'Frete', 'Outros'];
    for (const name of expenseCategories) {
      await (this.prisma as any).expenseCategory.upsert({
        where: { name_tenantId: { name, tenantId } },
        update: {},
        create: { name, tenantId },
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
