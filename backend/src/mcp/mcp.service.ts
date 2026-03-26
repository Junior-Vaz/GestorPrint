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

  async createEstimateFromFlow(tenantId: number, collectedData: Record<string, any>) {
    // Strip internal session fields before persisting
    const { _inventory, _pendingMessage, _pendingChoice, _pendingSituational, ...cleanData } = collectedData;

    // Normalize field names to match estimate details schema
    if (cleanData.produto && !cleanData.productName)    cleanData.productName = cleanData.produto;
    if (cleanData.quantidade && !cleanData.quantity)    cleanData.quantity    = Number(cleanData.quantidade);
    if (cleanData.largura && !cleanData.width)          cleanData.width       = Number(cleanData.largura);
    if (cleanData.altura && !cleanData.height)          cleanData.height      = Number(cleanData.altura);
    if (cleanData.prazo && !cleanData.deliveryDays)     cleanData.deliveryDays = cleanData.prazo;

    // Find or create customer by name
    const customerName: string = cleanData.nome || cleanData.name || cleanData.cliente || 'Cliente WhatsApp';
    const phone: string | null = cleanData.telefone || cleanData.phone || null;

    let customerId: number | undefined = cleanData.customerId ? Number(cleanData.customerId) : undefined;

    if (!customerId) {
      const existing = await (this.prisma as any).customer.findFirst({
        where: { tenantId, name: { contains: customerName, mode: 'insensitive' } },
      });
      if (existing) {
        customerId = existing.id;
      } else {
        const created = await (this.prisma as any).customer.create({
          data: { name: customerName, phone, tenantId },
        });
        customerId = created.id;
      }
    }

    // Calculate total price from inventory data if available
    let totalPrice = 0;
    const inventory = Array.isArray(_inventory) ? _inventory : [];
    const productNameRaw = cleanData.productName || cleanData.produto || '';
    if (inventory.length > 0 && productNameRaw) {
      const product = inventory.find((p: any) =>
        String(p.name).toLowerCase().includes(String(productNameRaw).toLowerCase()) ||
        String(productNameRaw).toLowerCase().includes(String(p.name).toLowerCase())
      );
      if (product) {
        totalPrice = Number(product.price) * Number(cleanData.quantity || cleanData.quantidade || 1);
        // Save product reference in details for display
        if (!cleanData.productId) cleanData.productId = product.id;
        if (!cleanData.productName) cleanData.productName = product.name;
        if (!cleanData.unit) cleanData.unit = product.unit;
      }
    }

    return (this.prisma as any).estimate.create({
      data: { customerId, totalPrice, details: cleanData, tenantId },
      include: { customer: true },
    });
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

  // ─── Flow Builder ───────────────────────────────────────────────────────────

  async getFlowConfig(tenantId = 1): Promise<any> {
    return (this.prisma as any).flowConfig.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId, nodes: [], edges: [] },
    });
  }

  async updateFlowConfig(data: { nodes: any[]; edges: any[] }, tenantId = 1) {
    return (this.prisma as any).flowConfig.upsert({
      where: { tenantId },
      update: { nodes: data.nodes, edges: data.edges },
      create: { tenantId, nodes: data.nodes, edges: data.edges },
    });
  }

  async getFlowSession(tenantId: number, phone: string): Promise<any> {
    return (this.prisma as any).flowSession.findUnique({
      where: { tenantId_contactPhone: { tenantId, contactPhone: phone } },
    });
  }

  async upsertFlowSession(tenantId: number, phone: string, data: { currentNodeId: string; collectedData: any }) {
    return (this.prisma as any).flowSession.upsert({
      where: { tenantId_contactPhone: { tenantId, contactPhone: phone } },
      update: data,
      create: { tenantId, contactPhone: phone, ...data },
    });
  }

  async deleteFlowSession(tenantId: number, phone: string) {
    return (this.prisma as any).flowSession.deleteMany({
      where: { tenantId, contactPhone: phone },
    });
  }

  // Calculate price from product + quantity, create order, generate PIX
  async calculateAndPix(tenantId: number, productRef: string, quantity: number, customerId?: number) {
    // Find product by name (case-insensitive contains)
    const products = await this.productsService.findAll(tenantId);
    const product = (products as any[]).find((p: any) =>
      p.name.toLowerCase().includes(productRef.toLowerCase())
    );
    if (!product) throw new Error(`Produto "${productRef}" não encontrado no catálogo.`);

    const unitPrice: number = product.unitPrice;
    const total = parseFloat((unitPrice * quantity).toFixed(2));

    // Create order (use customerId 1 as fallback if not collected)
    const order = await this.ordersService.create({
      tenantId,
      customerId: customerId || 1,
      productDescription: `${product.name} × ${quantity} ${product.unit}`,
      amount: total,
      status: 'PENDING',
    } as any, tenantId);

    // Generate PIX
    const pix = await this.paymentsService.createPayment(order.id, 'PIX');

    return { orderId: order.id, total, unitPrice, quantity, product: product.name, pix };
  }
}
