/**
 * Seed canônico do GestorPrint — fonte única de verdade pra dados iniciais.
 *
 * Estrutura:
 *  ┌─ PLATAFORMA  (PlanConfig × 4 com hasLoyalty/hasEcommerce/etc)
 *  ├─ TENANT 1    (ghost tenant — hospeda PLATFORM users; não é gráfica real)
 *  ├─ PLATFORM ADMIN (user com userType='PLATFORM' — opera o SaaS Admin Panel)
 *  └─ TENANT 1 CATÁLOGO  (Settings + loyaltyConfig, AiConfig, ProductTypes,
 *                         Products, ExpenseCategories, Suppliers, Customers)
 *
 * Modelo de usuário:
 *   - userType='PLATFORM' → equipe da plataforma (login via /auth/saas-login)
 *   - userType='TENANT'   → operadores de gráfica (login via /auth/login)
 *   - isSuperAdmin: deprecated, sincronizado com userType pra compat
 *
 * Idempotente: rodar várias vezes não duplica nada nem sobrescreve edições
 * do usuário (`update: {}` em todos os upserts de catálogo).
 *
 * Também roda automaticamente em todo boot via `auth.service.onModuleInit`,
 * mas só na parte de PLATFORM admin + tenant 1. Pra catálogo completo (planos,
 * products, etc), continua sendo manual:
 *   npm run db:seed                     # via package.json
 *   npx prisma db seed                  # via Prisma CLI
 *
 * Variáveis de ambiente opcionais (alinhadas com onModuleInit):
 *   SUPER_ADMIN_EMAIL    (default: admin@gestorprint.com)
 *   SUPER_ADMIN_PASSWORD (default: admin123 — TROCAR NO 1º LOGIN)
 *   SUPER_ADMIN_NAME     (default: Super Admin)
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config({ path: '../.env' });
dotenv.config(); // fallback p/ rodar de dentro do backend/

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = 1;
const SUPER_ADMIN_EMAIL    = process.env.SUPER_ADMIN_EMAIL    ?? 'admin@gestorprint.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'admin123';
const SUPER_ADMIN_NAME     = process.env.SUPER_ADMIN_NAME     ?? 'Super Admin';
const BCRYPT_ROUNDS = 10;

// ─────────────────────────────────────────────────────────────────────────────
//  CATÁLOGOS DE DADOS
// ─────────────────────────────────────────────────────────────────────────────

/** Planos da plataforma. `update: pc` em upsert sobrescreve preços/limites
 * a cada `db seed` — política intencional pra manter PlanConfig sincronizado
 * com a versão do código. Edits manuais via SaaS Admin sobrevivem porque o
 * runtime `tenants.service.onModuleInit` usa `update: {}`. */
const PLAN_CONFIGS = [
  {
    name: 'FREE', displayName: 'Free', description: 'Pra avaliar a plataforma — sem cartão',
    sortOrder: 1, price: 0,
    maxUsers: 2, maxOrders: 50, maxCustomers: 100,
    hasPdf: false, hasReports: false, hasKanban: false, hasFileUpload: false,
    hasWhatsapp: false, hasPix: false, hasAudit: false, hasCommissions: false, hasApiAccess: false,
    hasReceivables: false,
    hasPlotterEstimate: false, hasCuttingEstimate: false, hasEmbroideryEstimate: false,
    hasEcommerce: false, hasMpCard: false, hasMelhorEnvios: false,
    hasLoyalty: false,
  },
  {
    name: 'BASIC', displayName: 'Basic', description: 'Operação enxuta — PDF, contas a receber, plotter, fidelidade',
    sortOrder: 2, price: 49,
    maxUsers: 5, maxOrders: 200, maxCustomers: 500,
    hasPdf: true, hasReports: false, hasKanban: false, hasFileUpload: false,
    hasWhatsapp: false, hasPix: false, hasAudit: false, hasCommissions: false, hasApiAccess: false,
    hasReceivables: true,
    hasPlotterEstimate: true, hasCuttingEstimate: false, hasEmbroideryEstimate: false,
    hasEcommerce: false, hasMpCard: false, hasMelhorEnvios: false,
    hasLoyalty: true,
  },
  {
    name: 'PRO', displayName: 'Pro', description: 'Tudo que a maioria das gráficas precisa pra crescer',
    sortOrder: 3, price: 149,
    maxUsers: 15, maxOrders: 1000, maxCustomers: 5000,
    hasPdf: true, hasReports: true, hasKanban: true, hasFileUpload: true,
    hasWhatsapp: true, hasPix: true, hasAudit: false, hasCommissions: true, hasApiAccess: false,
    hasReceivables: true,
    hasPlotterEstimate: true, hasCuttingEstimate: true, hasEmbroideryEstimate: true,
    hasEcommerce: true, hasMpCard: true, hasMelhorEnvios: true,
    hasLoyalty: true,
  },
  {
    name: 'ENTERPRISE', displayName: 'Enterprise', description: 'Multi-loja, auditoria, API e tudo o mais',
    sortOrder: 4, price: 299,
    maxUsers: 99999, maxOrders: 99999, maxCustomers: 99999,
    hasPdf: true, hasReports: true, hasKanban: true, hasFileUpload: true,
    hasWhatsapp: true, hasPix: true, hasAudit: true, hasCommissions: true, hasApiAccess: true,
    hasReceivables: true,
    hasPlotterEstimate: true, hasCuttingEstimate: true, hasEmbroideryEstimate: true,
    hasEcommerce: true, hasMpCard: true, hasMelhorEnvios: true,
    hasLoyalty: true,
  },
];

