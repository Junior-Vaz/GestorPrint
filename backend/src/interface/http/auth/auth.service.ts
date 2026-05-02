import { Injectable, Logger, OnModuleInit, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Bootstrap mínimo pra app subir do zero — só o que é absolutamente
   * necessário pra acessar o SaaS Admin: Tenant 1 + um super admin.
   *
   * Catálogo operacional (ProductTypes, Products, ExpenseCategories, etc) e
   * planos da plataforma vivem em `prisma/seed.ts` — fonte canônica.
   * Rode `npm run db:seed` pra dataset completo.
   */
  async onModuleInit() {
    // 1. Tenant 1 (plataforma) — usado pelo super admin pra operar
    const tenantCount = await (this.prisma as any).tenant.count();
    if (tenantCount === 0) {
      await (this.prisma as any).tenant.create({
        data: {
          id: 1,
          name: 'GestorPrint',
          slug: 'gestorprint',
          plan: 'ENTERPRISE',
          planStatus: 'ACTIVE',
          isActive: true,
        },
      });
      this.logger.log('Default tenant seeded: GestorPrint (id=1, ENTERPRISE)');
    }

    // 2. Migração de dados ANTES de seedar — usuários legados com
    //    isSuperAdmin=true precisam virar userType=PLATFORM PRIMEIRO. Se a
    //    gente seedar antes, criaria um PLATFORM novo + tentaria migrar o
    //    legado, conflitando na unique [email, tenantId, userType].
    //
    //    Migração linha-a-linha pra lidar com conflitos: se já existe um
    //    PLATFORM com mesmo email+tenant (improvável mas possível), mantém o
    //    novo e DELETA o registro legado duplicado em vez de tentar atualizar.
    const legacy = await (this.prisma as any).user.findMany({
      where: { isSuperAdmin: true, userType: { not: 'PLATFORM' } },
      select: { id: true, email: true, tenantId: true },
    });
    let migratedCount = 0;
    let dedupedCount = 0;
    for (const u of legacy) {
      // Existe um PLATFORM com mesmo email+tenant? Se sim, esse legado é
      // duplicata acidental — apaga em vez de migrar (cleanup).
      const conflictExists = await (this.prisma as any).user.findFirst({
        where: { email: u.email, tenantId: u.tenantId, userType: 'PLATFORM', NOT: { id: u.id } },
        select: { id: true },
      });
      if (conflictExists) {
        await (this.prisma as any).user.delete({ where: { id: u.id } });
        dedupedCount++;
      } else {
        await (this.prisma as any).user.update({
          where: { id: u.id },
          data: { userType: 'PLATFORM' },
        });
        migratedCount++;
      }
    }
    if (migratedCount > 0) this.logger.log(`Migração userType: ${migratedCount} super admin(s) marcados como PLATFORM`);
    if (dedupedCount > 0)  this.logger.warn(`Dedupe: ${dedupedCount} user(s) legados removidos (conflitavam com PLATFORM existente)`);

    // 3. Sync isSuperAdmin com userType — qualquer PLATFORM que ainda tem
    //    isSuperAdmin=false é corrigido pra true (e vice-versa). Compat com
    //    código legado que ainda lê o flag.
    const synced = await (this.prisma as any).user.updateMany({
      where: { userType: 'PLATFORM', isSuperAdmin: false },
      data: { isSuperAdmin: true },
    });
    if (synced.count > 0) {
      this.logger.log(`Sync isSuperAdmin: ${synced.count} PLATFORM users marcados`);
    }
    const cleaned = await (this.prisma as any).user.updateMany({
      where: { isSuperAdmin: true, userType: { not: 'PLATFORM' } },
      data: { isSuperAdmin: false },
    });
    if (cleaned.count > 0) {
      this.logger.warn(`Limpou isSuperAdmin de ${cleaned.count} user(s) que não são PLATFORM`);
    }

    // 4. Platform admin seed — só DEPOIS da migração. Se não existe nenhum
    //    PLATFORM (fresh install), cria o admin inicial. Credenciais via env
    //    (mesmas vars que o `prisma/seed.ts` usa, pra não divergir).
    //    Em prod: SUPER_ADMIN_EMAIL/PASSWORD/NAME definidas no .env.
    //    Em dev: defaults `admin@gestorprint.com / admin123`.
    const platformAdminCount = await (this.prisma as any).user.count({
      where: { userType: 'PLATFORM' },
    });
    if (platformAdminCount === 0) {
      const seedEmail    = process.env.SUPER_ADMIN_EMAIL    ?? 'admin@gestorprint.com';
      const seedPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'admin123';
      const seedName     = process.env.SUPER_ADMIN_NAME     ?? 'Administrador';
      const hashedPassword = await bcrypt.hash(seedPassword, 10);
      await (this.prisma as any).user.create({
        data: {
          email:        seedEmail,
          password:     hashedPassword,
          name:         seedName,
          role:         'ADMIN',
          tenantId:     1,
          userType:     'PLATFORM',
          isSuperAdmin: true,
        },
      });
      // Em produção, NÃO logar a senha (mesmo se foi default). Loga só o email
      // pra o operador saber qual conta foi criada. Em dev mostra senha pra DX.
      const isProd = process.env.NODE_ENV === 'production';
      const passHint = isProd ? '(definida via SUPER_ADMIN_PASSWORD)' : `/ ${seedPassword}`;
      this.logger.warn(`Platform admin seeded: ${seedEmail} ${passHint} — TROCAR SENHA NO PRIMEIRO LOGIN`);
    }
  }

  /**
   * Valida credenciais. `expectedType` filtra por TENANT vs PLATFORM —
   * o login do ERP envia 'TENANT', o do SaaS Admin envia 'PLATFORM'.
   * Sem isso, um TENANT user logaria no SaaS Admin e vice-versa, criando
   * a confusão que tinha antes.
   *
   * Como o índice `@@unique([email, tenantId, userType])` permite mesmo email
   * em TENANT e PLATFORM, precisa filtrar por userType pra achar o user certo.
   */
  async validateUser(email: string, pass: string, expectedType: 'TENANT' | 'PLATFORM' = 'TENANT'): Promise<any> {
    const user = await (this.prisma.user as any).findFirst({
      where: { email, userType: expectedType },
    });
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      // Audit de tentativa falhada — útil pra detectar brute force.
      // tenantId fallback=1 quando não encontrou user (não dá pra saber qual
      // tenant ele estava tentando atingir; vai pro log da plataforma).
      await this.audit.logAction(
        null,
        'LOGIN_FAILED',
        'User',
        user?.id,
        { email, expectedType, reason: user ? 'invalid_password' : 'user_not_found' },
        user?.tenantId ?? 1,
      );
      return null;
    }

    // Check tenant suspension — PLATFORM users são isentos (operam o SaaS, não
    // são afetados pelo plano de tenant). TENANT users do tenant 1 idem (tenant
    // 1 é ghost; em prática nem deveriam existir, mas defesa em camadas).
    if (user.userType !== 'PLATFORM' && user.tenantId && user.tenantId !== 1) {
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
    // Payload do JWT inclui userType — JwtStrategy usa pra determinar isSuperAdmin
    // sem precisar consultar o banco. Mantemos isSuperAdmin no payload por compat
    // com código legado (vai sair em fase 2).
    const isPlatform = user.userType === 'PLATFORM';
    const payload = {
      email:        user.email,
      sub:          user.id,
      role:         user.role,
      tenantId:     user.tenantId,
      userType:     user.userType ?? 'TENANT',
      isSuperAdmin: isPlatform,
    };
    // Audit de login bem-sucedido — registra entrada de cada user.
    await this.audit.logAction(
      user.id,
      'LOGIN',
      'User',
      user.id,
      { email: user.email, role: user.role, userType: user.userType ?? 'TENANT' },
      user.tenantId ?? 1,
    );
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        tenantId:     user.tenantId,
        userType:     user.userType ?? 'TENANT',
        photoUrl:     user.photoUrl ?? null,
        isSuperAdmin: isPlatform,
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
