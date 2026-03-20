import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { EstimatesService } from '../estimates/estimates.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { FilesService } from '../files/files.service';

@Injectable()
export class McpService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly estimatesService: EstimatesService,
    private readonly paymentsService: PaymentsService,
    private readonly filesService: FilesService,
    private readonly prisma: PrismaService,
  ) {}

  async getInventory(tenantId = 1) {
    const config = await this.getAiConfig(tenantId);
    const products = await this.productsService.findAll(tenantId);
    
    // Filter by allowed categories if configured
    const filteredProducts = config?.allowedProductTypes?.length > 0 
      ? products.filter((p: any) => config.allowedProductTypes.includes(p.typeId))
      : products;

    return filteredProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.productType?.name,
      price: p.unitPrice,
      unit: p.unit,
      description: p.description
    }));
  }

  async getOrderStatus(orderId: number, tenantId = 1) {
    try {
      const order = await this.ordersService.findOne(orderId, tenantId);
      
      if (!order) {
        return { error: 'Pedido não encontrado' };
      }

      return {
        id: order.id,
        status: order.status,
        customer: order.customerName,
        product: order.productDescription,
        date: order.createdAt
      };
    } catch (e) {
      return { error: 'Erro ao buscar pedido' };
    }
  }

  async createEstimateDraft(data: any, tenantId = 1) {
    // This tool allows the AI to record a draft estimate directly from WhatsApp
    return this.estimatesService.create(data, tenantId);
  }

  async generatePix(orderId: number) {
    return this.paymentsService.createPayment(orderId, 'PIX');
  }

  async saveArtwork(orderId: number, fileData: { buffer: Buffer; originalname: string; mimetype: string }, tenantId = 1) {
    return this.filesService.saveFile(orderId, fileData as any, tenantId);
  }

  async getAiConfig(tenantId = 1): Promise<any> {
    return (this.prisma as any).aiConfig.findUnique({ where: { tenantId } });
  }

  async updateAiConfig(data: any, tenantId = 1) {
    return (this.prisma as any).aiConfig.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data }
    });
  }
}
