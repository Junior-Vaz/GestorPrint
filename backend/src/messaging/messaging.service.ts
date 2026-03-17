import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private prisma: PrismaService) {}

  private async getTransporter() {
    const settings = await (this.prisma as any).settings.findUnique({ where: { id: 1 } });
    
    if (!settings || !settings.smtpHost) {
      this.logger.warn('SMTP settings not configured. Emails will not be sent.');
      return null;
    }

    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });
  }

  async sendEmail(to: string, subject: string, body: string) {
    const transporter = await this.getTransporter();
    if (!transporter) return;

    try {
      await transporter.sendMail({
        from: '"GestorPrint" <no-reply@gestorprint.com>',
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

    const company = await (this.prisma as any).settings.findUnique({ where: { id: 1 } });
    const customerName = order.customer.name;
    const orderNumber = order.id;

    let subject = '';
    let body = '';

    switch (status) {
      case 'PRODUCTION':
        subject = `Pedido #${orderNumber} em Produção! 🚀`;
        body = `<h1>Olá, ${customerName}!</h1><p>Seu pedido <strong>#${orderNumber}</strong> já entrou em produção e estamos trabalhando com todo carinho nele.</p><p>Em breve você receberá novas atualizações.</p><p>Equipe ${company?.companyName || 'GestorPrint'}</p>`;
        break;
      case 'COMPLETED':
        subject = `Pedido #${orderNumber} Pronto para Retirada! ✅`;
        body = `<h1>Olá, ${customerName}!</h1><p>Boas notícias! Seu pedido <strong>#${orderNumber}</strong> está pronto e te esperando.</p><p>Você já pode vir retirá-lo ou aguardar o envio.</p><p>Equipe ${company?.companyName || 'GestorPrint'}</p>`;
        break;
    }

    if (subject && body) {
      await this.sendEmail(order.customer.email, subject, body);
    }
  }
}
