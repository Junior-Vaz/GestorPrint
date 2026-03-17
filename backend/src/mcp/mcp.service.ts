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

  async getInventory() {
    const config = await this.getAiConfig();
    const products = await this.productsService.findAll();
    
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

  async getOrderStatus(orderId: number) {
    try {
      const order = await this.ordersService.findOne(orderId);
      return {
        id: order.id,
        status: order.status,
        customer: order.customerName,
        product: order.productDescription,
        date: order.createdAt
      };
    } catch (e) {
      return { error: 'Pedido não encontrado' };
    }
  }

  async createEstimateDraft(data: any) {
    // This tool allows the AI to record a draft estimate directly from WhatsApp
    return this.estimatesService.create(data);
  }

  async generatePix(orderId: number) {
    return this.paymentsService.createPayment(orderId, 'PIX');
  }

  async saveArtwork(orderId: number, fileData: { buffer: Buffer; originalname: string; mimetype: string }) {
    return this.filesService.saveFile(orderId, fileData as any);
  }

  async getAiConfig(): Promise<any> {
    return (this.prisma as any).aiConfig.findUnique({ where: { id: 1 } });
  }
  
  async updateAiConfig(data: any) {
    return (this.prisma as any).aiConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data }
    });
  }
}
