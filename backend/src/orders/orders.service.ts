import { Injectable, ForbiddenException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { PlansService } from '../plans/plans.service';

import { MessagingService } from '../messaging/messaging.service';
import { SettingsService } from '../settings/settings.service';
import * as path from 'path';
import * as fs from 'fs';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

const PDFDocument = require('pdfkit');

@Injectable()
export class OrdersService {
  constructor(private readonly ordersGateway: OrdersGateway,
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly messagingService: MessagingService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly plansService: PlansService,
  ) {}

  async create(createOrderDto: CreateOrderDto, tenantId: number) {
    // ── Enforce plan limits ────────────────────────────────────────────────
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { maxOrders: true, isActive: true, planStatus: true },
    });
    if (!tenant?.isActive || ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
      throw new ForbiddenException('Conta suspensa ou cancelada. Entre em contato com o suporte.');
    }
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const orderCount = await (this.prisma as any).order.count({
      where: { tenantId, createdAt: { gte: startOfMonth } },
    });
    if (orderCount >= tenant.maxOrders) {
      throw new ForbiddenException(
        `Limite de ${tenant.maxOrders} pedido(s)/mês atingido. Faça upgrade do seu plano.`,
      );
    }
    // ──────────────────────────────────────────────────────────────────────
    let customer = await this.prisma.customer.findFirst({
      where: { name: createOrderDto.customerName, tenantId } as any
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name: createOrderDto.customerName,
          email: `contato_${Date.now()}@exemplo.com`,
          tenantId,
        } as any
      });
    }

    // Determine status: PDV sales skip the queue, going straight to DELIVERED
    const initialStatus = createOrderDto.isPdv ? 'DELIVERED' : 'PENDING';

    console.log('Creating order with data:', {
      productDescription: createOrderDto.productDescription,
      amount: createOrderDto.amount,
      status: initialStatus,
      customerId: customer.id,
      details: createOrderDto.details,
      estimateId: createOrderDto.estimateId
    });

    const newOrder = await (this.prisma.order as any).create({
      data: {
        productDescription: createOrderDto.productDescription,
        amount: createOrderDto.amount,
        status: initialStatus,
        customerId: customer.id,
        tenantId,
        salespersonId: createOrderDto.salespersonId || null,
        producerId: createOrderDto.producerId || null,
        details: createOrderDto.details || null,
        estimateId: createOrderDto.estimateId || null
      },
      include: { customer: true, attachments: true }
    });

    // Notify via WebSocket (UI Update)
    this.ordersGateway.notifyNewOrder(newOrder);

    // Create System Notification
    await this.notificationsService.create({
      title: createOrderDto.isPdv ? 'Venda PDV Realizada' : 'Novo Pedido Recebido',
      message: `Pedido #${newOrder.id} - ${customer.name} - R$ ${newOrder.amount.toFixed(2)}`,
      type: createOrderDto.isPdv ? 'SUCCESS' : 'INFO',
      tenantId,
    });
    
    // Auto-create PAID transaction for PDV orders
    if (createOrderDto.isPdv) {
      await (this.prisma as any).transaction.create({
        data: {
          orderId: newOrder.id,
          amount: newOrder.amount,
          status: 'PAID',
          paymentType: createOrderDto.paymentMethod || 'DINHEIRO',
          gatewayId: `PDV-${newOrder.id}-${Date.now()}`
        }
      });
    }
    // Immediate stock deduction for PDV items
    if (createOrderDto.isPdv && createOrderDto.details && Array.isArray(createOrderDto.details.items)) {
      for (const item of createOrderDto.details.items) {
        if (item.id && item.quantity > 0 && item.hasStock) {
          try {
            await this.productsService.updateStock(
              item.id,
              -item.quantity,
              'SALE',
              `Venda PDV - Pedido #${newOrder.id}`
            );
          } catch (e) {
             console.error(`PDV Stock deduction failed for product ${item.id}:`, e);
          }
        }
      }
    }

    const payload = {
      id: newOrder.id,
      customerName: newOrder.customer.name,
      customerPhone: newOrder.customer.phone,
      productDescription: newOrder.productDescription,
      amount: newOrder.amount,
      status: newOrder.status,
      createdAt: newOrder.createdAt.toISOString(),
      attachments: (newOrder as any).attachments || []
    };
    
    this.ordersGateway.notifyNewOrder(payload);
    return payload;
  }

  async findAll(tenantId: number) {
    const orders = await (this.prisma as any).order.findMany({
      where: { tenantId },
      include: {
        customer: true,
        salesperson: true,
        producer: true,
        attachments: true,
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { id: 'desc' }
    });
    
    return orders.map((o: any) => ({
      id: o.id,
      customerName: o.customer.name,
      customerPhone: o.customer.phone,
      productDescription: o.productDescription,
      amount: o.amount,
      status: o.status,
      salesperson: o.salesperson ? { id: o.salesperson.id, name: o.salesperson.name } : null,
      producer: o.producer ? { id: o.producer.id, name: o.producer.name } : null,
      createdAt: o.createdAt.toISOString(),
      attachments: o.attachments,
      transactions: o.transactions
    }));
  }

  async findOne(id: number, tenantId: number) {
    const o = await (this.prisma as any).order.findFirst({
      where: { id, tenantId },
      include: { 
        customer: true,
        salesperson: true,
        producer: true,
        attachments: true,
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!o) return null;

    return {
      id: o.id,
      customerName: o.customer.name,
      customerPhone: o.customer.phone,
      productDescription: o.productDescription,
      amount: o.amount,
      status: o.status,
      salesperson: o.salesperson ? { id: o.salesperson.id, name: o.salesperson.name } : null,
      producer: o.producer ? { id: o.producer.id, name: o.producer.name } : null,
      createdAt: o.createdAt.toISOString(),
      attachments: o.attachments,
      transactions: o.transactions
    };
  }

  async update(id: number, updateOrderDto: UpdateOrderDto, tenantId: number) {
    const previousOrder = await (this.prisma as any).order.findFirst({
      where: { id, tenantId },
      include: { estimate: true }
    });

    const updatedOrder = await (this.prisma.order as any).update({
      where: { id },
      data: updateOrderDto,
      include: { 
        customer: true, 
        estimate: true, 
        attachments: true,
        salesperson: true,
        producer: true,
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Audit Log
    await this.auditService.logAction(
      1, // Generic Admin
      'UPDATE',
      'Order',
      id,
      {
        oldStatus: previousOrder?.status,
        newStatus: updatedOrder.status,
        fields: Object.keys(updateOrderDto)
      }
    );

    // Notify Status Change
    if (previousOrder?.status !== updatedOrder.status) {
      const statusLabels: Record<string, string> = {
        PENDING: 'Pendente',
        PRODUCTION: 'Em Produção',
        FINISHED: 'Finalizado / Pronto',
        DELIVERED: 'Entregue',
        CANCELLED: 'Cancelado',
        COMPLETED: 'Concluído'
      };

      const statusName = statusLabels[updatedOrder.status] || updatedOrder.status;

      await this.notificationsService.create({
        title: 'Atualização de Pedido',
        message: `O Pedido #${id} (${updatedOrder.customer.name}) mudou para: ${statusName}`,
        type: updatedOrder.status === 'DELIVERED' || updatedOrder.status === 'COMPLETED' ? 'SUCCESS' : 'INFO',
      });
    }

    // Check for "Reserving Stock" condition
    if (previousOrder?.status !== 'PRODUCTION' && updatedOrder.status === 'PRODUCTION') {
      await this.handleStockDeduction(updatedOrder);
      await this.messagingService.notifyOrderStatus(updatedOrder.id, 'PRODUCTION');

      // Sync Transaction: If no transaction exists, create a manual one (CASH)
      const existingTx = await (this.prisma as any).transaction.findFirst({
        where: { orderId: updatedOrder.id, status: 'PAID' }
      });

      if (!existingTx) {
        await (this.prisma as any).transaction.create({
          data: {
            orderId: updatedOrder.id,
            amount: updatedOrder.amount,
            status: 'PAID',
            paymentType: 'DINHEIRO', // Manual confirmation defaults to Cash
            gatewayId: `MANUAL-${updatedOrder.id}-${Date.now()}`
          }
        });
      }
    }

    if (previousOrder?.status !== 'COMPLETED' && updatedOrder.status === 'COMPLETED') {
      await this.messagingService.notifyOrderStatus(updatedOrder.id, 'COMPLETED');
    }

    if (previousOrder?.status !== 'DELIVERED' && updatedOrder.status === 'DELIVERED') {
      await this.messagingService.notifyOrderStatus(updatedOrder.id, 'DELIVERED');
    }

    if (previousOrder?.status !== 'CANCELLED' && updatedOrder.status === 'CANCELLED') {
      await this.messagingService.notifyOrderStatus(updatedOrder.id, 'CANCELLED');
    }

    const payload = {
      id: updatedOrder.id,
      customerName: updatedOrder.customer.name,
      customerPhone: updatedOrder.customer.phone,
      productDescription: updatedOrder.productDescription,
      amount: updatedOrder.amount,
      status: updatedOrder.status,
      salesperson: updatedOrder.salesperson ? { id: updatedOrder.salesperson.id, name: updatedOrder.salesperson.name } : null,
      producer: updatedOrder.producer ? { id: updatedOrder.producer.id, name: updatedOrder.producer.name } : null,
      createdAt: updatedOrder.createdAt.toISOString(),
      attachments: (updatedOrder as any).attachments || [],
      transactions: (updatedOrder as any).transactions || []
    };

    this.ordersGateway.notifyOrderUpdated(payload);
    
    return payload;
  }

  private async handleStockDeduction(order: any) {
    if (!order.estimateId || !order.estimate) return;

    try {
      const details = order.estimate.details as any;
      const paperName = details.paperName;
      const quantity = details.quantity || 0;

      if (paperName && quantity > 0) {
        // Find product by name
        const products = await this.productsService.findAll(order.tenantId ?? 1);
        const product = products.find((p: any) =>
          p.name.toLowerCase().includes(paperName.toLowerCase()) || 
          paperName.toLowerCase().includes(p.name.toLowerCase())
        );

        if (product) {
          await this.productsService.updateStock(
            product.id, 
            -quantity, 
            'SALE', 
            `Consumo automático - Pedido #${order.id}`
          );
          console.log(`Inventory: Deducted ${quantity} from ${product.name} for Order #${order.id}`);
        }
      }
    } catch (error) {
      console.error('Inventory Deduction Failed:', error);
    }
  }

  async remove(id: number, tenantId: number) {
    const order = await (this.prisma as any).order.findFirst({
      where: { id, tenantId },
      include: { customer: true }
    });

    const deleted = await this.prisma.order.deleteMany({
       where: { id, tenantId } as any
    });

    // Audit Log
    await this.auditService.logAction(
      1, // Generic Admin
      'DELETE',
      'Order',
      id,
      {
        customer: order?.customer?.name,
        description: order?.productDescription,
        amount: order?.amount
      }
    );

    return deleted;
  }

  async generateReceipt(id: number, res: any, tenantId: number) {
    await this.plansService.requireFeature(tenantId, 'hasPdf');
    const order = await (this.prisma as any).order.findFirst({
      where: { id, tenantId },
      include: { customer: true }
    });

    if (!order) throw new Error('Pedido não encontrado');

    const settings = await this.settingsService.getSettings(tenantId);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    doc.pipe(res);

    const drawReceipt = (yOffset: number, title: string) => {
      let currentX = 40;

      // Logo
      if (settings?.logoUrl) {
        try {
          const filename = settings.logoUrl.split('/').pop();
          if (filename) {
            const logoPath = path.join(process.cwd(), 'uploads', filename);
            if (fs.existsSync(logoPath)) {
              doc.image(logoPath, currentX, yOffset, { width: 80 });
              currentX = 130;
            }
          }
        } catch (e) {
          console.error('Receipt logo error:', e);
        }
      }

      // Company Info
      doc.fillColor('#1a1a1a')
        .fontSize(14).font('Helvetica-Bold').text(settings?.companyName || 'GESTORPRINT', currentX, yOffset)
        .fontSize(8).font('Helvetica').text(`CNPJ: ${settings?.cnpj || ''}`, currentX, yOffset + 18)
        .text(`Tel: ${settings?.phone || ''}`, currentX, yOffset + 28);

      // Receipt Title & #
      doc.fontSize(11).font('Helvetica-Bold').text(title, 40, yOffset, { align: 'right', width: 510 });
      doc.fontSize(9).font('Helvetica').text(`Pedido #${order.id}`, 40, yOffset + 18, { align: 'right', width: 510 });
      doc.fontSize(8).font('Helvetica').text(`Data: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`, 40, yOffset + 32, { align: 'right', width: 510 });

      doc.moveTo(40, yOffset + 45).lineTo(550, yOffset + 45).strokeColor('#eeeeee').stroke();

      // Customer Info
      doc.fontSize(9).font('Helvetica-Bold').text('CLIENTE:', 40, yOffset + 55);
      doc.font('Helvetica').text(`${order.customer.name} - ${order.customer.phone || ''}`, 90, yOffset + 55);

      // Table Header
      let tableY = yOffset + 75;
      doc.rect(40, tableY, 510, 15).fill('#f9fafb');
      doc.fillColor('#4b5563').fontSize(8).font('Helvetica-Bold')
        .text('DESCRIÇÃO', 50, tableY + 4)
        .text('QTD', 350, tableY + 4)
        .text('UN', 400, tableY + 4)
        .text('TOTAL', 500, tableY + 4);

      // Items
      let itemY = tableY + 20;
      doc.fillColor('#1f2937').font('Helvetica');
      
      const details = order.details as any;
      if (details && details.items) {
        details.items.forEach((item: any) => {
          doc.text(item.name.substring(0, 50), 50, itemY)
            .text(item.quantity.toString(), 350, itemY)
            .text(`R$ ${item.unitPrice.toFixed(2)}`, 400, itemY)
            .text(`R$ ${(item.unitPrice * item.quantity).toFixed(2)}`, 500, itemY);
          itemY += 12;
        });
      } else {
        doc.text(order.productDescription.substring(0, 100), 50, itemY)
          .text('1', 350, itemY)
          .text(`R$ ${order.amount.toFixed(2)}`, 400, itemY)
          .text(`R$ ${order.amount.toFixed(2)}`, 500, itemY);
        itemY += 15;
      }

      // Totals
      doc.moveTo(40, itemY + 5).lineTo(550, itemY + 5).strokeColor('#eeeeee').stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('TOTAL GERAL:', 380, itemY + 15);
      doc.fontSize(12).text(`R$ ${order.amount.toFixed(2)}`, 480, itemY + 15, { align: 'right' });

      // Signature line
      doc.moveTo(150, yOffset + 240).lineTo(400, yOffset + 240).strokeColor('#333333').stroke();
      doc.fontSize(7).font('Helvetica').text('ASSINATURA DO CLIENTE', 40, yOffset + 245, { align: 'center' });
    };

    // 1st Copy (Top)
    drawReceipt(40, 'RECIBO DE VENDA (1ª VIA)');

    // Separate line (Dashed)
    doc.moveTo(40, 400).lineTo(550, 400).dash(5, { space: 5 }).strokeColor('#cccccc').stroke().undash();

    // 2nd Copy (Bottom)
    drawReceipt(430, 'RECIBO DE VENDA (2ª VIA)');

    doc.end();
  }
}

