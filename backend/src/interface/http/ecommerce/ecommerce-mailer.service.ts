import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';

interface OrderEmailData {
  orderId: number;
  orderUuid: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  paymentMethod?: string;
  paymentStatus: string;
  items: { name: string; qty: number; lineTotal: number }[];
  shippingService?: string;
  shippingCost?: number;
  shippingAddress?: any;
  // Específicos por método de pagamento
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
}

@Injectable()
export class EcommerceMailerService {
  private readonly logger = new Logger(EcommerceMailerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  /** Email enviado quando o pedido é criado (independente do método de pagamento) */
  async sendOrderConfirmation(tenantId: number, data: OrderEmailData) {
    if (!data.customerEmail) return;
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const storeName = settings?.storeConfig?.storeName || settings?.companyName || 'Loja';
    const storeColor = settings?.storeConfig?.primaryColor || '#1D9E75';

    const subject = `Pedido #${String(data.orderId).padStart(5, '0')} recebido — ${storeName}`;
    const html = this.renderOrderConfirmation({ ...data, storeName, storeColor });

    try {
      await this.messaging.sendEmail(data.customerEmail, subject, html, tenantId);
    } catch (e: any) {
      this.logger.error(`Falha ao enviar email de confirmação: ${e.message}`);
    }
  }

  /** Email enviado quando o pagamento é confirmado (webhook MP) */
  async sendPaymentApproved(tenantId: number, data: OrderEmailData) {
    if (!data.customerEmail) return;
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const storeName = settings?.storeConfig?.storeName || settings?.companyName || 'Loja';
    const storeColor = settings?.storeConfig?.primaryColor || '#1D9E75';

    const subject = `Pagamento confirmado — Pedido #${String(data.orderId).padStart(5, '0')}`;
    const html = this.renderPaymentApproved({ ...data, storeName, storeColor });

    try {
      await this.messaging.sendEmail(data.customerEmail, subject, html, tenantId);
    } catch (e: any) {
      this.logger.error(`Falha ao enviar email de pagamento aprovado: ${e.message}`);
    }
  }

  /** Email enviado quando o pagamento é cancelado/rejeitado (PIX expirou, boleto venceu, cartão recusado) */
  async sendOrderCancelled(tenantId: number, data: OrderEmailData & { reason?: string }) {
    if (!data.customerEmail) return;
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const storeName = settings?.storeConfig?.storeName || settings?.companyName || 'Loja';
    const storeColor = settings?.storeConfig?.primaryColor || '#1D9E75';

    const subject = `Pedido #${String(data.orderId).padStart(5, '0')} — pagamento não confirmado`;
    const html = this.renderOrderCancelled({ ...data, storeName, storeColor });

    try {
      await this.messaging.sendEmail(data.customerEmail, subject, html, tenantId);
    } catch (e: any) {
      this.logger.error(`Falha ao enviar email de cancelamento: ${e.message}`);
    }
  }

  /** Email enviado quando o pedido é despachado (admin preenche tracking) */
  async sendOrderShipped(tenantId: number, data: OrderEmailData & { trackingCode: string; carrier?: string }) {
    if (!data.customerEmail) return;
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const storeName = settings?.storeConfig?.storeName || settings?.companyName || 'Loja';
    const storeColor = settings?.storeConfig?.primaryColor || '#1D9E75';

    const subject = `Seu pedido #${String(data.orderId).padStart(5, '0')} foi enviado!`;
    const html = this.renderOrderShipped({ ...data, storeName, storeColor });

    try {
      await this.messaging.sendEmail(data.customerEmail, subject, html, tenantId);
    } catch (e: any) {
      this.logger.error(`Falha ao enviar email de envio: ${e.message}`);
    }
  }

  /** Email enviado quando admin reembolsa o pedido (total ou parcial) */
  async sendRefundConfirmation(data: {
    to: string;
    customerName: string;
    orderRef: string;       // ex: "00015"
    amount: number;
    isFull: boolean;
    reason?: string;
    tenantId?: number;
  }) {
    if (!data.to) return;
    const tenantId = data.tenantId ?? 1;
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const storeName  = settings?.storeConfig?.storeName  || settings?.companyName || 'Loja';
    const storeColor = settings?.storeConfig?.primaryColor || '#1D9E75';

    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const subject = data.isFull
      ? `Pedido #${data.orderRef} reembolsado — ${storeName}`
      : `Reembolso parcial do pedido #${data.orderRef} — ${storeName}`;

    const inner = `
      <tr><td style="padding:24px 32px;background:${storeColor};color:#fff">
        <h1 style="margin:0;font-size:20px;font-weight:600">${data.isFull ? 'Pedido reembolsado' : 'Reembolso parcial'}</h1>
        <p style="margin:6px 0 0;font-size:13px;opacity:.9">Pedido #${data.orderRef}</p>
      </td></tr>
      <tr><td style="padding:32px">
        <p style="margin:0 0 16px;font-size:15px">Olá <strong>${data.customerName}</strong>,</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
          ${data.isFull
            ? `Seu pedido <strong>#${data.orderRef}</strong> foi reembolsado integralmente.`
            : `Foi processado um reembolso parcial do seu pedido <strong>#${data.orderRef}</strong>.`}
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:20px 0">
          <tr><td style="padding:16px 20px">
            <div style="font-size:12px;color:#6b7280">Valor estornado</div>
            <div style="font-size:24px;font-weight:600;color:#111827;margin-top:4px">${fmt(data.amount)}</div>
          </td></tr>
        </table>
        ${data.reason ? `
        <p style="margin:16px 0;font-size:13px;color:#4b5563">
          <strong>Motivo:</strong> ${data.reason.replace(/[<>&]/g, '')}
        </p>` : ''}
        <p style="margin:16px 0;font-size:13px;color:#4b5563;line-height:1.6">
          O valor será creditado de volta na forma de pagamento original em até <strong>5 dias úteis</strong>
          (cartão pode levar até a próxima fatura). Pra dúvidas, entre em contato com o suporte.
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#f9fafb;font-size:12px;color:#6b7280;text-align:center">
        ${storeName}
      </td></tr>
    `;

    const html = this.wrapper(inner, { storeName, storeColor });
    try {
      await this.messaging.sendEmail(data.to, subject, html, tenantId);
    } catch (e: any) {
      this.logger.error(`Falha ao enviar email de reembolso: ${e.message}`);
    }
  }

  // ── Templates HTML ─────────────────────────────────────────────────────────

  private wrapper(content: string, store: { storeName: string; storeColor: string }): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${store.storeName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px">
        <!-- Header -->
        <tr><td style="padding:28px 32px;background:${store.storeColor};color:#ffffff">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.85">${store.storeName}</div>
        </td></tr>
        ${content}
        <!-- Footer -->
        <tr><td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center">
          Este é um email automático. Em caso de dúvida, responda este email.<br>
          © ${new Date().getFullYear()} ${store.storeName}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private renderItems(items: { name: string; qty: number; lineTotal: number }[]): string {
    return items.map(it => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px">${this.escape(it.name)} <span style="color:#9ca3af">× ${it.qty}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;text-align:right">${this.fmt(it.lineTotal)}</td>
      </tr>`).join('');
  }

  private renderOrderConfirmation(d: any): string {
    const orderRef = `#${String(d.orderId).padStart(5, '0')}`;
    const subtotal = d.items.reduce((s: number, i: any) => s + i.lineTotal, 0);
    const isPix    = d.paymentMethod === 'PIX';
    const isBoleto = d.paymentMethod === 'BOLETO';

    let paymentBlock = '';
    if (isPix && d.pixQrCode) {
      paymentBlock = `
      <tr><td style="padding:24px 32px;background:#fff7ed;border-top:1px solid #fed7aa">
        <h2 style="margin:0 0 8px;font-size:17px;color:#1f2937">Pague com PIX para confirmar</h2>
        <p style="margin:0 0 14px;font-size:13px;color:#78350f">Escaneie o QR Code ou copie o código abaixo. O pagamento confirma em segundos.</p>
        ${d.pixQrCodeBase64 ? `<div style="text-align:center;margin:14px 0"><img src="data:image/png;base64,${d.pixQrCodeBase64}" alt="QR Code PIX" width="200" style="border:1px solid #e5e7eb;padding:8px;background:#fff"></div>` : ''}
        <div style="background:#fff;padding:12px;border:1px dashed #d97706;font-family:monospace;font-size:11px;word-break:break-all;color:#1f2937">${this.escape(d.pixQrCode)}</div>
        <p style="margin:12px 0 0;font-size:11px;color:#92400e">Código válido por 30 minutos</p>
      </td></tr>`;
    } else if (isBoleto && d.boletoUrl) {
      paymentBlock = `
      <tr><td style="padding:24px 32px;background:#eff6ff;border-top:1px solid #bfdbfe">
        <h2 style="margin:0 0 8px;font-size:17px;color:#1f2937">Boleto gerado</h2>
        <p style="margin:0 0 14px;font-size:13px;color:#1e40af">Compensação em até 3 dias úteis. O pedido entra em produção assim que confirmamos.</p>
        <a href="${d.boletoUrl}" style="display:inline-block;background:#1f2937;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Visualizar boleto</a>
        ${d.boletoBarcode ? `<div style="margin-top:14px;font-family:monospace;font-size:11px;color:#1e40af">Código: ${this.escape(d.boletoBarcode)}</div>` : ''}
      </td></tr>`;
    } else if (d.paymentMethod === 'CREDIT_CARD' && d.paymentStatus === 'APPROVED') {
      paymentBlock = `
      <tr><td style="padding:20px 32px;background:#ecfdf5;border-top:1px solid #a7f3d0">
        <p style="margin:0;font-size:14px;color:#065f46"><strong>✓ Pagamento aprovado</strong> — seu pedido já entra na fila de produção.</p>
      </td></tr>`;
    }

    let addressBlock = '';
    if (d.shippingAddress) {
      const a = d.shippingAddress;
      addressBlock = `
      <tr><td style="padding:0 32px 20px">
        <h3 style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Endereço de entrega</h3>
        <p style="margin:0;font-size:14px;line-height:1.6">
          ${this.escape(a.street)}, ${this.escape(a.number)}${a.complement ? ' — ' + this.escape(a.complement) : ''}<br>
          ${this.escape(a.neighborhood)} · ${this.escape(a.city)}/${this.escape(a.state)} · ${this.escape(a.cep)}
        </p>
      </td></tr>`;
    }

    const content = `
      <tr><td style="padding:36px 32px 8px">
        <h1 style="margin:0 0 6px;font-size:22px;color:#1f2937">Pedido recebido!</h1>
        <p style="margin:0;font-size:14px;color:#6b7280">Olá ${this.escape(d.customerName.split(' ')[0])}, recebemos seu pedido <strong>${orderRef}</strong>.</p>
      </td></tr>
      ${paymentBlock}
      <tr><td style="padding:24px 32px 0">
        <h3 style="margin:0 0 10px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Resumo</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          ${this.renderItems(d.items)}
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#6b7280">Subtotal</td>
            <td style="padding:8px 0;font-size:13px;color:#6b7280;text-align:right">${this.fmt(subtotal)}</td>
          </tr>
          ${d.shippingCost ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#6b7280">Frete${d.shippingService ? ' (' + this.escape(d.shippingService) + ')' : ''}</td>
            <td style="padding:8px 0;font-size:13px;color:#6b7280;text-align:right">${this.fmt(d.shippingCost)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:14px 0 4px;font-size:15px;font-weight:600;border-top:2px solid #1f2937">Total</td>
            <td style="padding:14px 0 4px;font-size:15px;font-weight:600;border-top:2px solid #1f2937;text-align:right">${this.fmt(d.amount)}</td>
          </tr>
        </table>
      </td></tr>
      ${addressBlock}
      <tr><td style="padding:0 32px 32px">
        <p style="margin:0;font-size:13px;color:#6b7280">Você pode acompanhar o pedido pelo link:<br>
          <a href="#" style="color:${d.storeColor};font-weight:500">Acompanhar pedido ${orderRef}</a>
        </p>
      </td></tr>`;
    return this.wrapper(content, d);
  }

  private renderPaymentApproved(d: any): string {
    const orderRef = `#${String(d.orderId).padStart(5, '0')}`;
    const content = `
      <tr><td style="padding:36px 32px">
        <div style="background:#ecfdf5;padding:18px;border:1px solid #a7f3d0;border-radius:8px;margin-bottom:24px">
          <h1 style="margin:0 0 6px;font-size:22px;color:#065f46">✓ Pagamento confirmado!</h1>
          <p style="margin:0;font-size:14px;color:#047857">Seu pedido <strong>${orderRef}</strong> entrou em produção.</p>
        </div>
        <p style="margin:0 0 8px;font-size:14px;color:#1f2937">O que vem agora:</p>
        <ul style="margin:0 0 18px;padding-left:20px;font-size:14px;color:#374151;line-height:1.8">
          <li>Vamos imprimir e fazer o acabamento (1 a 3 dias úteis)</li>
          <li>Te avisamos quando despachar com o código de rastreio</li>
          <li>Você pode acompanhar o status pelo link "Meus pedidos"</li>
        </ul>
        <p style="margin:0;font-size:13px;color:#6b7280">Total pago: <strong style="color:#1f2937">${this.fmt(d.amount)}</strong></p>
      </td></tr>`;
    return this.wrapper(content, d);
  }

  private renderOrderCancelled(d: any): string {
    const orderRef = `#${String(d.orderId).padStart(5, '0')}`;
    const methodLabel = d.paymentMethod === 'PIX' ? 'PIX' : d.paymentMethod === 'BOLETO' ? 'boleto' : 'cartão';
    const reason = d.reason || (d.paymentMethod === 'PIX'
      ? 'O QR Code expirou antes do pagamento ser confirmado.'
      : d.paymentMethod === 'BOLETO'
      ? 'O boleto venceu antes do pagamento ser compensado.'
      : 'O pagamento foi recusado pela operadora do cartão.');

    const content = `
      <tr><td style="padding:36px 32px">
        <div style="background:#fef2f2;padding:18px;border:1px solid #fecaca;border-radius:8px;margin-bottom:24px">
          <h1 style="margin:0 0 6px;font-size:22px;color:#991b1b">Pagamento não confirmado</h1>
          <p style="margin:0;font-size:14px;color:#7f1d1d">Seu pedido <strong>${orderRef}</strong> foi cancelado porque não recebemos o pagamento.</p>
        </div>
        <p style="margin:0 0 8px;font-size:14px;color:#1f2937">Motivo:</p>
        <p style="margin:0 0 18px;padding:12px 14px;background:#f9fafb;border-left:3px solid #6b7280;font-size:14px;color:#374151">
          ${this.escape(reason)}
        </p>
        <p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.6">
          Não se preocupe — <strong>nada foi cobrado</strong>. Os produtos continuam disponíveis no nosso site se você quiser tentar de novo.
        </p>
        <p style="margin:0">
          <a href="#" style="display:inline-block;background:${d.storeColor};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">
            Voltar pra loja
          </a>
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#6b7280">
          Pagou pelo ${methodLabel} agora há pouco e quer revalidar? Responda este email com o comprovante e a gente verifica.
        </p>
      </td></tr>`;
    return this.wrapper(content, d);
  }

  private renderOrderShipped(d: any): string {
    const orderRef = `#${String(d.orderId).padStart(5, '0')}`;
    const content = `
      <tr><td style="padding:36px 32px">
        <h1 style="margin:0 0 6px;font-size:22px;color:#1f2937">Seu pedido foi enviado! 📦</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280">${orderRef} já está a caminho.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:18px;margin-bottom:18px">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Código de rastreio</div>
          <div style="font-family:monospace;font-size:18px;font-weight:600;color:#1f2937">${this.escape(d.trackingCode)}</div>
          ${d.carrier ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">via ${this.escape(d.carrier)}</div>` : ''}
        </div>
        <p style="margin:0;font-size:13px;color:#6b7280">Use o código acima no site da transportadora para acompanhar a entrega.</p>
      </td></tr>`;
    return this.wrapper(content, d);
  }

  private fmt(v: number): string {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  private escape(s: string): string {
    return String(s || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!));
  }
}
