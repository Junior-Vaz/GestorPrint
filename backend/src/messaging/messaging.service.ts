import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private prisma: PrismaService) {}

  private async getTransporter(tenantId = 1) {
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });

    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
      this.logger.warn(`SMTP not configured for tenant ${tenantId}. Emails will not be sent.`);
      return null;
    }

    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort ?? 587,
      secure: settings.smtpSecure ?? false,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });
  }

  async sendEmail(to: string, subject: string, body: string, tenantId = 1) {
    const transporter = await this.getTransporter(tenantId);
    if (!transporter) return;

    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const fromName = settings?.companyName || 'GestorPrint';
    const fromEmail = settings?.smtpUser || 'no-reply@gestorprint.com';

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html: body,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Error sending email to ${to}:`, error);
    }
  }

  async notifyOrderStatus(orderId: number, status: string) {
    const order = await (this.prisma as any).order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order || !order.customer?.email) return;

    const tenantId = order.tenantId ?? 1;
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const companyName = settings?.companyName || 'GestorPrint';
    const customerName = order.customer.name;
    const orderNumber = order.id;
    const orderAmount = Number(order.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const template = this.buildEmailTemplate(companyName);

    let subject = '';
    let content = '';

    switch (status) {
      case 'PRODUCTION':
        subject = `Pedido #${orderNumber} entrou em Produção 🚀`;
        content = `
          <h2 style="color:#4f46e5;margin:0 0 12px">Seu pedido está em produção!</h2>
          <p style="color:#334155;margin:0 0 16px">Olá, <strong>${customerName}</strong>!</p>
          <p style="color:#334155;margin:0 0 16px">
            Seu pedido <strong>#${orderNumber}</strong> (${orderAmount}) acaba de entrar em produção.
            Nossa equipe está trabalhando com todo cuidado para entregar o melhor resultado.
          </p>
          <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:12px 16px;border-radius:4px;margin:0 0 16px">
            <p style="margin:0;color:#0369a1;font-size:14px">
              📦 Status: <strong>Em Produção</strong>
            </p>
          </div>
          <p style="color:#64748b;font-size:14px;margin:0">Em breve você receberá novas atualizações.</p>
        `;
        break;

      case 'COMPLETED':
        subject = `Pedido #${orderNumber} está Pronto para Retirada! ✅`;
        content = `
          <h2 style="color:#10b981;margin:0 0 12px">Seu pedido está pronto!</h2>
          <p style="color:#334155;margin:0 0 16px">Olá, <strong>${customerName}</strong>!</p>
          <p style="color:#334155;margin:0 0 16px">
            Boas notícias! Seu pedido <strong>#${orderNumber}</strong> (${orderAmount}) está finalizado
            e pronto para retirada.
          </p>
          <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:4px;margin:0 0 16px">
            <p style="margin:0;color:#15803d;font-size:14px">
              ✅ Status: <strong>Pronto para Retirada</strong>
            </p>
          </div>
          <p style="color:#64748b;font-size:14px;margin:0">Entre em contato conosco para combinar a entrega ou retirada.</p>
        `;
        break;

      case 'DELIVERED':
        subject = `Pedido #${orderNumber} Entregue! Obrigado pela preferência 🙏`;
        content = `
          <h2 style="color:#6366f1;margin:0 0 12px">Pedido entregue com sucesso!</h2>
          <p style="color:#334155;margin:0 0 16px">Olá, <strong>${customerName}</strong>!</p>
          <p style="color:#334155;margin:0 0 16px">
            Confirmamos a entrega do seu pedido <strong>#${orderNumber}</strong> (${orderAmount}).
            Agradecemos por confiar no nosso trabalho!
          </p>
          <div style="background:#faf5ff;border-left:4px solid #8b5cf6;padding:12px 16px;border-radius:4px;margin:0 0 16px">
            <p style="margin:0;color:#6d28d9;font-size:14px">
              🎉 Status: <strong>Entregue</strong>
            </p>
          </div>
          <p style="color:#64748b;font-size:14px;margin:0">Ficamos felizes em atendê-lo. Até a próxima!</p>
        `;
        break;

      case 'CANCELLED':
        subject = `Pedido #${orderNumber} Cancelado`;
        content = `
          <h2 style="color:#ef4444;margin:0 0 12px">Pedido cancelado</h2>
          <p style="color:#334155;margin:0 0 16px">Olá, <strong>${customerName}</strong>!</p>
          <p style="color:#334155;margin:0 0 16px">
            Informamos que o pedido <strong>#${orderNumber}</strong> (${orderAmount}) foi cancelado.
          </p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin:0 0 16px">
            <p style="margin:0;color:#991b1b;font-size:14px">
              ❌ Status: <strong>Cancelado</strong>
            </p>
          </div>
          <p style="color:#64748b;font-size:14px;margin:0">
            Em caso de dúvidas, entre em contato com nossa equipe.
          </p>
        `;
        break;
    }

    if (subject && content) {
      const html = template(content);
      await this.sendEmail(order.customer.email, subject, html, tenantId);
    }
  }

  private buildEmailTemplate(companyName: string) {
    return (content: string) => `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

                <!-- Header -->
                <tr>
                  <td style="background:#4f46e5;padding:28px 32px;border-radius:12px 12px 0 0">
                    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px">
                      ${companyName}
                    </h1>
                    <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px">Sistema de Gestão para Gráficas</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
                    ${content}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f1f5f9;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
                    <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center">
                      Este é um e-mail automático enviado por ${companyName} via GestorPrint.
                      Por favor, não responda diretamente a este e-mail.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