const PRODUCT_TYPES = [
  { name: 'Papel / Mídia',  color: '#f59e0b', hasStock: true  },
  { name: 'Acabamento',     color: '#6366f1', hasStock: true  },
  { name: 'Tinta / Insumo', color: '#ec4899', hasStock: true  },
  { name: 'Serviço',        color: '#10b981', hasStock: false },
];

/** Produtos default por tipo. Cobre os principais insumos e serviços de
 * uma gráfica média — são exemplos, mas com preços plausíveis. */
const PRODUCTS_BY_TYPE: Record<string, Array<{
  name: string; unitPrice: number; unit: string; description: string;
}>> = {
  'Papel / Mídia': [
    { name: 'Couchê 300g',             unitPrice: 45.0, unit: 'm²', description: 'Papel padrão para cartões e capas' },
    { name: 'Couchê 150g',             unitPrice: 30.0, unit: 'm²', description: 'Papel para panfletos e folders' },
    { name: 'Sulfite 75g',             unitPrice: 12.0, unit: 'm²', description: 'Papel comum para formulários' },
    { name: 'Offset 90g',              unitPrice: 18.0, unit: 'm²', description: 'Papel branco para timbrados' },
    { name: 'Adesivo Vinil Branco',    unitPrice: 38.0, unit: 'm²', description: 'Adesivo para impressão e recorte' },
    { name: 'Lona 440g',               unitPrice: 32.0, unit: 'm²', description: 'Lona para banners e fachadas' },
  ],
  'Acabamento': [
    { name: 'Laminado Fosco',     unitPrice: 0.15, unit: 'un', description: 'Plastificação fosca por unidade' },
    { name: 'Laminado Brilho',    unitPrice: 0.15, unit: 'un', description: 'Plastificação brilho por unidade' },
    { name: 'Verniz Localizado',  unitPrice: 0.25, unit: 'un', description: 'Brilho em pontos específicos' },
    { name: 'Dobra',              unitPrice: 0.05, unit: 'un', description: 'Vinco e dobra simples' },
    { name: 'Corte Especial',     unitPrice: 0.40, unit: 'un', description: 'Faca de corte personalizada' },
    { name: 'Wire-o',             unitPrice: 4.50, unit: 'un', description: 'Espiral metálico para cadernos' },
  ],
  'Tinta / Insumo': [
    { name: 'Tinta Preto CMYK',  unitPrice: 120.0, unit: 'kg', description: 'Tinta preta para offset/plotter' },
    { name: 'Tinta Ciano CMYK',  unitPrice: 125.0, unit: 'kg', description: 'Tinta ciano para impressão colorida' },
    { name: 'Tinta Magenta CMYK',unitPrice: 125.0, unit: 'kg', description: 'Tinta magenta para impressão colorida' },
    { name: 'Tinta Amarelo CMYK',unitPrice: 125.0, unit: 'kg', description: 'Tinta amarela para impressão colorida' },
  ],
  'Serviço': [
    { name: 'Arte Final',         unitPrice: 80.0,  unit: 'h',  description: 'Criação/ajuste de arte para impressão' },
    { name: 'Impressão Digital',  unitPrice: 22.0,  unit: 'm²', description: 'Impressão digital colorida' },
    { name: 'Recorte Eletrônico', unitPrice: 15.0,  unit: 'm²', description: 'Recorte para adesivos e vinil' },
    { name: 'Instalação',         unitPrice: 120.0, unit: 'h',  description: 'Instalação externa (banner, fachada)' },
  ],
};

const EXPENSE_CATEGORIES = [
  'Sangria', 'Insumos', 'Aluguel', 'Salários', 'Energia',
  'Marketing', 'Manutenção', 'Impostos', 'Frete', 'Outros',
];

