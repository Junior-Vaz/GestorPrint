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

  findAll(tenantId: number, type?: string) {
    return this.prisma.estimate.findMany({
       where: { tenantId, ...(type ? { estimateType: type } as any : {}) } as any,
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
    const estimateType = (estimate as any).estimateType || 'service';
    const productDescription = (() => {
      const qty = details.quantity || details.quantidade;
      const qtyStr = qty ? ` × ${qty}un` : '';
      if (estimateType === 'plotter' || (estimateType === 'cutting' && details.calculationMethod !== 'per_piece')) {
        const w = details.width || details.largura;
        const h = details.height || details.altura;
        const dimStr = w && h ? ` ${w}×${h}cm` : '';
        return `${details.materialName || details.productName || 'Impresso'}${dimStr}${qtyStr}`;
      }
      if (estimateType === 'embroidery' && details.calculationMethod === 'setup_plus_per_piece') {
        return `${details.productName || 'Estamparia'}${qtyStr} (setup incluso)`;
      }
      return `${details.productName || details.produto || 'Serviço'}${qtyStr}`;
    })();

    const order = await this.prisma.order.create({
      data: {
        customerId: estimate.customerId,
        estimateId: estimate.id,
        salespersonId: estimate.salespersonId,
        tenantId,
        productDescription,
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

  private drawPreviewVisual(
    doc: any,
    estimateType: string,
    details: any,
    areaX: number, areaY: number, areaW: number, areaH: number,
  ) {
    const cx = areaX + areaW / 2;
    const cy = areaY + areaH / 2;

    if (estimateType === 'plotter' || (estimateType === 'cutting' && details.width && details.height)) {
      const w = Number(details.width) || 100;
      const h = Number(details.height) || 100;
      const maxW = areaW - 60;
      const maxH = areaH - 50;
      const scale = Math.min(maxW / w, maxH / h) * 0.82;
      const rW = Math.max(w * scale, 12);
      const rH = Math.max(h * scale, 12);
      const rx = cx - rW / 2;
      const ry = cy - rH / 2 - 8; // shift up a bit to leave room for bottom label

      // Outer substrate area (simulating the media/papel)
      const padS = 14;
      doc.rect(rx - padS, ry - padS, rW + padS * 2, rH + padS * 2)
        .fillColor('#f1f5f9').fill();
      doc.rect(rx - padS, ry - padS, rW + padS * 2, rH + padS * 2)
        .strokeColor('#cbd5e1').lineWidth(0.5).stroke();

      // Print area fill (white)
      doc.rect(rx, ry, rW, rH).fillColor('#ffffff').fill();

      // Subtle grid inside print area (simulates artwork)
      const gridStep = Math.max(rW / 8, 8);
      doc.strokeColor('#e2e8f0').lineWidth(0.3);
      for (let gx = rx + gridStep; gx < rx + rW; gx += gridStep) {
        doc.moveTo(gx, ry).lineTo(gx, ry + rH).stroke();
      }
      for (let gy = ry + gridStep; gy < ry + rH; gy += gridStep) {
        doc.moveTo(rx, gy).lineTo(rx + rW, gy).stroke();
      }

      // Print area border
      if (estimateType === 'cutting') {
        doc.rect(rx, ry, rW, rH)
          .strokeColor('#64748b').lineWidth(1).dash(5, { space: 3 }).stroke();
        doc.undash();
      } else {
        doc.rect(rx, ry, rW, rH)
          .strokeColor('#94a3b8').lineWidth(0.8).stroke();
      }

      // Crop marks (extends outside print area)
      const m = 8, g = 4;
      doc.strokeColor('#334155').lineWidth(0.7);
      const corners: [number, number][] = [
        [rx, ry], [rx + rW, ry], [rx, ry + rH], [rx + rW, ry + rH],
      ];
      corners.forEach(([px, py]) => {
        const dirX = px === rx ? -1 : 1;
        const dirY = py === ry ? -1 : 1;
        doc.moveTo(px + dirX * g, py).lineTo(px + dirX * (g + m), py).stroke();
        doc.moveTo(px, py + dirY * g).lineTo(px, py + dirY * (g + m)).stroke();
      });

      // Bleed border (dashed, slightly outside)
      doc.rect(rx - 3, ry - 3, rW + 6, rH + 6)
        .strokeColor('#cbd5e1').lineWidth(0.4).dash(3, { space: 2 }).stroke();
      doc.undash();

      // Halftone dots in corner (decorative, simulates print rosette)
      const dotR = 1.2;
      for (let di = 0; di < 3; di++) {
        for (let dj = 0; dj < 3; dj++) {
          doc.circle(rx + 6 + di * 5, ry + 6 + dj * 5, dotR).fillColor('#c0c8d8').fill();
        }
      }

      // Dimension labels
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
      // Bottom: width
      doc.text(`${w} cm`, rx, ry + rH + padS + 4, { width: rW, align: 'center' });
      // Left: height (rotated)
      doc.save()
        .translate(rx - padS - 12, cy - 8)
        .rotate(-90)
        .fillColor('#475569').fontSize(8).font('Helvetica-Bold')
        .text(`${h} cm`, -20, 0, { width: 40, align: 'center' })
        .restore();

      // Colors info bar (bottom of preview area)
      if (details.colors) {
        const colorsY = areaY + areaH - 16;
        const swatchColors: Record<string, string[]> = {
          '4x4': ['#000000', '#00adef', '#ec008c', '#ffde17'],
          '4x0': ['#000000', '#00adef', '#ec008c', '#ffde17'],
          '1x0': ['#000000'],
        };
        const swatches = swatchColors[details.colors] || ['#000000'];
        const barX = cx - (swatches.length * 10 + 50) / 2;
        doc.fillColor('#64748b').fontSize(7).font('Helvetica')
          .text(details.colors, barX, colorsY + 2);
        swatches.forEach((color, i) => {
          doc.rect(barX + 30 + i * 11, colorsY + 2, 8, 8).fillColor(color).fill()
            .strokeColor('#94a3b8').lineWidth(0.3).stroke();
        });
      }

    } else if (estimateType === 'embroidery') {
      if (details.previewImage) {
        // Preview 3D capturado do canvas — mostrar imagem real da camiseta
        try {
          const base64Data = (details.previewImage as string).replace(/^data:image\/\w+;base64,/, '');
          const imgBuffer = Buffer.from(base64Data, 'base64');
          const zoom = 1.8;
          const scaledW = areaW * zoom;
          const scaledH = areaH * zoom;
          const imgX = areaX - (scaledW - areaW) / 2;
          const imgY = areaY - (scaledH - areaH) / 2;
          doc.save();
          doc.rect(areaX, areaY, areaW, areaH).clip();
          doc.image(imgBuffer, imgX, imgY, { fit: [scaledW, scaledH], align: 'center', valign: 'center' });
          doc.restore();
        } catch {
          // fallback se imagem corrompida
          doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
            .text('Preview indisponível', areaX, cy - 8, { width: areaW, align: 'center' });
        }
      } else {
        // Silhueta de camiseta escalada (fallback sem preview)
        const scale = Math.min(areaW / 160, areaH / 160) * 0.7;
        const sw = 140 * scale, sh = 120 * scale;
        const bx = cx - sw / 2, by = cy - sh / 2 - 8;
        const sleeveW = sw * 0.22, sleeveH = sh * 0.38;
        const bodyX = bx + sleeveW * 0.7, bodyW = sw - sleeveW * 1.4;
        const bodyY = by + sh * 0.14, bodyH = sh * 0.86;
        const neckR = sw * 0.1;
        doc.polygon(
          [bx, by + sleeveH * 0.3], [bodyX, by], [bodyX, by + sleeveH], [bx, by + sleeveH],
        ).fillColor('#e2e8f0').fill().strokeColor('#94a3b8').lineWidth(0.7).stroke();
        doc.polygon(
          [bx + sw, by + sleeveH * 0.3], [bodyX + bodyW, by],
          [bodyX + bodyW, by + sleeveH], [bx + sw, by + sleeveH],
        ).fillColor('#e2e8f0').fill().strokeColor('#94a3b8').lineWidth(0.7).stroke();
        doc.rect(bodyX, bodyY, bodyW, bodyH).fillColor('#f1f5f9').fill()
          .strokeColor('#94a3b8').lineWidth(0.7).stroke();
        doc.circle(cx, bodyY, neckR).fillColor('#e2e8f0').fill()
          .strokeColor('#94a3b8').lineWidth(0.7).stroke();
        const stX = cx - bodyW * 0.22, stY = bodyY + bodyH * 0.15;
        const stW = bodyW * 0.44, stH = bodyH * 0.35;
        doc.rect(stX, stY, stW, stH).fillColor('#dbeafe').fill()
          .strokeColor('#3b82f6').lineWidth(0.8).dash(3, { space: 2 }).stroke();
        doc.undash();
        doc.fillColor('#3b82f6').fontSize(7).font('Helvetica-Bold')
          .text('ESTAMPA', stX, stY + stH / 2 - 4, { width: stW, align: 'center' });
      }
      // Label produto
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text(details.productName || 'Produto', areaX, areaY + areaH - 14, { width: areaW, align: 'center' });

    } else {
      // Serviço genérico — ícone clean de documento/serviço
      const ic = 55 * Math.min(areaW / 200, areaH / 200);
      const bx = cx - ic * 0.4, by = cy - ic * 0.55;
      // Página
      doc.polygon([bx, by], [bx + ic * 0.6, by], [bx + ic * 0.8, by + ic * 0.2], [bx + ic * 0.8, by + ic], [bx, by + ic])
        .fillColor('#f1f5f9').fill().strokeColor('#94a3b8').lineWidth(0.8).stroke();
      // Dobra da página
      doc.polygon([bx + ic * 0.6, by], [bx + ic * 0.6, by + ic * 0.2], [bx + ic * 0.8, by + ic * 0.2])
        .fillColor('#e2e8f0').fill().strokeColor('#94a3b8').lineWidth(0.5).stroke();
      // Linhas de texto simuladas
      [0.35, 0.5, 0.65, 0.8].forEach(frac => {
        const lineW = ic * (frac < 0.7 ? 0.5 : 0.35);
        doc.rect(bx + ic * 0.12, by + ic * frac, lineW, 2.5).fillColor('#cbd5e1').fill();
      });
      doc.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text(details.productName || details.produto || 'Serviço', areaX, areaY + areaH - 14, { width: areaW, align: 'center' });
    }
  }

  async generatePdf(id: number, res: any, tenantId: number) {
    await this.plansService.requireFeature(tenantId, 'hasPdf');
    const estimate = await this.findOne(id, tenantId);
    if (!estimate) throw new Error('Orçamento não encontrado');

    const settings = await this.settingsService.getSettings(tenantId);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const details = estimate.details as any;
    const estimateType = (estimate as any).estimateType || 'service';

    const statusLabels: Record<string, string> = {
      PENDING: 'Pendente', APPROVED: 'Aprovado', REJECTED: 'Recusado', EXPIRED: 'Expirado',
    };
    const statusLabel = statusLabels[estimate.status] || estimate.status;
    const dateStr = estimate.createdAt.toLocaleDateString('pt-BR');

    // ── HEADER ───────────────────────────────────────────────────────
    let logoEndX = 50;
    if (settings?.logoUrl) {
      try {
        const filename = settings.logoUrl.split('/').pop();
        if (filename) {
          const logoPath = path.join(process.cwd(), 'uploads', filename);
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 45, { fit: [65, 65] });
            logoEndX = 125;
          }
        }
      } catch { /* skip */ }
    }

    // Company block
    doc.fillColor('#1e293b').fontSize(18).font('Helvetica-Bold')
      .text(settings?.companyName || 'GestorPrint', logoEndX, 50, { width: 260 });
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text(`CNPJ: ${settings?.cnpj || '—'}`, logoEndX, 73);
    doc.text(settings?.phone || '', logoEndX, 85);

    // Estimate number (right)
    doc.fillColor('#4f46e5').fontSize(28).font('Helvetica-Bold')
      .text(`#${String(estimate.id).padStart(4, '0')}`, 350, 45, { align: 'right', width: 195 });
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text(`Data: ${dateStr}`, 350, 83, { align: 'right', width: 195 });
    doc.text(`Status: ${statusLabel}`, 350, 96, { align: 'right', width: 195 });

    // Divider
    let y = 120;
    doc.rect(50, y, 495, 1.5).fillColor('#4f46e5').fill();

    // ── CLIENTE ───────────────────────────────────────────────────────
    y += 14;
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica-Bold')
      .text('DADOS DO CLIENTE', 50, y);
    y += 13;
    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold')
      .text(estimate.customer.name, 50, y, { width: 340 });

    const contactParts = [
      estimate.customer.email || null,
      estimate.customer.phone || null,
    ].filter(Boolean);
    if (contactParts.length) {
      doc.fillColor('#64748b').fontSize(9).font('Helvetica')
        .text(contactParts.join('   ·   '), 50, y + 16);
    }

    // Divider
    y += 40;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // ── DESCRIÇÃO DO SERVIÇO ──────────────────────────────────────────
    y += 14;
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica-Bold')
      .text('DESCRIÇÃO DO SERVIÇO', 50, y);
    y += 16;

    const drawRow = (label: string, value: string) => {
      doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold')
        .text(label, 50, y, { width: 155, lineBreak: false });
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica')
        .text(value || '—', 210, y, { width: 335, lineBreak: false });
      // Light alternating line
      doc.moveTo(50, y + 16).lineTo(545, y + 16).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
      y += 20;
    };

    if (estimateType === 'plotter') {
      drawRow('Material / Mídia:', details.materialName || 'Padrão');
      if (details.width && details.height) drawRow('Dimensões:', `${details.width} × ${details.height} cm`);
      drawRow('Quantidade:', `${details.quantity || 1} unidade(s)`);
      if (details.finishingName) drawRow('Acabamento:', details.finishingName);
      if (details.colors) drawRow('Cores de impressão:', details.colors);
    } else if (estimateType === 'cutting') {
      drawRow('Material:', details.materialName || details.productName || '—');
      if (details.calculationMethod !== 'per_piece' && details.width && details.height) {
        drawRow('Dimensões:', `${details.width} × ${details.height} cm`);
      }
      drawRow('Quantidade:', `${details.quantity || 1} unidade(s)`);
      if (details.complexity) {
        const cl: Record<string, string> = { simple: 'Simples', medium: 'Médio', complex: 'Complexo' };
        drawRow('Complexidade:', cl[details.complexity] || details.complexity);
      }
    } else if (estimateType === 'embroidery') {
      drawRow('Peça / Produto:', details.productName || '—');
      drawRow('Quantidade:', `${details.quantity || 1} unidade(s)`);
      if (details.calculationMethod === 'base_plus_colors') {
        drawRow('N° de Cores:', String(details.colors || 1));
        drawRow('Adicional por cor:', `R$ ${Number(details.colorSurcharge || 10).toFixed(2)}`);
      } else if (details.calculationMethod === 'setup_plus_per_piece') {
        drawRow('Setup:', `R$ ${Number(details.setupCost || 0).toFixed(2)}`);
        drawRow('Preço por peça:', `R$ ${Number(details.pricePerPiece || 0).toFixed(2)}`);
      }
    } else {
      drawRow('Produto / Serviço:', details.productName || details.produto || 'Serviço');
      drawRow('Quantidade:', `${details.quantity || details.quantidade || 1} unidade(s)`);
      if (details.unitPrice) drawRow('Preço unitário:', `R$ ${Number(details.unitPrice).toFixed(2)}`);
    }

    // Divider
    doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // ── VISUALIZAÇÃO ──────────────────────────────────────────────────
    y += 18;
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica-Bold')
      .text('VISUALIZAÇÃO DO SERVIÇO', 50, y);
    y += 10;

    const PREV_H = 300;
    // Preview background
    doc.rect(50, y, 495, PREV_H).fillColor('#2d2d2d').fill();

    this.drawPreviewVisual(doc, estimateType, details, 50, y, 495, PREV_H);
    y += PREV_H + 16;

    // ── TOTAL ─────────────────────────────────────────────────────────
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    y += 14;

    const discountAmt = Number(details.discountAmount || 0);
    if (discountAmt > 0) {
      const subtotalVal = estimate.totalPrice + discountAmt;
      const discountLabel = details.discountType === 'fixed'
        ? `Desconto (R$ ${Number(details.discount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
        : `Desconto (${Number(details.discount)}%)`;
      // Subtotal row
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Subtotal', 50, y);
      doc.fillColor('#475569').fontSize(11).font('Helvetica')
        .text(`R$ ${subtotalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 200, y, { align: 'right', width: 345 });
      y += 18;
      // Discount row
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(discountLabel, 50, y);
      doc.fillColor('#dc2626').fontSize(11).font('Helvetica-Bold')
        .text(`- R$ ${discountAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 200, y, { align: 'right', width: 345 });
      y += 6;
      doc.moveTo(200, y + 4).lineTo(545, y + 4).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      y += 12;
    }

    doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold')
      .text('VALOR TOTAL DO ORÇAMENTO', 50, y);
    doc.fillColor('#16a34a').fontSize(22).font('Helvetica-Bold')
      .text(
        `R$ ${estimate.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        200, y - 2, { align: 'right', width: 345 },
      );

    // ── FOOTER ────────────────────────────────────────────────────────
    const FOOTER_Y = 755;
    doc.moveTo(50, FOOTER_Y).lineTo(545, FOOTER_Y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
      .text('Validade: 7 dias corridos. Sujeito a alteração de estoque e disponibilidade de material.', 50, FOOTER_Y + 10, { align: 'center', width: 495 });
    doc.fontSize(7)
      .text(`Gerado automaticamente pelo GestorPrint  ·  Orçamento #${String(estimate.id).padStart(4, '0')}  ·  ${dateStr}`, 50, FOOTER_Y + 24, { align: 'center', width: 495 });

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
