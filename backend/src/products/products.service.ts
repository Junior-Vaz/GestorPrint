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

  async create(createProductDto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: createProductDto as any
    });
    
    // Audit Log
    await this.auditService.logAction(
      1, // Assuming admin for now or system
      'CREATE',
      'Product',
      product.id,
      createProductDto
    );

    return product;
  }

  findAll() {
    return (this.prisma as any).product.findMany({
      include: {
        productType: true,
        supplier: { select: { id: true, name: true } },
        _count: { select: { movements: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  async updateStock(id: number, quantity: number, type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT', reason?: string) {
    // We use a transaction to ensure stock and movement stay in sync
    return (this.prisma as any).$transaction(async (tx: any) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          stock: {
            increment: quantity
          }
        }
      });

      await tx.stockMovement.create({
        data: {
          productId: id,
          quantity,
          type,
          reason
        }
      });

      // Check for low stock
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

  findOne(id: number) {
    return (this.prisma as any).product.findUnique({
      where: { id },
      include: {
        productType: true,
        supplier: { select: { id: true, name: true } },
        movements: { take: 10, orderBy: { createdAt: 'desc' } }
      }
    });
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: updateProductDto as any
    });
  }

  remove(id: number) {
    return this.prisma.product.delete({
      where: { id }
    });
  }
}