const SUPPLIERS = [
  { name: 'Distribuidora Gráfica SP', email: 'vendas@distribuidoragrafica.com', phone: '(11) 3333-1111', category: 'Papel e Mídia' },
  { name: 'Tintas Brasil',            email: 'comercial@tintasbrasil.com',     phone: '(11) 3333-2222', category: 'Tintas e Insumos' },
  { name: 'Acabamentos Prime',        email: 'atendimento@acabamentosprime.com', phone: '(11) 3333-3333', category: 'Acabamento' },
];

/** Cliente "Balcão" é especial — usado no PDV pra venda sem cadastro. */
const CUSTOMERS = [
  { name: 'Cliente Balcão', email: 'balcao@gestorprint.com', phone: '00000-0000' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  EXECUÇÃO
// ─────────────────────────────────────────────────────────────────────────────

async function seedPlatformPlans() {
  console.log('► Plataforma: PlanConfigs');
  for (const pc of PLAN_CONFIGS) {
    await (prisma as any).planConfig.upsert({
      where:  { name: pc.name },
      update: pc,
      create: pc,
    });
  }
  console.log(`  ✓ ${PLAN_CONFIGS.length} planos sincronizados`);
}

async function seedDefaultTenant() {
  console.log('► Plataforma: Tenant 1 (conta própria)');
  await (prisma as any).tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {}, // preserva edits feitos via SaaS Admin
    create: {
      id:         DEFAULT_TENANT_ID,
      name:       'GestorPrint',
      slug:       'gestorprint',
      plan:       'ENTERPRISE',
      planStatus: 'ACTIVE',
      isActive:   true,
    },
  });
  console.log(`  ✓ Tenant ${DEFAULT_TENANT_ID} pronto (ENTERPRISE/ACTIVE)`);
}

async function seedSuperAdmin() {
  console.log('► Plataforma: Super admin (userType=PLATFORM)');

  // Busca pelo email + userType=PLATFORM. Email igual em userType TENANT é
  // permitido pelo schema (unique compound), então o filtro precisa ser explícito.
  const existing = await (prisma as any).user.findFirst({
    where: { email: SUPER_ADMIN_EMAIL, userType: 'PLATFORM' },
  });
  if (!existing) {
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, BCRYPT_ROUNDS);
    await (prisma as any).user.create({
      data: {
        name:         SUPER_ADMIN_NAME,
        email:        SUPER_ADMIN_EMAIL,
        password:     hashedPassword,
        role:         'ADMIN',
        tenantId:     DEFAULT_TENANT_ID,
        userType:     'PLATFORM',     // ← marcador canônico
        isSuperAdmin: true,           // legado, sincronizado com userType
      } as any,
    });
    console.log(`  ✓ Criado: ${SUPER_ADMIN_EMAIL}`);
    console.log('    ⚠ Troque a senha no primeiro login.');
  } else {
    // Garante sincronia mesmo em users já existentes (idempotente)
    await (prisma as any).user.update({
      where: { id: existing.id },
      data:  { userType: 'PLATFORM', isSuperAdmin: true },
    });
    console.log(`  ✓ ${SUPER_ADMIN_EMAIL} já existe (PLATFORM garantido)`);
  }

  // Limpa isSuperAdmin de quem NÃO é PLATFORM (defesa contra dados sujos —
  // antes promovíamos todo ADMIN do tenant 1, mas agora isSuperAdmin é
  // estritamente derivado de userType=PLATFORM).
  const cleaned = await (prisma as any).user.updateMany({
    where: { isSuperAdmin: true, userType: { not: 'PLATFORM' } },
    data:  { isSuperAdmin: false },
  });
  if (cleaned.count > 0) {
    console.log(`  ⚠ ${cleaned.count} usuário(s) com isSuperAdmin órfão foram limpos`);
  }
}

