import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class ProductTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: number) {
    return (this.prisma as any).productType.findMany({
      where: { tenantId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
  }

  create(data: { name: string; color?: string; hasStock?: boolean }, tenantId: number) {
    return (this.prisma as any).productType.create({ data: { ...data, tenantId } });
  }

  update(id: number, data: { name?: string; color?: string; hasStock?: boolean }, tenantId: number) {
    return (this.prisma as any).productType.updateMany({ where: { id, tenantId }, data });
  }

  async remove(id: number, tenantId: number) {
    const count = await (this.prisma as any).product.count({ where: { typeId: id, tenantId } });
    if (count > 0) {
      throw new Error(`Não é possível excluir: ${count} produto(s) usam este tipo.`);
    }
    return (this.prisma as any).productType.deleteMany({ where: { id, tenantId } });
  }

  async seedDefaults(tenantId: number) {
    const defaults = [
      { name: 'Papel / Mídia', color: '#f59e0b', hasStock: true },
      { name: 'Acabamento', color: '#6366f1', hasStock: true },
      { name: 'Tinta / Insumo', color: '#ec4899', hasStock: true },
      { name: 'Serviço', color: '#10b981', hasStock: false },
    ];
    for (const t of defaults) {
      await (this.prisma as any).productType.upsert({
        where: { name_tenantId: { name: t.name, tenantId } },
        update: {},
        create: { ...t, tenantId },
      });
    }
  }
}
