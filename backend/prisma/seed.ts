import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const DEFAULT_TENANT_ID = 1;

async function main() {
  const prisma = new PrismaClient();

  console.log('Seed started...');

  // 0a. Seed PlanConfig tiers
  const planConfigs = [
    {
      name: 'FREE', displayName: 'Free', sortOrder: 1, price: 0,
      maxUsers: 2, maxOrders: 50, maxCustomers: 100,
      hasPdf: false, hasReports: false, hasKanban: false, hasFileUpload: false,
      hasWhatsapp: false, hasPix: false, hasAudit: false, hasCommissions: false, hasApiAccess: false,
      hasPlotterEstimate: false, hasCuttingEstimate: false, hasEmbroideryEstimate: false,
    },
    {
      name: 'BASIC', displayName: 'Basic', sortOrder: 2, price: 49,
      maxUsers: 5, maxOrders: 200, maxCustomers: 500,
      hasPdf: true, hasReports: false, hasKanban: false, hasFileUpload: false,
      hasWhatsapp: false, hasPix: false, hasAudit: false, hasCommissions: false, hasApiAccess: false,
      hasPlotterEstimate: true, hasCuttingEstimate: false, hasEmbroideryEstimate: false,
    },
    {
      name: 'PRO', displayName: 'Pro', sortOrder: 3, price: 149,
      maxUsers: 15, maxOrders: 1000, maxCustomers: 5000,
      hasPdf: true, hasReports: true, hasKanban: true, hasFileUpload: true,
      hasWhatsapp: true, hasPix: true, hasAudit: false, hasCommissions: true, hasApiAccess: false,
      hasPlotterEstimate: true, hasCuttingEstimate: true, hasEmbroideryEstimate: true,
    },
    {
      name: 'ENTERPRISE', displayName: 'Enterprise', sortOrder: 4, price: 299,
      maxUsers: 99999, maxOrders: 99999, maxCustomers: 99999,
      hasPdf: true, hasReports: true, hasKanban: true, hasFileUpload: true,
      hasWhatsapp: true, hasPix: true, hasAudit: true, hasCommissions: true, hasApiAccess: true,
      hasPlotterEstimate: true, hasCuttingEstimate: true, hasEmbroideryEstimate: true,
    },
  ];
  for (const pc of planConfigs) {
    await (prisma as any).planConfig.upsert({
      where: { name: pc.name },
      update: pc,
      create: pc,
    });
  }

  // 0b. Ensure default Tenant exists
  await (prisma as any).tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      name: 'GestorPrint',
      slug: 'gestorprint',
      plan: 'PRO',
      planStatus: 'ACTIVE',
    },
  });

  // 1. Seed ProductTypes
  const typeMap: Record<string, number> = {};
  const defaultTypes = [
    { name: 'Papel / Mídia', color: '#f59e0b', hasStock: true },
    { name: 'Acabamento', color: '#6366f1', hasStock: true },
    { name: 'Tinta / Insumo', color: '#ec4899', hasStock: true },
    { name: 'Serviço', color: '#10b981', hasStock: false },
  ];

  for (const t of defaultTypes) {
    const created = await (prisma as any).productType.upsert({
      where: { name_tenantId: { name: t.name, tenantId: DEFAULT_TENANT_ID } },
      update: {},
      create: { ...t, tenantId: DEFAULT_TENANT_ID },
    });
    typeMap[t.name] = created.id;
  }

  // 2. Seed Products - Papers
  const papers = [
    { name: 'Couchê 300g', typeId: typeMap['Papel / Mídia'], unitPrice: 45.0, unit: 'm²', description: 'Papel padrão para cartões e capas' },
    { name: 'Sulfite 75g', typeId: typeMap['Papel / Mídia'], unitPrice: 12.0, unit: 'm²', description: 'Papel comum para formulários' },
    { name: 'Offset 90g', typeId: typeMap['Papel / Mídia'], unitPrice: 18.0, unit: 'm²', description: 'Papel branco para timbrados' },
    { name: 'Couchê 150g', typeId: typeMap['Papel / Mídia'], unitPrice: 30.0, unit: 'm²', description: 'Papel para panfletos e folders' },
  ];

  for (const p of papers) {
    const exists = await prisma.product.findFirst({ where: { name: p.name, typeId: p.typeId, tenantId: DEFAULT_TENANT_ID } as any });
    if (!exists) await prisma.product.create({ data: { ...p, tenantId: DEFAULT_TENANT_ID } as any });
  }

  // 3. Seed Products - Finishes
  const finishes = [
    { name: 'Laminado Fosco', typeId: typeMap['Acabamento'], unitPrice: 0.15, unit: 'un', description: 'Plastificação fosca por unidade' },
    { name: 'Verniz Localizado', typeId: typeMap['Acabamento'], unitPrice: 0.25, unit: 'un', description: 'Brilho em pontos específicos' },
    { name: 'Dobra', typeId: typeMap['Acabamento'], unitPrice: 0.05, unit: 'un', description: 'Vinco e dobra simples' },
    { name: 'Corte Especial', typeId: typeMap['Acabamento'], unitPrice: 0.40, unit: 'un', description: 'Faca de corte personalizada' },
  ];

  for (const f of finishes) {
    const exists = await prisma.product.findFirst({ where: { name: f.name, typeId: f.typeId, tenantId: DEFAULT_TENANT_ID } as any });
    if (!exists) await prisma.product.create({ data: { ...f, tenantId: DEFAULT_TENANT_ID } as any });
  }

  // 4. Seed Products - Supplies (Insumos)
  const supplies = [
    { name: 'Tinta Preto CMYK', typeId: typeMap['Tinta / Insumo'], unitPrice: 120.0, unit: 'kg', description: 'Tinta preta para impressão offset/plotter' },
    { name: 'Tinta Ciano CMYK', typeId: typeMap['Tinta / Insumo'], unitPrice: 125.0, unit: 'kg', description: 'Tinta ciano para impressão colorida' },
    { name: 'Vinil Adesivo Branco', typeId: typeMap['Tinta / Insumo'], unitPrice: 38.0, unit: 'm²', description: 'Vinil adesivo para recorte e impressão' },
    { name: 'Lona 440g', typeId: typeMap['Tinta / Insumo'], unitPrice: 32.0, unit: 'm²', description: 'Lona para banners e fachadas' },
  ];

  for (const s of supplies) {
    const exists = await prisma.product.findFirst({ where: { name: s.name, typeId: s.typeId, tenantId: DEFAULT_TENANT_ID } as any });
    if (!exists) await prisma.product.create({ data: { ...s, tenantId: DEFAULT_TENANT_ID } as any });
  }

  // 5. Seed Products - Services
  const services = [
    { name: 'Arte Final', typeId: typeMap['Serviço'], unitPrice: 80.0, unit: 'h', description: 'Criação/ajuste de arte para impressão' },
    { name: 'Impressão Digital', typeId: typeMap['Serviço'], unitPrice: 22.0, unit: 'm²', description: 'Serviço de impressão digital colorida' },
    { name: 'Recorte Eletrônico', typeId: typeMap['Serviço'], unitPrice: 15.0, unit: 'm²', description: 'Serviço de recorte para adesivos e vinil' },
    { name: 'Instalação', typeId: typeMap['Serviço'], unitPrice: 120.0, unit: 'h', description: 'Serviço de instalação externa' },
  ];

  for (const s of services) {
    const exists = await prisma.product.findFirst({ where: { name: s.name, typeId: s.typeId, tenantId: DEFAULT_TENANT_ID } as any });
    if (!exists) await prisma.product.create({ data: { ...s, tenantId: DEFAULT_TENANT_ID } as any });
  }

  // 6. Seed Expense Categories
  const expenseCategories = [
    'Sangria',
    'Insumos',
    'Aluguel',
    'Salários',
    'Energia',
    'Marketing',
    'Manutenção',
    'Impostos',
    'Frete',
    'Outros',
  ];

  for (const name of expenseCategories) {
    await (prisma as any).expenseCategory.upsert({
      where: { name_tenantId: { name, tenantId: DEFAULT_TENANT_ID } },
      update: {},
      create: { name, tenantId: DEFAULT_TENANT_ID },
    });
  }

  // 7. Seed Suppliers
  const suppliers = [
    { name: 'Distribuidora Gráfica SP', email: 'vendas@distribuidoragrafica.com', phone: '(11) 3333-1111', category: 'Papel e Mídia' },
    { name: 'Tintas Brasil', email: 'comercial@tintasbrasil.com', phone: '(11) 3333-2222', category: 'Tintas e Insumos' },
    { name: 'Acabamentos Prime', email: 'atendimento@acabamentosprime.com', phone: '(11) 3333-3333', category: 'Acabamento' },
  ];

  for (const s of suppliers) {
    const exists = await (prisma as any).supplier.findFirst({
      where: { name: s.name, tenantId: DEFAULT_TENANT_ID },
    });
    if (!exists) {
      await (prisma as any).supplier.create({
        data: { ...s, tenantId: DEFAULT_TENANT_ID },
      });
    }
  }

  // 8. Initial Customers
  const customers = [
    { name: 'Cliente Balcão', email: 'balcao@gestorprint.com', phone: '00000-0000' },
    { name: 'Gráfica Express', email: 'contato@graficaexpress.com', phone: '(11) 4444-4444' },
  ];

  for (const c of customers) {
    await (prisma as any).customer.upsert({
      where: { email_tenantId: { email: c.email, tenantId: DEFAULT_TENANT_ID } },
      update: {},
      create: { ...c, tenantId: DEFAULT_TENANT_ID },
    });
  }

  console.log('Seed finished successfully!');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
