import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { PrismaEstimateRepository } from '../../../infrastructure/estimates/prisma-estimate.repository';
import { ConvertEstimateUseCase } from '../../../application/estimates/convert-estimate.usecase';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as path from 'path';
import * as fs from 'fs';

import { SettingsService } from '../settings/settings.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckFeatureUseCase } from '../../../application/entitlement/check-feature.usecase';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estimateRepo: PrismaEstimateRepository,
    private readonly convertEstimate: ConvertEstimateUseCase,
    private readonly settingsService: SettingsService,
    private readonly paymentsService: PaymentsService,
    private readonly checkFeature: CheckFeatureUseCase,
  ) {}

  async create(createEstimateDto: CreateEstimateDto, tenantId: number) {
    // Gate por tipo de orçamento — service é universal mas tipos específicos
    // (plotter/cutting/embroidery) exigem feature ativa no plano.
    await this.assertEstimateTypeAllowed(tenantId, (createEstimateDto as any).estimateType);
    await this.assertFkOwnership(createEstimateDto, tenantId);
    return this.prisma.estimate.create({
      data: { ...createEstimateDto, tenantId } as any,
      include: { customer: true },
    });
  }

  /**
   * Garante que customerId e salespersonId pertencem ao tenant.
   * Sem isso, operador podia criar orçamento referenciando cliente ou vendedor
   * de outro tenant — Prisma aceita FK silenciosamente.
   */
  private async assertFkOwnership(dto: any, tenantId: number) {
    if (dto.customerId) {
      const c = await (this.prisma as any).customer.findFirst({
        where: { id: dto.customerId, tenantId },
      });
      if (!c) throw new BadRequestException('Cliente inválido');
    }
    if (dto.salespersonId) {
      const u = await (this.prisma as any).user.findFirst({
        where: { id: dto.salespersonId, tenantId },
      });
      if (!u) throw new BadRequestException('Vendedor inválido');
    }
  }

  /** Mapeia estimateType → FeatureKey e bloqueia se não tiver acesso */
  private async assertEstimateTypeAllowed(tenantId: number, estimateType?: string) {
    const map: Record<string, FeatureKey> = {
      plotter:    FeatureKey.PLOTTER_ESTIMATE,
      cutting:    FeatureKey.CUTTING_ESTIMATE,
      embroidery: FeatureKey.EMBROIDERY_ESTIMATE,
    };
    const featureKey = estimateType ? map[estimateType] : undefined;
    if (!featureKey) return; // service ou desconhecido — sempre permitido
    const allowed = await this.checkFeature.check(tenantId, featureKey);
    if (!allowed) {
      // Reaproveita a exception padrão do CheckFeatureUseCase pra UX consistente
      await this.checkFeature.execute(tenantId, featureKey);
    }
  }

  findAll(tenantId: number, dto: any) {
    return this.estimateRepo.findAll(tenantId, dto);
  }

  findOne(id: number, tenantId: number) {
    return (this.prisma.estimate as any).findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        salesperson: { select: { id: true, name: true } },
      },
    });
  }

  update(id: number, updateEstimateDto: UpdateEstimateDto, tenantId: number) {
    return (this.prisma.estimate as any).updateMany({
      where: { id, tenantId },
      data: updateEstimateDto as any,
    });
  }

  convertToOrder(id: number, tenantId: number, opts: { deliveryDate?: string | null; priority?: string } = {}) {
    return this.convertEstimate.execute(id, tenantId, opts);
  }

  async reject(id: number, reason: string, tenantId: number) {
    return (this.prisma.estimate as any).updateMany({
      where: { id, tenantId },
      data: { status: 'REJECTED', rejectedReason: reason } as any,
    });
  }

  async markSent(id: number, tenantId: number) {
    return (this.prisma.estimate as any).updateMany({
      where: { id, tenantId },
      data: { status: 'SENT', sentAt: new Date() } as any,
    });
  }

  // Public link de aprovacao
  async findPublicByUuid(uuid: string) {
    const estimate: any = await (this.prisma.estimate as any).findUnique({
      where: { uuid },
      include: {
        customer: { select: { name: true } },
        salesperson: { select: { name: true } },
        attachments: { select: { id: true, filename: true, originalName: true, mimetype: true, size: true, createdAt: true } },
      },
    });
    if (!estimate) return { error: 'Orcamento nao encontrado.' };

    const settings = await this.settingsService.getSettings(estimate.tenantId);

    let displayStatus = estimate.status;
    if (['DRAFT', 'SENT'].includes(estimate.status) && estimate.validUntil) {
      if (new Date(estimate.validUntil) < new Date()) displayStatus = 'EXPIRED';
    }

    return {
      uuid: estimate.uuid,
      id: estimate.id,
      status: displayStatus,
      estimateType: estimate.estimateType,
      details: estimate.details,
      totalPrice: estimate.totalPrice,
      validUntil: estimate.validUntil,
      rejectedReason: estimate.rejectedReason,
      createdAt: estimate.createdAt,
      customer: estimate.customer,
      salesperson: estimate.salesperson,
      attachments: estimate.attachments || [],
      company: {
        name: settings?.companyName || 'GestorPrint',
        logoUrl: settings?.logoUrl || null,
        phone: settings?.phone || null,
        email: (settings as any)?.email || null,
        cnpj: settings?.cnpj || null,
      },
    };
  }

  /** Resolve um UUID em { id, tenantId } pra uso no FilesController público */
  async resolvePublicUuid(uuid: string) {
    const estimate: any = await (this.prisma.estimate as any).findUnique({
      where: { uuid },
      select: { id: true, tenantId: true, status: true, validUntil: true },
    });
    if (!estimate) return null;
    if (estimate.status === 'REJECTED') return null;
    if (estimate.validUntil && new Date(estimate.validUntil) < new Date()) return null;
    return { id: estimate.id, tenantId: estimate.tenantId };
  }

  async approvePublic(uuid: string) {
    const estimate: any = await (this.prisma.estimate as any).findUnique({ where: { uuid } });
    if (!estimate) throw new Error('Orcamento nao encontrado.');
    if (estimate.status === 'APPROVED') return { ok: true, alreadyApproved: true };
    if (estimate.status === 'REJECTED') throw new Error('Orcamento rejeitado nao pode ser aprovado.');
    if (estimate.validUntil && new Date(estimate.validUntil) < new Date()) {
      throw new Error('Orcamento expirou.');
    }
    const result = await this.convertEstimate.execute(estimate.id, estimate.tenantId);
    return { ok: true, orderId: result.order.id };
  }

  async rejectPublic(uuid: string, reason: string) {
    const estimate: any = await (this.prisma.estimate as any).findUnique({ where: { uuid } });
    if (!estimate) throw new Error('Orcamento nao encontrado.');
    if (['APPROVED', 'REJECTED'].includes(estimate.status)) {
      return { ok: true, alreadyHandled: true };
    }
    await (this.prisma.estimate as any).update({
      where: { id: estimate.id },
      data: { status: 'REJECTED', rejectedReason: reason || 'Recusado pelo cliente' } as any,
    });
    return { ok: true };
  }

  async generatePublicPdf(uuid: string, res: any) {
    const estimate: any = await (this.prisma.estimate as any).findUnique({ where: { uuid } });
    if (!estimate) throw new Error('Orcamento nao encontrado.');
    return this.generatePdf(estimate.id, res, estimate.tenantId);
  }

  async getPayment(id: number, tenantId: number) {
    const estimate = await this.estimateRepo.findWithOrders(id, tenantId);
    if (!estimate) throw new Error('Orcamento nao encontrado');
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
    return (this.prisma.estimate as any).deleteMany({ where: { id, tenantId } });
  }

  async generatePdf(id: number, res: any, tenantId: number) {
    await this.checkFeature.execute(tenantId, FeatureKey.PDF_GENERATION);
    const estimate = await this.findOne(id, tenantId);
    if (!estimate) throw new Error('Orcamento nao encontrado');

    // Busca anexo de preview 3D (se houver) — inclui no PDF visual
    let previewPath: string | null = null;
    try {
      const previewAttachment = await (this.prisma as any).attachment.findFirst({
        where: {
          estimateId: id,
          OR: [
            { originalName: { startsWith: 'preview-' } },
            { filename: { startsWith: 'preview-' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (previewAttachment) {
        const candidate = path.join(process.cwd(), 'uploads', previewAttachment.filename);
        if (fs.existsSync(candidate)) previewPath = candidate;
      }
    } catch (err) {
      console.error('Falha ao buscar preview 3D:', err);
    }

    const settings = await this.settingsService.getSettings(tenantId);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const details = estimate.details as any;
    const dateStr = estimate.createdAt.toLocaleDateString('pt-BR');

    // Header
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
      } catch {}
    }

    doc.fillColor('#0F172A').fontSize(18).font('Helvetica-Bold')
      .text(settings?.companyName || 'GestorPrint', logoEndX, 50, { width: 260 });
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
      .text(`CNPJ: ${settings?.cnpj || '-'}`, logoEndX, 73);
    doc.text(settings?.phone || '', logoEndX, 85);

    doc.fillColor('#0F172A').fontSize(28).font('Helvetica-Bold')
      .text(`#${String(estimate.id).padStart(4, '0')}`, 350, 45, { align: 'right', width: 195 });
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
      .text(`Data: ${dateStr}`, 350, 83, { align: 'right', width: 195 });
    doc.text(`Status: ${estimate.status}`, 350, 96, { align: 'right', width: 195 });

    let y = 120;
    doc.rect(50, y, 495, 1.5).fillColor('#0F172A').fill();

    y += 14;
    doc.fillColor('#94A3B8').fontSize(7).font('Helvetica-Bold').text('CLIENTE', 50, y);
    y += 13;
    doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text(estimate.customer.name, 50, y, { width: 340 });
    const contactParts = [estimate.customer.email || null, estimate.customer.phone || null].filter(Boolean);
    if (contactParts.length) {
      doc.fillColor('#64748B').fontSize(9).font('Helvetica').text(contactParts.join(' - '), 50, y + 16);
    }

    y += 40;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').lineWidth(1).stroke();

    y += 14;
    doc.fillColor('#94A3B8').fontSize(7).font('Helvetica-Bold').text('DESCRICAO', 50, y);
    y += 16;

    const drawRow = (label: string, value: string) => {
      doc.fillColor('#64748B').fontSize(10).font('Helvetica-Bold').text(label, 50, y, { width: 155, lineBreak: false });
      doc.fillColor('#0F172A').fontSize(10).font('Helvetica').text(value || '-', 210, y, { width: 335, lineBreak: false });
      doc.moveTo(50, y + 16).lineTo(545, y + 16).strokeColor('#F1F5F9').lineWidth(0.5).stroke();
      y += 20;
    };

    drawRow('Produto:', details.productName || details.produto || 'Servico');
    drawRow('Quantidade:', `${details.quantity || details.quantidade || 1} unidade(s)`);
    if (details.width && details.height) drawRow('Dimensoes:', `${details.width} x ${details.height} cm`);

    // Preview 3D (se houver anexo preview-*.{jpg,png})
    if (previewPath) {
      y += 8;
      doc.fillColor('#94A3B8').fontSize(7).font('Helvetica-Bold').text('PREVIEW 3D', 50, y);
      y += 12;
      const imgX = 95;
      const imgW = 360;
      const imgH = 220;
      try {
        doc.save();
        doc.roundedRect(imgX, y, imgW, imgH, 6).strokeColor('#E2E8F0').lineWidth(1).stroke();
        doc.image(previewPath, imgX + 4, y + 4, { fit: [imgW - 8, imgH - 8], align: 'center', valign: 'center' });
        doc.restore();
        y += imgH + 12;
      } catch (err) {
        console.error('Falha ao renderizar preview 3D no PDF:', err);
      }
    }

    y += 14;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').lineWidth(1).stroke();
    y += 14;

    doc.fillColor('#64748B').fontSize(10).font('Helvetica-Bold').text('VALOR TOTAL', 50, y);
    doc.fillColor('#1D9E75').fontSize(22).font('Helvetica-Bold')
      .text(`R$ ${estimate.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 200, y - 2, { align: 'right', width: 345 });

    const FOOTER_Y = 755;
    doc.moveTo(50, FOOTER_Y).lineTo(545, FOOTER_Y).strokeColor('#E2E8F0').lineWidth(1).stroke();
    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
      .text('Validade conforme campo do orcamento. Sujeito a alteracao de estoque.', 50, FOOTER_Y + 10, { align: 'center', width: 495 });
    doc.fontSize(7).text(`GestorPrint - Orcamento #${String(estimate.id).padStart(4, '0')} - ${dateStr}`, 50, FOOTER_Y + 24, { align: 'center', width: 495 });

    doc.pipe(res);
    doc.end();
  }
}
