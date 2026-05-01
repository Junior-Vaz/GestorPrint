import { BadRequestException, Body, Controller, Logger, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

interface ContactBody {
  name:    string;
  email:   string;
  phone?:  string;
  subject?: string;
  message: string;
  tenantId?: number; // opcional — quando a SPA já resolveu pelo hostname
}

/**
 * Endpoint público de formulário de contato. Substitui o uso de EmailJS na SPA.
 *
 * Email vai pro `publicEmail` configurado em Settings.storeConfig — o admin do
 * ERP define isso. Se não configurado, falha graciosamente (200 mas não envia)
 * pra não vazar a inexistência do email pro atacante.
 */
@Public()
@Controller('ecommerce/contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly prisma: PrismaService,
  ) {}

  // Rate limit estrito — formulário público é alvo natural de spam
  @Throttle({ short: { ttl: 60_000, limit: 3 }, long: { ttl: 3600_000, limit: 10 } })
  @Post()
  async send(
    @Body() body: ContactBody,
    @Query('tenantId') tenantIdQ?: string,
  ) {
    const tenantId = body.tenantId ?? (tenantIdQ ? parseInt(tenantIdQ, 10) : null);
    if (!tenantId) throw new BadRequestException('tenantId obrigatório');

    if (!body.name || !body.email || !body.message) {
      throw new BadRequestException('Nome, email e mensagem são obrigatórios');
    }
    // Validação básica de email (a aprofundada quem faz é o servidor SMTP)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      throw new BadRequestException('Email inválido');
    }

    const settings = await (this.prisma as any).settings.findUnique({
      where: { tenantId },
      select: { storeConfig: true, email: true, companyName: true },
    });
    const recipient =
      settings?.storeConfig?.publicEmail ||
      settings?.email;
    const storeName =
      settings?.storeConfig?.storeName ||
      settings?.companyName ||
      'Loja';

    if (!recipient) {
      // Settings ainda não configurado — log e retorna ok pra cliente final
      this.logger.warn(`Tenant ${tenantId}: contato recebido mas publicEmail não configurado`);
      return { ok: true };
    }

    const subject = body.subject?.trim()
      ? `[Contato] ${body.subject.trim()} — ${body.name}`
      : `[Contato] Mensagem do site — ${body.name}`;

    const html = this.renderEmail({
      storeName,
      name:    body.name.trim(),
      email:   body.email.trim(),
      phone:   body.phone?.trim() || '',
      subject: body.subject?.trim() || '(sem assunto)',
      message: body.message.trim(),
    });

    try {
      await this.messaging.sendEmail(recipient, subject, html, tenantId);
      return { ok: true };
    } catch (e: any) {
      this.logger.error(`Falha ao enviar contato: ${e.message}`);
      throw new BadRequestException('Não foi possível enviar a mensagem agora. Tente novamente mais tarde.');
    }
  }

  private renderEmail(d: {
    storeName: string;
    name: string; email: string; phone: string;
    subject: string; message: string;
  }): string {
    const escape = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#333">
        <h2 style="color:#1D9E75;border-bottom:2px solid #1D9E75;padding-bottom:8px">
          Novo contato — ${escape(d.storeName)}
        </h2>
        <p style="color:#666;font-size:13px">
          Recebido pelo formulário de contato do seu site.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:6px 0;color:#666;width:90px">Nome</td>
              <td style="padding:6px 0"><strong>${escape(d.name)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Email</td>
              <td style="padding:6px 0"><a href="mailto:${escape(d.email)}">${escape(d.email)}</a></td></tr>
          ${d.phone ? `<tr><td style="padding:6px 0;color:#666">Telefone</td>
              <td style="padding:6px 0">${escape(d.phone)}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#666">Assunto</td>
              <td style="padding:6px 0">${escape(d.subject)}</td></tr>
        </table>
        <div style="margin-top:24px;padding:16px;background:#f8f9fa;border-left:3px solid #1D9E75;border-radius:4px">
          <strong style="display:block;margin-bottom:8px;color:#666;font-size:12px;text-transform:uppercase">Mensagem</strong>
          <div style="white-space:pre-wrap;line-height:1.5">${escape(d.message)}</div>
        </div>
        <p style="color:#999;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
          Responda diretamente pra <a href="mailto:${escape(d.email)}" style="color:#1D9E75">${escape(d.email)}</a> pra falar com o cliente.
        </p>
      </div>
    `;
  }
}
