import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function main() {
  const prisma = new PrismaClient();

  console.log('Seed started...');

  // 1. Seed ProductTypes
  const typeMap: Record<string, number> = {};
  const defaultTypes = [
    { name: 'Papel / Mídia', color: '#f59e0b', hasStock: true },
    { name: 'Acabamento', color: '#6366f1', hasStock: true },
    { name: 'Tinta / Insumo', color: '#ec4899', hasStock: true },
    { name: 'Serviço', color: '#10b981', hasStock: false },
  ];

  for (const t of defaultTypes) {
    const created = await prisma.productType.upsert({
      where: { name: t.name },
      update: {},
      create: t,
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
    const exists = await prisma.product.findFirst({ where: { name: p.name, typeId: p.typeId } });
    if (!exists) await prisma.product.create({ data: p });
  }

  // 3. Seed Products - Finishes
  const finishes = [
    { name: 'Laminado Fosco', typeId: typeMap['Acabamento'], unitPrice: 0.15, unit: 'un', description: 'Plastificação fosca por unidade' },
    { name: 'Verniz Localizado', typeId: typeMap['Acabamento'], unitPrice: 0.25, unit: 'un', description: 'Brilho em pontos específicos' },
    { name: 'Dobra', typeId: typeMap['Acabamento'], unitPrice: 0.05, unit: 'un', description: 'Vinco e dobra simples' },
    { name: 'Corte Especial', typeId: typeMap['Acabamento'], unitPrice: 0.40, unit: 'un', description: 'Faca de corte personalizada' },
  ];

  for (const f of finishes) {
    const exists = await prisma.product.findFirst({ where: { name: f.name, typeId: f.typeId } });
    if (!exists) await prisma.product.create({ data: f });
  }

  // 4. Initial Customers
  const customers = [
    { name: 'Cliente Balcão', email: 'balcao@gestorprint.com', phone: '00000-0000' },
    { name: 'Gráfica Express', email: 'contato@graficaexpress.com', phone: '(11) 4444-4444' },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { email: c.email },
      update: {},
      create: c,
    });
  }

  console.log('Seed finished successfully!');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