async function seedTenantSettings(tenantId: number) {
  console.log(`► Tenant ${tenantId}: Settings (negócio + IA)`);
  await (prisma as any).settings.upsert({
    where:  { tenantId },
    update: {}, // preserva edits feitos pelo operador
    create: {
      tenantId,
      companyName:        'Minha Gráfica',
      paymentMethods:     ['PIX', 'Cartão', 'Boleto', 'Dinheiro'],
      businessHours:      'Segunda a sexta, 9h às 18h',
      defaultDeliveryDays: 5,
      // loyaltyConfig: programa nasce DESABILITADO (admin liga em ERP →
      // Fidelidade quando estiver pronto pra usar). Defaults razoáveis pra
      // que o operador só precise apertar o toggle.
      loyaltyConfig: {
        enabled:              false,
        pointsPerReal:        1,
        realsPerPoint:        0.05,
        pointsExpiryMonths:   12,
        minRedeemPoints:      100,
        cashbackPercent:      0,
        cashbackExpiryMonths: 6,
        tiers: [
          { name: 'BRONZE',   minSpend: 0,     discount: 0, pointsMultiplier: 1   },
          { name: 'SILVER',   minSpend: 1000,  discount: 2, pointsMultiplier: 1.5 },
          { name: 'GOLD',     minSpend: 5000,  discount: 5, pointsMultiplier: 2   },
          { name: 'PLATINUM', minSpend: 15000, discount: 8, pointsMultiplier: 3   },
        ],
        birthdayCoupon:        { enabled: true, discountPercent: 10, validityDays: 30 },
        referralBonusPoints:   200,
        referralBonusCashback: 0,
      },
    },
  });

  await (prisma as any).aiConfig.upsert({
    where:  { tenantId },
    update: {},
    create: {
      tenantId,
      enabled:           false,
      aiProvider:        'google',
      geminiModel:       'gemini-2.0-flash',
      maxTokens:         1000,
      evolutionUrl:      'https://api.cslsoftwares.com.br',
      evolutionInstance: 'gestorprint',
      webhookEvents:     ['MESSAGES_UPSERT'],
    },
  });
  console.log('  ✓ Settings + AiConfig defaults criados (preserva edits)');
}

async function seedProductTypes(tenantId: number): Promise<Record<string, number>> {
  console.log(`► Tenant ${tenantId}: ProductTypes`);
  const map: Record<string, number> = {};
  for (const t of PRODUCT_TYPES) {
    const created = await (prisma as any).productType.upsert({
      where:  { name_tenantId: { name: t.name, tenantId } },
      update: {},
      create: { ...t, tenantId },
    });
    map[t.name] = created.id;
  }
  console.log(`  ✓ ${PRODUCT_TYPES.length} tipos prontos`);
  return map;
}

async function seedProducts(tenantId: number, typeMap: Record<string, number>) {
  console.log(`► Tenant ${tenantId}: Products`);
  let total = 0;
  for (const [typeName, items] of Object.entries(PRODUCTS_BY_TYPE)) {
    const typeId = typeMap[typeName];
    if (!typeId) continue;
    for (const p of items) {
      const exists = await prisma.product.findFirst({
        where: { name: p.name, typeId, tenantId } as any,
      });
      if (!exists) {
        await prisma.product.create({ data: { ...p, typeId, tenantId } as any });
        total++;
      }
    }
  }
  console.log(`  ✓ ${total} produtos criados (preserva os já existentes)`);
}

async function seedExpenseCategories(tenantId: number) {
  console.log(`► Tenant ${tenantId}: ExpenseCategories`);
  for (const name of EXPENSE_CATEGORIES) {
    await (prisma as any).expenseCategory.upsert({
      where:  { name_tenantId: { name, tenantId } },
      update: {},
      create: { name, tenantId },
    });
  }
  console.log(`  ✓ ${EXPENSE_CATEGORIES.length} categorias prontas`);
}

async function seedSuppliers(tenantId: number) {
  console.log(`► Tenant ${tenantId}: Suppliers`);
  let created = 0;
  for (const s of SUPPLIERS) {
    const exists = await (prisma as any).supplier.findFirst({
      where: { name: s.name, tenantId },
    });
    if (!exists) {
      await (prisma as any).supplier.create({ data: { ...s, tenantId } });
      created++;
    }
  }
  console.log(`  ✓ ${created} fornecedor(es) criado(s) (${SUPPLIERS.length - created} já existia(m))`);
}

async function seedCustomers(tenantId: number) {
  console.log(`► Tenant ${tenantId}: Customers iniciais`);
  for (const c of CUSTOMERS) {
    await (prisma as any).customer.upsert({
      where:  { email_tenantId: { email: c.email, tenantId } },
      update: {},
      create: { ...c, tenantId },
    });
  }
  console.log(`  ✓ ${CUSTOMERS.length} cliente(s) inicial(is) garantido(s)`);
}

async function main() {
  const startedAt = Date.now();
  console.log('═══════════════════════════════════════════════════════');
  console.log('  GestorPrint — Seed canônico');
  console.log('═══════════════════════════════════════════════════════');

  // ─── PLATAFORMA ──────────────────────────────────────────────────
  await seedPlatformPlans();
  await seedDefaultTenant();
  await seedSuperAdmin();

  // ─── TENANT 1 (conta própria) ────────────────────────────────────
  await seedTenantSettings(DEFAULT_TENANT_ID);
  const typeMap = await seedProductTypes(DEFAULT_TENANT_ID);
  await seedProducts(DEFAULT_TENANT_ID, typeMap);
  await seedExpenseCategories(DEFAULT_TENANT_ID);
  await seedSuppliers(DEFAULT_TENANT_ID);
  await seedCustomers(DEFAULT_TENANT_ID);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ Seed concluído em ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
