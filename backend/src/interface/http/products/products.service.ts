import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PaginationDto, PaginatedResult, paginateResult } from '../../../shared/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Garante que `typeId` e `supplierId` (se vierem) pertencem ao mesmo tenant.
   * Sem isso, um operador podia criar produto com FK apontando pra categoria
   * ou fornecedor de outro tenant — DB aceita silenciosamente.
   */
  private async assertFkOwnership(dto: any, tenantId: number) {
    if (dto.typeId) {
      const t = await (this.prisma as any).productType.findFirst({
        where: { id: dto.typeId, tenantId },
      });
      if (!t) throw new BadRequestException('Categoria de produto inválida');
    }
    if (dto.supplierId) {
      const s = await (this.prisma as any).supplier.findFirst({
        where: { id: dto.supplierId, tenantId },
      });
      if (!s) throw new BadRequestException('Fornecedor inválido');
    }
  }

  async create(createProductDto: CreateProductDto, tenantId: number) {
    await this.assertFkOwnership(createProductDto, tenantId);
    const product = await this.prisma.product.create({
      data: { ...createProductDto, tenantId } as any
    });

    await this.auditService.logAction(null, 'CREATE', 'Product', product.id, createProductDto, tenantId);
    return product;
  }

  async findAll(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<any>> {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, type } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (type) where.typeId = Number(type);

    const include = {
      productType: true,
      supplier: { select: { id: true, name: true } },
      _count: { select: { movements: true } },
    };

    const [data, total] = await (this.prisma as any).$transaction([
      (this.prisma as any).product.findMany({ where, include, orderBy: { name: 'asc' }, skip, take: limit }),
      (this.prisma as any).product.count({ where }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  findAllInternal(tenantId: number): Promise<any[]> {
    return (this.prisma as any).product.findMany({
      where: { tenantId },
      include: { productType: true, supplier: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updateStock(
    id: number,
    quantity: number,
    type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT',
    tenantId: number,
    reason?: string,
  ) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      // updateMany ancora tenantId — sem isso, um operador podia ajustar estoque
      // de produto de outro tenant via POST /products/:id/stock com id forjado.
      const result = await tx.product.updateMany({
        where: { id, tenantId },
        data:  { stock: { increment: quantity } },
      });
      if (result.count === 0) {
        throw new Error('Produto não encontrado');
      }
      const product = await tx.product.findUnique({ where: { id } });

      await tx.stockMovement.create({
        data: { productId: id, quantity, type, reason },
      });

      if (product.stock <= product.minStock) {
        await this.notificationsService.create({
          tenantId,
          title:   'Estoque Baixo',
          message: `O produto "${product.name}" atingiu o nível crítico (${product.stock} ${product.unit}).`,
          type:    'WARNING',
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
