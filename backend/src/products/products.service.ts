import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async create(createProductDto: CreateProductDto, tenantId: number) {
    const product = await this.prisma.product.create({
      data: { ...createProductDto, tenantId } as any
    });

    await this.auditService.logAction(1, 'CREATE', 'Product', product.id, createProductDto);
    return product;
  }

  findAll(tenantId: number) {
    return (this.prisma as any).product.findMany({
      where: { tenantId },
      include: {
        productType: true,
        supplier: { select: { id: true, name: true } },
        _count: { select: { movements: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  async updateStock(id: number, quantity: number, type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT', reason?: string) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const product = await tx.product.update({
        where: { id },
        data: { stock: { increment: quantity } }
      });

      await tx.stockMovement.create({
        data: { productId: id, quantity, type, reason }
      });

      if (product.stock <= product.minStock) {
        await this.notificationsService.create({
          title: 'Estoque Baixo',
          message: `O produto "${product.name}" atingiu o nível crítico (${product.stock} ${product.unit}).`,
          type: 'WARNING',
        });
      }

      return product;
    });
  }

  findOne(id: number, tenantId: number) {
    return (this.prisma as any).product.findFirst({
      where: { id, tenantId },
      include: {
        productType: true,
        supplier: { select: { id: true, name: true } },
        movements: { take: 10, orderBy: { createdAt: 'desc' } }
      }
    });
  }

  update(id: number, updateProductDto: UpdateProductDto, tenantId: number) {
    return (this.prisma as any).product.updateMany({
      where: { id, tenantId },
      data: updateProductDto as any
    });
  }

  remove(id: number, tenantId: number) {
    return (this.prisma as any).product.deleteMany({
      where: { id, tenantId }
    });
  }
}
