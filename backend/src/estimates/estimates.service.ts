import { Injectable } from '@nestjs/common';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../orders/orders.gateway';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as path from 'path';
import * as fs from 'fs';

import { SettingsService } from '../settings/settings.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
    private readonly settingsService: SettingsService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
    private readonly plansService: PlansService,
  ) {}

  create(createEstimateDto: CreateEstimateDto, tenantId: number) {
    return this.prisma.estimate.create({
      data: { ...createEstimateDto, tenantId } as any,
      include: { customer: true }
    });
  }

  findAll(tenantId: number) {
    return this.prisma.estimate.findMany({
       where: { tenantId } as any,
       include: {
         customer: true,
         salesperson: { select: { id: true, name: true } }
       },
       orderBy: { id: 'desc' }
    });
  }

  findOne(id: number, tenantId: number) {
    return (this.prisma.estimate as any).findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        salesperson: { select: { id: true, name: true } }
      }
    });
  }

  update(id: number, updateEstimateDto: UpdateEstimateDto, tenantId: number) {
    return (this.prisma.estimate as any).updateMany({
      where: { id, tenantId },
      data: updateEstimateDto as any,
    });
  }

  async convertToOrder(id: number, tenantId: number) {
    const estimate = await (this.prisma.estimate as any).findFirst({
      where: { id, tenantId },
      include: { customer: true }
    });

    if (!estimate) throw new Error('Orçamento não encontrado');

    // Create the order based on estimate snapshot
    const details = estimate.details as any;
    const order = await this.prisma.order.create({
      data: {
        customerId: estimate.customerId,
        estimateId: estimate.id,
        salespersonId: estimate.salespersonId,
        tenantId,
        productDescription: `${details.productName || 'Impresso'} - ${details.width}x${details.height}cm - ${details.quantity}un`,
        amount: estimate.totalPrice,
        status: 'PENDING'
      } as any
    });

    // 3. Update estimate status
    const updatedEstimate = await this.prisma.estimate.update({
      where: { id },
      data: { status: 'APPROVED' }
    });

    // 4. Notify via WebSocket
    this.ordersGateway.notifyNewOrder({
      id: order.id,
      customerName: estimate.customer.name,
      productDescription: order.productDescription,
      amount: order.amount,
      status: order.status,
      createdAt: order.createdAt.toISOString()
    });

    // Create System Notification
    await this.notificationsService.create({
      title: 'Novo Pedido (Orçamento)',
      message: `O Orçamento #${id} (${estimate.customer.name}) foi aprovado e convertido em Pedido.`,
      type: 'INFO',
    });

    return { order, estimate: updatedEstimate };
  }

  async generatePdf(id: number, res: any, tenantId: number) {
    await this.plansService.requireFeature(tenantId, 'hasPdf');
    const estimate = await this.findOne(id, tenantId);
    if (!estimate) throw new Error('Orçamento não encontrado');

    const settings = await this.settingsService.getSettings(tenantId);
    const doc = new PDFDocument({ margin: 50 });
    doc.registerFont('Helvetica', 'Helvetica');
    doc.registerFont('Helvetica-Bold', 'Helvetica-Bold');

    const details = estimate.details as any;

    // Header with Logo
    let headerX = 50;
    
    // Add Logo if exists
    if (settings?.logoUrl) {
      try {
        // Assume logoUrl is /api/files/logo-xxx.png
        // Real path must be mapped to /uploads
        const filename = settings.logoUrl.split('/').pop();
        if (filename) {
          const logoPath = path.join(process.cwd(), 'uploads', filename);
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 40, { width: 100, height: 60, fit: [100, 60], align: 'center' });
            headerX = 170; // Shift text to the right of the logo
          }
        }
      } catch (err) {
        console.error('Failed to embed logo in PDF:', err);
      }
    }

    doc
      .fillColor('#333333')
      .fontSize(20)
      .text(settings?.companyName || 'GESTORPRINT ERP', headerX, 50)
      .fontSize(10)
      .text('Grafica Express & Gestão', headerX, 75)
      .text(`CNPJ: ${settings?.cnpj || '00.000.000/0001-00'}`, headerX, 90)
      .text(`Contato: ${settings?.phone || ''}`, headerX, 105)
      .moveDown();

    // Estimate Info Header
    doc
      .fillColor('#333333')
      .fontSize(16)
      .text(`Orçamento #${estimate.id}`, 400, 50, { align: 'right' })
      .fontSize(10)
      .text(`Data: ${estimate.createdAt.toLocaleDateString('pt-BR')}`, 400, 70, { align: 'right' })
      .text(`Status: ${estimate.status}`, 400, 85, { align: 'right' });

    doc.moveTo(50, 115).lineTo(550, 115).strokeColor('#eeeeee').stroke();

    // Customer Info
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('DADOS DO CLIENTE', 50, 140)
      .font('Helvetica')
      .fontSize(10)
      .text(`Nome: ${estimate.customer.name}`, 50, 160)
      .text(`Email: ${estimate.customer.email || 'N/A'}`, 50, 175)
      .text(`Telefone: ${estimate.customer.phone || 'N/A'}`, 50, 190);

    // Order Details Table Header
    doc
      .font('Helvetica-Bold')
      .text('DESCRIÇÃO DO SERVIÇO', 50, 230)
      .moveTo(50, 245).lineTo(550, 245).strokeColor('#333333').stroke();

    // Table Content
    let y = 260;
    const drawRow = (label: string, value: string) => {
      doc.font('Helvetica-Bold').text(label, 50, y);
      doc.font('Helvetica').text(value, 200, y);
      y += 20;
    };

    drawRow('Produto:', details.productName || 'Impresso Personalizado');
    drawRow('Papel / Mídia:', details.paperName || 'Padrão');
    drawRow('Acabamento:', details.finishingName || 'Nenhum');
    drawRow('Dimensões:', `${details.width} x ${details.height} cm`);
    drawRow('Cores:', details.colors || '4x0');
    drawRow('Quantidade:', `${details.quantity} un`);

    doc.moveTo(50, y + 10).lineTo(550, y + 10).strokeColor('#eeeeee').stroke();

    // Total
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('VALOR TOTAL:', 350, y + 30)
      .fillColor('#4f46e5')
      .text(`R$ ${estimate.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 470, y + 30, { align: 'right' });

    // Footer
    doc
      .fillColor('#aaaaaa')
      .fontSize(8)
      .text('Validade do orçamento: 7 dias. Sujeito a alteração de estoque.', 50, 700, { align: 'center' })
      .text('Documento gerado automaticamente pelo GestorPrint.', 50, 715, { align: 'center' });

    // Stream out
    doc.pipe(res);
    doc.end();
  }

  async getPayment(id: number, tenantId: number) {
    const estimate = await (this.prisma.estimate as any).findFirst({
      where: { id, tenantId },
      include: { orders: true }
    });

    if (!estimate) throw new Error('Orçamento não encontrado');

    let orderId: number;

    if (estimate.orders.length > 0) {
      orderId = estimate.orders[0].id;
    } else {
      const conversion = await this.convertToOrder(id, tenantId);
      orderId = conversion.order.id;
    }

    return this.paymentsService.createPayment(orderId, 'PIX');
  }

  remove(id: number, tenantId: number) {
    return (this.prisma.estimate as any).deleteMany({
      where: { id, tenantId }
    });
  }
}
