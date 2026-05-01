import { Injectable, NotFoundException, OnModuleInit, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

// "2026-03-20" → "2026-03-20T00:00:00.000Z" (Prisma DateTime exige ISO completo)
function toDateTime(s?: string | null): string | null | undefined {
  if (!s) return s === null ? null : undefined;
  return s.length === 10 ? `${s}T00:00:00.000Z` : s;
}

/**
 * Fallback mínimo pra app subir do zero sem rodar `npm run db:seed`.
 * Só nome/displayName/preço — preserva edits do admin via `update: {}`.
 *
 * O catálogo COMPLETO de PlanConfig (com todas as feature flags e limites)
 * vive em `prisma/seed.ts`, fonte canônica. Usuário deve rodar o seed pra
 * ter os planos com features corretas, não confiar nesse fallback.
 */
const FALLBACK_PLANS = [
  { name: 'FREE',       displayName: 'Gratuito',   price: 0,   sortOrder: 1 },
  { name: 'BASIC',      displayName: 'Básico',     price: 49,  sortOrder: 2 },
  { name: 'PRO',        displayName: 'Pro',        price: 149, sortOrder: 3 },
  { name: 'ENTERPRISE', displayName: 'Enterprise', price: 299, sortOrder: 4 },
];

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async onModuleInit() {
    // Cria PlanConfig só se ainda não existir — `update: {}` preserva tanto
    // o seed canônico (rodado antes ou depois) quanto edits via SaaS Admin.
    for (const plan of FALLBACK_PLANS) {
      await (this.prisma as any).planConfig.upsert({
        where:  { name: plan.name },
        update: {},
        create: plan,
      });
    }
  }

  /**
   * Listagem paginada com busca server-side. Retorna shape padrão do projeto:
   *   { data, total, page, pageSize }
   *
   * Filtros:
   *   - search: substring em name, slug, ownerName, ownerEmail
   *   - status: TRIAL | ACTIVE | SUSPENDED | CANCELLED — filtra planStatus
   *   - plan: FREE | BASIC | PRO | ENTERPRISE
   */
  async findAll(opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    plan?: string;
    // scope: 'clients' (default) lista gráficas reais; 'platform' lista só o
    // ghost tenant (tenant 1, onde os PLATFORM users vivem); 'all' lista tudo.
    // Front-end tem tabs separadas pra cada um — assim o user vê o tenant da
    // plataforma sem misturar com clientes.
    scope?: 'clients' | 'platform' | 'all';
  } = {}) {
    const safePage = Math.max(1, Math.floor(opts.page || 1));
    const safeSize = Math.min(200, Math.max(10, Math.floor(opts.pageSize || 20)));
    const skip = (safePage - 1) * safeSize;

    const scope = opts.scope ?? 'clients';
    const where: any = scope === 'platform'
      ? { id: 1 }
      : scope === 'all'
        ? {}
        : { id: { not: 1 } };
    if (opts.status) where.planStatus = opts.status;
    if (opts.plan)   where.plan = opts.plan;
    if (opts.search) {
      const q = opts.search.trim();
      where.OR = [
        { name:       { contains: q, mode: 'insensitive' } },
        { slug:       { contains: q, mode: 'insensitive' } },
        { ownerName:  { contains: q, mode: 'insensitive' } },
        { ownerEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      (this.prisma as any).tenant.findMany({
        where,
        include: {
          _count: { select: { users: true, orders: true, customers: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeSize,
      }),
      (this.prisma as any).tenant.count({ where }),
    ]);

    // Enriquece cada tenant com alertas computados a partir de campos já carregados
    // (trialEndsAt, planExpiresAt) — custo zero, sem queries extras.
    const data = rows.map((t: any) => ({
      ...t,
      _alerts: this.computeListAlerts(t),
    }));

    return { data, total, page: safePage, pageSize: safeSize };
  }

  /**
   * Alertas leves pra exibição na lista (badges).
   * Mais alertas pesados (uso vs limite) ficam em getUsage() pra detail.
   */
  private computeListAlerts(t: any): { type: 'warning' | 'danger'; message: string; code: string }[] {
    const alerts: { type: 'warning' | 'danger'; message: string; code: string }[] = [];
    const now = Date.now();

    if (t.planStatus === 'TRIAL' && t.trialEndsAt) {
      const daysLeft = Math.ceil((new Date(t.trialEndsAt).getTime() - now) / 86400000);
      if (daysLeft <= 0) {
        alerts.push({ type: 'danger',  code: 'trial_expired', message: 'Trial vencido' });
      } else if (daysLeft <= 3) {
        alerts.push({ type: 'warning', code: 'trial_ending',  message: `Trial: ${daysLeft}d` });
      }
    }

    if (t.planExpiresAt) {
      const daysLeft = Math.ceil((new Date(t.planExpiresAt).getTime() - now) / 86400000);
      if (daysLeft <= 0) {
        alerts.push({ type: 'danger',  code: 'plan_expired', message: 'Plano vencido' });
      } else if (daysLeft <= 7) {
        alerts.push({ type: 'warning', code: 'plan_ending',  message: `Vence: ${daysLeft}d` });
      }
    }

    return alerts;
  }

  /**
   * Uso atual vs limites do tenant. Inclui alertas computados (trial vencendo,
   * uso próximo do limite, plano expirando) — pra exibição em badges/cards.
   */
  async getUsage(id: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id },
      select: {
        id: true, name: true,
        plan: true, planStatus: true,
        maxUsers: true, maxOrders: true, maxCustomers: true,
        trialEndsAt: true, planExpiresAt: true, isActive: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    // Pedidos do mês corrente (limite é por mês, não acumulado)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [users, ordersMonth, customers] = await Promise.all([
      (this.prisma as any).user.count({ where: { tenantId: id } }),
      (this.prisma as any).order.count({ where: { tenantId: id, createdAt: { gte: startOfMonth } } }),
      (this.prisma as any).customer.count({ where: { tenantId: id } }),
    ]);

    // Computa percentuais e alertas
    const pct = (used: number, max: number) =>
      !max ? 0 : Math.min(100, Math.round((used / max) * 100));

    const alerts: { type: 'warning' | 'danger'; message: string }[] = [];

    // Trial vencendo
    if (tenant.planStatus === 'TRIAL' && tenant.trialEndsAt) {
      const daysLeft = Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 0) {
        alerts.push({ type: 'danger',  message: 'Trial vencido' });
      } else if (daysLeft <= 3) {
        alerts.push({ type: 'warning', message: `Trial vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}` });
      }
    }

    // Plano vencendo
    if (tenant.planExpiresAt) {
      const daysLeft = Math.ceil((new Date(tenant.planExpiresAt).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 0) {
        alerts.push({ type: 'danger',  message: 'Plano vencido' });
      } else if (daysLeft <= 7) {
        alerts.push({ type: 'warning', message: `Plano vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}` });
      }
    }

    // Uso próximo do limite (>= 90%)
    const usersPct    = pct(users,       tenant.maxUsers);
    const ordersPct   = pct(ordersMonth, tenant.maxOrders);
    const customersPct = pct(customers,  tenant.maxCustomers);
    if (usersPct    >= 90) alerts.push({ type: 'warning', message: `Usuários: ${usersPct}%` });
    if (ordersPct   >= 90) alerts.push({ type: 'warning', message: `Pedidos do mês: ${ordersPct}%` });
    if (customersPct >= 90) alerts.push({ type: 'warning', message: `Clientes: ${customersPct}%` });

    return {
      plan: tenant.plan,
      planStatus: tenant.planStatus,
      trialEndsAt: tenant.trialEndsAt,
      planExpiresAt: tenant.planExpiresAt,
      usage: {
        users:     { used: users,       limit: tenant.maxUsers,     pct: usersPct },
        orders:    { used: ordersMonth, limit: tenant.maxOrders,    pct: ordersPct },
        customers: { used: customers,   limit: tenant.maxCustomers, pct: customersPct },
      },
      alerts,
    };
  }

  async findOne(id: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, orders: true, customers: true, products: true }
        }
      }
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  async create(data: {
    name: string; slug: string; plan?: string; planStatus?: string;
    trialEndsAt?: string | null; planExpiresAt?: string | null;
    maxUsers?: number; maxOrders?: number; maxCustomers?: number;
    ownerName?: string; ownerEmail?: string; ownerPhone?: string;
    cpfCnpj?: string; isActive?: boolean;
  }) {
    if (data.plan && data.maxUsers === undefined) {
      const planCfg = await (this.prisma as any).planConfig.findUnique({ where: { name: data.plan } });
      if (planCfg) {
        data.maxUsers = planCfg.maxUsers;
        data.maxOrders = planCfg.maxOrders;
        data.maxCustomers = planCfg.maxCustomers;
      }
    }

    const createTenant = () => (this.prisma as any).tenant.create({
      data: {
        ...data,
        trialEndsAt:   toDateTime(data.trialEndsAt),
        planExpiresAt: toDateTime(data.planExpiresAt),
      },
    });

    try {
      return await createTenant();
    } catch (e: any) {
      // P2002 = unique constraint violation. Distingue 3 casos:
      //   1. id colidiu → sequence dessincronizada, conserta e refaz
      //   2. slug duplicado → admin tentou nome de loja já existente
      //   3. cnpj duplicado → mesma empresa cadastrada 2x
      // Os 2 últimos viram 409 Conflict com mensagem amigável.
      if (e?.code !== 'P2002') throw e;

      const target = Array.isArray(e?.meta?.target) ? e.meta.target : [String(e?.meta?.target || '')];

      if (target.includes('id')) {
        // Sequence atrás do MAX(id) — sincroniza e tenta de novo (1x).
        await (this.prisma as any).$executeRawUnsafe(
          `SELECT setval('"Tenant_id_seq"', COALESCE((SELECT MAX(id) FROM "Tenant"), 0) + 1, false)`,
        );
        return await createTenant();
      }

      if (target.includes('slug')) {
        throw new ConflictException(
          `Já existe um tenant com o slug "${data.slug}". Escolha outro identificador único pra loja.`,
        );
      }
      if (target.includes('cnpj') || target.includes('cpfCnpj')) {
        throw new ConflictException(
          `Já existe um tenant cadastrado com este CPF/CNPJ. Verifique se o cliente já não foi criado antes.`,
        );
      }

      // Outras unique constraints — devolve mensagem genérica mas informativa.
      throw new ConflictException(
        `Conflito de dados únicos: ${target.join(', ')} já existe(m) em outro tenant.`,
      );
    }
  }

  async update(id: number, data: {
    name?: string; slug?: string; plan?: string; planStatus?: string;
    planExpiresAt?: string | null; trialEndsAt?: string | null;
    maxUsers?: number; maxOrders?: number; maxCustomers?: number;
    ownerName?: string; ownerEmail?: string; ownerPhone?: string;
    cpfCnpj?: string; isActive?: boolean;
  }) {
    if (data.plan && data.maxUsers === undefined) {
      const planCfg = await (this.prisma as any).planConfig.findUnique({ where: { name: data.plan } });
      if (planCfg) {
        data.maxUsers = planCfg.maxUsers;
        data.maxOrders = planCfg.maxOrders;
        data.maxCustomers = planCfg.maxCustomers;
      }
    }

    return (this.prisma as any).tenant.update({
      where: { id },
      data: {
        ...data,
        trialEndsAt:   toDateTime(data.trialEndsAt),
        planExpiresAt: toDateTime(data.planExpiresAt),
      },
    });
  }

  async getDashboard() {
    // Tenant 1 é ghost (hospeda PLATFORM users) — exclui de TODAS as métricas
    // de negócio (MRR, contagem, recent) pra não inflar números fake.
    // Users e customers do tenant 1 também ficam fora pelo mesmo motivo.
    const excludeGhost = { id: { not: 1 } };
    const excludeGhostTenant = { tenantId: { not: 1 } };

    const [planConfigs, byPlan, byStatus, totalUsers, totalOrders, totalCustomers, totalTenants, recentTenants] =
      await Promise.all([
        (this.prisma as any).planConfig.findMany({ select: { name: true, price: true } }),
        (this.prisma as any).tenant.groupBy({ by: ['plan'],       where: excludeGhost,       _count: { _all: true } }),
        (this.prisma as any).tenant.groupBy({ by: ['planStatus'], where: excludeGhost,       _count: { _all: true } }),
        (this.prisma as any).user.count({                         where: excludeGhostTenant }),
        (this.prisma as any).order.count({                        where: excludeGhostTenant }),
        (this.prisma as any).customer.count({                     where: excludeGhostTenant }),
        (this.prisma as any).tenant.count({                       where: excludeGhost }),
        (this.prisma as any).tenant.findMany({
          where: excludeGhost,
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, slug: true, plan: true, planStatus: true, createdAt: true },
        }),
      ]);

    const MRR_BY_PLAN: Record<string, number> = Object.fromEntries(
      planConfigs.map((p: any) => [p.name, p.price])
    );
    const mrr = byPlan.reduce(
      (sum: number, r: any) => sum + (MRR_BY_PLAN[r.plan] ?? 0) * r._count._all, 0
    );

    return { totalTenants, totalUsers, totalOrders, totalCustomers, mrr, byPlan, byStatus, recentTenants };
  }

  /**
   * Histórico de MRR mensal dos últimos N meses. Aproximação que considera os
   * tenants ainda ativos no fim de cada mês × o preço do plano atual.
   */
  async getMrrHistory(months = 12) {
    const now = new Date();
    const result: { month: string; mrr: number; activeTenants: number }[] = [];

    const planConfigs = await (this.prisma as any).planConfig.findMany({
      select: { name: true, price: true },
    });
    const priceByPlan = new Map<string, number>(planConfigs.map((p: any) => [p.name, p.price]));

    for (let i = months - 1; i >= 0; i--) {
      const monthDate    = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = monthDate.toISOString().slice(0, 7);

      const tenants = await (this.prisma as any).tenant.findMany({
        where: {
          createdAt: { lt: nextMonthDate },
          planStatus: { in: ['ACTIVE', 'TRIAL'] },
          OR: [
            { planExpiresAt: null },
            { planExpiresAt: { gt: monthDate } },
          ],
        },
        select: { plan: true },
      });

      const mrr = tenants.reduce((sum: number, t: any) => sum + (priceByPlan.get(t.plan) ?? 0), 0);
      result.push({ month: monthLabel, mrr, activeTenants: tenants.length });
    }

    return result;
  }

  async suspend(id: number) {
    return (this.prisma as any).tenant.update({
      where: { id },
      data: { planStatus: 'SUSPENDED', isActive: false }
    });
  }

  async activate(id: number) {
    return (this.prisma as any).tenant.update({
      where: { id },
      data: { planStatus: 'ACTIVE', isActive: true }
    });
  }

  // ── Feature Overrides ─────────────────────────────────────────────────────
  async listFeatureOverrides(tenantId: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const [planCfg, entitlement] = await Promise.all([
      (this.prisma as any).planConfig.findUnique({ where: { name: tenant.plan } }),
      (this.prisma as any).tenantEntitlement.findUnique({
        where: { tenantId },
        include: { overrides: true },
      }),
    ]);

    const overrideByFeature = new Map<string, any>(
      (entitlement?.overrides || []).map((o: any) => [o.feature, o]),
    );

    return {
      plan: tenant.plan,
      features: this.featureCatalog().map((f) => {
        const planAllows = planCfg?.[f.planField] === true;
        const ov = overrideByFeature.get(f.key);
        const effective = ov ? ov.granted : planAllows;
        return {
          key:        f.key,
          label:      f.label,
          group:      f.group,
          planAllows,
          override:   ov ? {
            granted:   ov.granted,
            reason:    ov.reason,
            expiresAt: ov.expiresAt,
            createdAt: ov.createdAt,
          } : null,
          effective,
        };
      }),
    };
  }

  async upsertFeatureOverride(
    tenantId: number,
    feature: string,
    granted: boolean,
    reason?: string,
    expiresAt?: string | null,
    grantedById?: number,
  ) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, maxUsers: true, maxOrders: true, maxCustomers: true },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const entitlement = await (this.prisma as any).tenantEntitlement.upsert({
      where: { tenantId },
      create: {
        tenantId,
        maxUsers: tenant.maxUsers,
        maxOrders: tenant.maxOrders,
        maxCustomers: tenant.maxCustomers,
      },
      update: {},
    });

    return (this.prisma as any).tenantFeatureOverride.upsert({
      where: { entitlementId_feature: { entitlementId: entitlement.id, feature } },
      create: {
        entitlementId: entitlement.id,
        feature,
        granted,
        reason: reason || null,
        expiresAt: toDateTime(expiresAt),
        grantedById: grantedById || null,
      },
      update: {
        granted,
        reason: reason || null,
        expiresAt: toDateTime(expiresAt),
        grantedById: grantedById || null,
      },
    });
  }

  async removeFeatureOverride(tenantId: number, feature: string) {
    const entitlement = await (this.prisma as any).tenantEntitlement.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (!entitlement) return { ok: true };

    await (this.prisma as any).tenantFeatureOverride.deleteMany({
      where: { entitlementId: entitlement.id, feature },
    });
    return { ok: true };
  }

  private featureCatalog() {
    return [
      { key: 'PDF_GENERATION',      planField: 'hasPdf',                label: 'Geração de PDF',         group: 'Operacionais' },
      { key: 'FINANCIAL_REPORTS',   planField: 'hasReports',            label: 'Relatórios & BI',        group: 'Operacionais' },
      { key: 'KANBAN_BOARD',        planField: 'hasKanban',             label: 'Fila de Produção',       group: 'Operacionais' },
      { key: 'FILE_UPLOAD',         planField: 'hasFileUpload',         label: 'Upload de arquivos',     group: 'Operacionais' },
      { key: 'PLOTTER_ESTIMATE',    planField: 'hasPlotterEstimate',    label: 'Orçamento de plotter',   group: 'Orçamento' },
      { key: 'CUTTING_ESTIMATE',    planField: 'hasCuttingEstimate',    label: 'Orçamento de recorte',   group: 'Orçamento' },
      { key: 'EMBROIDERY_ESTIMATE', planField: 'hasEmbroideryEstimate', label: 'Orçamento de estamparia', group: 'Orçamento' },
      { key: 'AUDIT_LOG',           planField: 'hasAudit',              label: 'Auditoria',              group: 'Gestão' },
      { key: 'COMMISSIONS',         planField: 'hasCommissions',        label: 'Comissões',              group: 'Gestão' },
      { key: 'API_ACCESS',          planField: 'hasApiAccess',          label: 'Acesso à API',           group: 'Gestão' },
      { key: 'RECEIVABLES',         planField: 'hasReceivables',        label: 'Contas a Receber/Pagar', group: 'Gestão' },
      { key: 'WHATSAPP_AI',         planField: 'hasWhatsapp',           label: 'WhatsApp AI',            group: 'Integrações' },
      { key: 'PIX_PAYMENTS',        planField: 'hasPix',                label: 'Pagamentos PIX',         group: 'Integrações' },
      { key: 'ECOMMERCE',           planField: 'hasEcommerce',          label: 'Loja online',            group: 'Ecommerce' },
      { key: 'MP_CARD',             planField: 'hasMpCard',             label: 'Cartão Mercado Pago',    group: 'Ecommerce' },
      { key: 'MELHOR_ENVIOS',       planField: 'hasMelhorEnvios',       label: 'Frete Melhor Envios',    group: 'Ecommerce' },
      { key: 'LOYALTY_PROGRAM',     planField: 'hasLoyalty',            label: 'Programa de Fidelidade', group: 'Engajamento' },
    ];
  }

  async listActivity(tenantId: number, page = 1, pageSize = 30) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(100, Math.max(10, Math.floor(pageSize) || 30));
    const skip = (safePage - 1) * safeSize;
    const where = { tenantId };

    const [data, total] = await Promise.all([
      (this.prisma as any).auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: safeSize,
      }),
      (this.prisma as any).auditLog.count({ where }),
    ]);

    return { data, total, page: safePage, pageSize: safeSize };
  }

  async generateImpersonationToken(tenantId: number, superAdminId: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.isActive) throw new BadRequestException('Tenant suspenso — reative antes de acessar.');

    const adminUser = await (this.prisma as any).user.findFirst({
      where: { tenantId, role: 'ADMIN' },
      orderBy: { id: 'asc' },
    });
    if (!adminUser) {
      throw new BadRequestException(
        'Tenant sem usuário ADMIN. Crie um na aba "Acesso Admin" antes de impersonar.',
      );
    }

    const payload = {
      email:           adminUser.email,
      sub:             adminUser.id,
      role:            adminUser.role,
      tenantId:        adminUser.tenantId,
      isSuperAdmin:    false,
      _impersonatedBy: superAdminId,
    };
    const token = this.jwtService.sign(payload, { expiresIn: '15m' });

    this.logger.log(`Impersonation: superAdmin=${superAdminId} → tenant=${tenantId} user=${adminUser.id}`);

    // Audit trail — fica registrado quem impersonou e quando (LGPD/SOC2 compliance)
    try {
      await (this.prisma as any).auditLog.create({
        data: {
          userId:   superAdminId,
          tenantId, // tenant do qual o super admin assumiu controle
          action:   'IMPERSONATE',
          entity:   'Tenant',
          entityId: tenantId,
          details: {
            asUserId:    adminUser.id,
            asUserEmail: adminUser.email,
            tenantName:  tenant.name,
            expiresInMinutes: 15,
          },
        },
      });
    } catch (e) {
      // Não bloqueia o impersonate se audit log falhar — só loga
      this.logger.error('Falha ao gravar audit log de impersonate', e as any);
    }

    return {
      token,
      expiresInMinutes: 15,
      tenantName: tenant.name,
      asUser: { id: adminUser.id, name: adminUser.name, email: adminUser.email },
    };
  }

  // ── Subscription / Cobrança ───────────────────────────────────────────────
  /**
   * Devolve o estado da assinatura interna (tabela Subscription) + timeline de
   * eventos do gateway. Diferente de /api/billing/invoices/* que bate direto no
   * Asaas, aqui retornamos a fonte de verdade local — mais rápida e sempre
   * disponível mesmo se o Asaas estiver fora.
   *
   * Eventos limitados aos últimos 30 (ordem: mais recente primeiro). Se o
   * tenant não tiver Subscription ainda, retornamos null + events vazio.
   */
  async getSubscription(tenantId: number) {
    const subscription = await (this.prisma as any).subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription) return { subscription: null, events: [] };

    const events = await (this.prisma as any).subscriptionEvent.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { subscription, events };
  }

  /**
   * Cria OU atualiza o admin principal do tenant.
   *
   * Decisão de design: a aba "Acesso Admin" no SaaS Admin gerencia O admin
   * principal (mais antigo) do tenant — não cria múltiplos. Por isso buscamos
   * pelo PAPEL (`role: 'ADMIN'`), não pelo email. Sem isso, mudar o email do
   * admin criava duplicata: antiga ficava no banco + nova era criada porque
   * o `findFirst({ email })` não encontrava ninguém com o novo endereço.
   *
   * Filtros importantes:
   *  - `userType: 'TENANT'` → não toca em PLATFORM users (admin@gestorprint.com
   *    no tenant 1 é PLATFORM, não deve ser editado por aqui)
   *  - `orderBy: id asc` → pega o admin "original" do tenant; outros admins
   *    criados depois pelo próprio tenant não são afetados
   */
  async createAdminUser(tenantId: number, dto: { name: string; email: string; password: string }) {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Busca pelo admin principal do tenant (mais antigo). Se houver, atualiza
    // — incluindo email. Senão, cria do zero.
    const existing = await (this.prisma as any).user.findFirst({
      where: { tenantId, role: 'ADMIN', userType: 'TENANT' },
      orderBy: { id: 'asc' },
    });

    let user: any;
    try {
      if (existing) {
        user = await (this.prisma as any).user.update({
          where: { id: existing.id },
          data: { name: dto.name, email: dto.email, password: hashedPassword, role: 'ADMIN' },
        });
      } else {
        user = await (this.prisma as any).user.create({
          data: {
            name: dto.name,
            email: dto.email,
            password: hashedPassword,
            role: 'ADMIN',
            tenantId,
            userType: 'TENANT',
          },
        });
      }
    } catch (err: any) {
      // P2002 = violação de unique [email, tenantId, userType] — o email novo
      // já é usado por outro user do mesmo tenant (provavelmente um SALES/PRODUCTION).
      if (err?.code === 'P2002') {
        throw new BadRequestException(
          'Já existe outro usuário deste tenant com esse email. Escolha um email diferente ou edite o usuário existente diretamente no ERP.',
        );
      }
      throw err;
    }

    const { password: _, ...result } = user;
    return result;
  }
}
