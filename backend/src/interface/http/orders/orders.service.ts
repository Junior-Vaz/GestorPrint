import { Injectable, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ManageOrderUseCase } from '../../../application/orders/manage-order.usecase';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import * as path from 'path';
import * as fs from 'fs';
const PDFDocument = require('pdfkit');

// Status que indicam pedido fechado — gatilho pra creditar pontos/cashback.
// FINISHED = pronto pra retirada/entrega, já considerado "consumido" pra fidelidade.
// DELIVERED = entregue. Aceitamos ambos pra cobrir gráficas que pulam direto pra
// DELIVERED no PDV sem passar por FINISHED.
const LOYALTY_TRIGGER_STATUSES = new Set(['FINISHED', 'DELIVERED']);

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly manageOrder: ManageOrderUseCase,
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
  ) {}

  /**
   * Cria pedido. Se o caller informou `pointsRedeemed`/`cashbackRedeemed`,
   * extrai esses campos antes de chamar o use case (eles não fazem parte do
   * domain Order do app), cria o pedido normalmente e DEPOIS aplica o resgate
   * via LoyaltyService — que valida saldo, debita do cliente e grava nos
   * campos snapshot (pointsRedeemed/cashbackRedeemed/loyaltyDiscount no Order).
   *
   * Decisão: aplicar resgate DEPOIS do create (e não junto na transaction)
   * mantém a separação de responsabilidades — manageOrder.create não conhece
   * fidelidade. Se o redeem falhar (ex: saldo dessincronizou), pedido fica
   * criado sem desconto e logamos pra o operador resolver manualmente.
   */
  async create(dto: CreateOrderDto, tenantId: number) {
    const { pointsRedeemed, cashbackRedeemed, ...orderData } = dto as any;
    const order = await this.manageOrder.create({ ...orderData, tenantId });
    const orderId = (order as any)?.id;
    if (!orderId) return order;

    // 1. Resgate de pontos/cashback aplicado pelo cliente neste pedido
    const wantsRedeem = (pointsRedeemed && pointsRedeemed > 0) || (cashbackRedeemed && cashbackRedeemed > 0);
    if (wantsRedeem) {
      try {
        await this.loyalty.applyRedeem(tenantId, orderId, pointsRedeemed || 0, cashbackRedeemed || 0);
      } catch (err: any) {
        // Saldo insuficiente / race — pedido fica criado mas sem desconto.
        this.logger.warn(`Resgate falhou no pedido ${orderId}: ${err.message}`);
      }
    }

    // 2. Crédito automático de pontos/cashback pelo valor pago.
    // Pedido do PDV nasce já em DELIVERED (manageOrder.create define initialStatus),
    // então NUNCA passa pelo `update()` — precisa disparar o crédito aqui.
    // O `creditOrderEarnings` é idempotente via `loyaltyProcessed`, então
    // chamar aqui + via update() não duplica.
    const status = (order as any)?.status;
    if (status && LOYALTY_TRIGGER_STATUSES.has(status)) {
      this.loyalty.creditOrderEarnings(orderId).catch((err) =>
        this.logger.warn(`Loyalty credit falhou pro pedido ${orderId}: ${err.message}`),
      );
    }

    return order;
  }

  findAll(tenantId: number) { return this.manageOrder.findAll(tenantId); }
  findAllPaginated(tenantId: number, dto: any) { return this.manageOrder.findAllPaginated(tenantId, dto); }
  findOne(id: number, tenantId: number) { return this.manageOrder.findOne(id, tenantId); }

  /**
   * Atualiza pedido. Se a transição leva o status pra FINISHED/DELIVERED, dispara
   * o crédito de fidelidade (idempotente — `loyaltyProcessed` no Order garante
   * que só credita 1x mesmo que o status oscile entre PENDING/FINISHED).
   *
   * Crédito é fire-and-forget: erro não derruba o update do pedido. Logamos
   * em caso de falha pra retry manual via cron de reconciliação (futuro).
   */
  async update(id: number, dto: UpdateOrderDto, tenantId: number, userId?: number | null) {
    const updated = await this.manageOrder.update(id, dto, tenantId, userId);
    const statusValue = (updated as any)?.status ?? (dto as any)?.status;
    if (statusValue && LOYALTY_TRIGGER_STATUSES.has(statusValue)) {
      this.loyalty.creditOrderEarnings(id).catch((err) =>
        this.logger.warn(`Loyalty credit falhou pro pedido ${id}: ${err.message}`),
      );
    }
    return updated;
  }

  remove(id: number, tenantId: number, userId?: number | null) {
    return this.manageOrder.remove(id, tenantId, userId);
  }

  async generateReceipt(id: number, res: any, tenantId: number) {
    await this.manageOrder.requirePdfFeature(tenantId);

    const order = await (this.prisma as any).order.findFirst({
      where: { id, tenantId },
      include: { customer: true },
    });
    if (!order) throw new Error('Pedido não encontrado');

    const settings = await this.settingsService.getSettings(tenantId);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const drawReceipt = (yOffset: number, title: string) => {
      let currentX = 40;

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

      doc.fillColor('#1a1a1a')
        .fontSize(14).font('Helvetica-Bold').text(settings?.companyName || 'GESTORPRINT', currentX, yOffset)
        .fontSize(8).font('Helvetica').text(`CNPJ: ${settings?.cnpj || ''}`, currentX, yOffset + 18)
        .text(`Tel: ${settings?.phone || ''}`, currentX, yOffset + 28);

      doc.fontSize(11).font('Helvetica-Bold').text(title, 40, yOffset, { align: 'right', width: 510 });
      doc.fontSize(9).font('Helvetica').text(`Pedido #${order.id}`, 40, yOffset + 18, { align: 'right', width: 510 });
      doc.fontSize(8).font('Helvetica').text(`Data: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`, 40, yOffset + 32, { align: 'right', width: 510 });

      doc.moveTo(40, yOffset + 45).lineTo(550, yOffset + 45).strokeColor('#eeeeee').stroke();

      doc.fontSize(9).font('Helvetica-Bold').text('CLIENTE:', 40, yOffset + 55);
      doc.font('Helvetica').text(`${order.customer.name} - ${order.customer.phone || ''}`, 90, yOffset + 55);

      let tableY = yOffset + 75;
      doc.rect(40, tableY, 510, 15).fill('#f9fafb');
      doc.fillColor('#4b5563').fontSize(8).font('Helvetica-Bold')
        .text('DESCRIÇÃO', 50, tableY + 4).text('QTD', 350, tableY + 4)
        .text('UN', 400, tableY + 4).text('TOTAL', 500, tableY + 4);

      let itemY = tableY + 20;
      doc.fillColor('#1f2937').font('Helvetica');
      const details = order.details as any;
      if (details?.items) {
        details.items.forEach((item: any) => {
          doc.text(item.name.substring(0, 50), 50, itemY)
            .text(item.quantity.toString(), 350, itemY)
            .text(`R$ ${item.unitPrice.toFixed(2)}`, 400, itemY)
            .text(`R$ ${(item.unitPrice * item.quantity).toFixed(2)}`, 500, itemY);
          itemY += 12;
        });
      } else {
        doc.text(order.productDescription.substring(0, 100), 50, itemY)
          .text('1', 350, itemY).text(`R$ ${order.amount.toFixed(2)}`, 400, itemY)
          .text(`R$ ${order.amount.toFixed(2)}`, 500, itemY);
        itemY += 15;
      }

      doc.moveTo(40, itemY + 5).lineTo(550, itemY + 5).strokeColor('#eeeeee').stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('TOTAL GERAL:', 380, itemY + 15);
      doc.fontSize(12).text(`R$ ${order.amount.toFixed(2)}`, 480, itemY + 15, { align: 'right' });

      doc.moveTo(150, yOffset + 240).lineTo(400, yOffset + 240).strokeColor('#333333').stroke();
      doc.fontSize(7).font('Helvetica').text('ASSINATURA DO CLIENTE', 40, yOffset + 245, { align: 'center' });
    };

    drawReceipt(40, 'RECIBO DE VENDA (1ª VIA)');
    doc.moveTo(40, 400).lineTo(550, 400).dash(5, { space: 5 }).strokeColor('#cccccc').stroke().undash();
    drawReceipt(430, 'RECIBO DE VENDA (2ª VIA)');
    doc.end();
  }
}
