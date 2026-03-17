import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return (this.prisma as any).productType.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
  }

  create(data: { name: string; color?: string; hasStock?: boolean }) {
    return (this.prisma as any).productType.create({ data });
  }

  update(id: number, data: { name?: string; color?: string; hasStock?: boolean }) {
    return (this.prisma as any).productType.update({ where: { id }, data });
  }

  async remove(id: number) {
    const count = await (this.prisma as any).product.count({ where: { typeId: id } });
    if (count > 0) {
      throw new Error(`Não é possível excluir: ${count} produto(s) usam este tipo.`);
    }
    return (this.prisma as any).productType.delete({ where: { id } });
  }

  async seedDefaults() {
    const defaults = [
      { name: 'Papel / Mídia', color: '#f59e0b', hasStock: true },
      { name: 'Acabamento', color: '#6366f1', hasStock: true },
      { name: 'Tinta / Insumo', color: '#ec4899', hasStock: true },
      { name: 'Serviço', color: '#10b981', hasStock: false },
    ];
    for (const t of defaults) {
      await (this.prisma as any).productType.upsert({
        where: { name: t.name },
        update: {},
        create: t,
      });
    }
  }
}
