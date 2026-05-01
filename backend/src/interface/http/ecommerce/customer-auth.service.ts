import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { MessagingService } from '../messaging/messaging.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { resolveJwtSecret } from '../../../shared/jwt-secret';

export interface CustomerJwtPayload {
  sub:       number;   // customerId
  tenantId:  number;
  email:     string;
  type:      'customer';
}

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly loyalty: LoyaltyService,
  ) {}

  private getSecret(): string {
    return resolveJwtSecret();
  }

  private signToken(customer: { id: number; tenantId: number; email: string }): string {
    const payload: CustomerJwtPayload = {
      sub:      customer.id,
      tenantId: customer.tenantId,
      email:    customer.email,
      type:     'customer',
    };
    return jwt.sign(payload, this.getSecret(), { expiresIn: '30d' });
  }

  verifyToken(token: string): CustomerJwtPayload {
    try {
      const decoded = jwt.verify(token, this.getSecret()) as any;
      if (decoded?.type !== 'customer') throw new Error('not_customer_token');
      return decoded as CustomerJwtPayload;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  async register(input: {
    tenantId: number;
    name: string;
    email: string;
    password: string;
    phone?: string;
    document?: string;
    storeUrl?: string;
    // Programa de fidelidade — código de indicação que o user digitou no signup.
    // Opcional. Se inválido, não bloqueia o cadastro (loga e ignora) — UX
    // intencional: cliente novo não quer ver erro genérico de "código errado".
    referralCode?: string;
  }) {
    if (!input.email || !input.password) throw new BadRequestException('Email e senha obrigatórios');
    if (input.password.length < 6) throw new BadRequestException('Senha precisa de pelo menos 6 caracteres');

    // Normaliza document — remove não-dígitos e converte vazio em null
    // (Prisma trata múltiplos NULLs como permitidos no unique compound)
    const cleanDocument = (input.document || '').replace(/\D/g, '');
    const documentValue = cleanDocument.length > 0 ? cleanDocument : null;
    const cleanPhone    = (input.phone || '').replace(/\D/g, '') || null;

    // Procura por email OU document — qualquer um que casar é o "existente"
    let existing = await (this.prisma as any).customer.findFirst({
      where: { tenantId: input.tenantId, email: input.email },
    });
    if (!existing && documentValue) {
      existing = await (this.prisma as any).customer.findFirst({
        where: { tenantId: input.tenantId, document: documentValue },
      });
    }

    // Se já tem senha definida, é uma conta ativa — não pode recadastrar
    if (existing?.passwordHash) {
      if (existing.email === input.email) {
        throw new BadRequestException('Email já cadastrado — faça login');
      }
      throw new BadRequestException('CPF/CNPJ já cadastrado em outra conta. Faça login com o email correto ou recupere a senha.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const customer = existing
      ? await (this.prisma as any).customer.update({
          where: { id: existing.id },
          data:  {
            passwordHash,
            name:                   input.name,
            email:                  input.email,
            phone:                  cleanPhone,
            document:               documentValue,
            emailVerificationToken: verificationToken,
            emailVerified:          false,
          },
        })
      : await (this.prisma as any).customer.create({
          data: {
            tenantId: input.tenantId,
            name:     input.name,
            email:    input.email,
            phone:    cleanPhone,
            document: documentValue,
            passwordHash,
            emailVerificationToken: verificationToken,
            emailVerified: false,
          },
        });

    // Dispara email de verificação (não bloqueia a resposta)
    this.sendVerificationEmail(input.tenantId, customer, verificationToken, input.storeUrl).catch(() => {});

    // Programa de fidelidade: vincula o referrer (quem indicou) se o código
    // for válido. Bônus só é creditado depois da 1ª compra paga (anti-fraude),
    // tratado em LoyaltyService.maybeReleaseReferralBonus dentro do hook de Order.
    if (input.referralCode && input.referralCode.trim()) {
      this.loyalty.applyReferralCode(input.tenantId, customer.id, input.referralCode.trim().toUpperCase())
        .catch((err) => {
          // Falha não derruba cadastro — código inválido é UX problem, não bug.
          // Em dev mostra warning pra debug; em prod fica silencioso.
          console.warn(`[register] referral inválido (${input.referralCode}): ${err.message}`);
        });
    }

    const token = this.signToken(customer);
    return { token, customer: this.sanitize(customer) };
  }

  /** Endpoint de verificação — clicado no link do email */
  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException('Token obrigatório');
    const customer = await (this.prisma as any).customer.findFirst({
      where: { emailVerificationToken: token },
    });
    if (!customer) throw new BadRequestException('Link inválido ou já utilizado');

    await (this.prisma as any).customer.update({
      where: { id: customer.id },
      data:  { emailVerified: true, emailVerificationToken: null },
    });
    return { ok: true, message: 'Email confirmado com sucesso!' };
  }

  /** Reenvio do email de verificação (cliente logado clica em "reenviar") */
  async resendVerification(customerId: number, storeUrl?: string) {
    const customer = await (this.prisma as any).customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new BadRequestException('Cliente não encontrado');
    if (customer.emailVerified) {
      return { ok: true, alreadyVerified: true, message: 'Email já está verificado' };
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    await (this.prisma as any).customer.update({
      where: { id: customerId },
      data:  { emailVerificationToken: newToken },
    });
    await this.sendVerificationEmail(customer.tenantId, customer, newToken, storeUrl).catch(() => {});
    return { ok: true, message: 'Email de verificação reenviado' };
  }

  private async sendVerificationEmail(tenantId: number, customer: any, token: string, storeUrlOverride?: string) {
    if (!customer?.email) return;
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const storeName = settings?.storeConfig?.storeName || settings?.companyName || 'Loja';
    const storeColor = settings?.storeConfig?.primaryColor || '#1D9E75';
    const storeUrl = storeUrlOverride || settings?.storeConfig?.storeUrl || '';
    const verifyLink = `${storeUrl}/verificar-email?token=${token}`;

    const html = this.renderVerificationEmail({ storeName, storeColor, verifyLink, customerName: customer.name });
    try {
      await this.messaging.sendEmail(
        customer.email,
        `Confirme seu email — ${storeName}`,
        html,
        tenantId,
      );
    } catch (e: any) {
      this.logger.error(`Falha ao enviar email de verificação: ${e.message}`);
    }
  }

  private renderVerificationEmail(d: { storeName: string; storeColor: string; verifyLink: string; customerName: string }): string {
    return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px">
        <tr><td style="padding:28px 32px;background:${d.storeColor};color:#ffffff">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.85">${this.escape(d.storeName)}</div>
        </td></tr>
        <tr><td style="padding:36px 32px">
          <h1 style="margin:0 0 14px;font-size:22px;color:#1f2937">Confirme seu email</h1>
          <p style="margin:0 0 18px;font-size:14px;color:#4b5563;line-height:1.6">
            Olá ${this.escape((d.customerName || 'cliente').split(' ')[0])}, falta só um clique pra ativar sua conta na <strong>${this.escape(d.storeName)}</strong>.
          </p>
          <p style="margin:0 0 28px">
            <a href="${d.verifyLink}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Confirmar email</a>
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6">
            Não criou conta na ${this.escape(d.storeName)}? Pode ignorar — sem confirmação a conta não é ativada.
          </p>
          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e7eb">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5">
              Não consegue clicar? Cole no navegador:<br><span style="word-break:break-all">${d.verifyLink}</span>
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center">
          © ${new Date().getFullYear()} ${this.escape(d.storeName)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  async login(input: { tenantId: number; email: string; password: string }) {
    const customer = await (this.prisma as any).customer.findFirst({
      where: { tenantId: input.tenantId, email: input.email },
    });
    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }
    const ok = await bcrypt.compare(input.password, customer.passwordHash);
    if (!ok) throw new UnauthorizedException('Email ou senha incorretos');

    const token = this.signToken(customer);
    return { token, customer: this.sanitize(customer) };
  }

  async getProfile(customerId: number) {
    const customer = await (this.prisma as any).customer.findUnique({
      where: { id: customerId },
      include: { storeAddresses: { orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] } },
    });
    return customer ? this.sanitize(customer) : null;
  }

  async updateProfile(customerId: number, data: any) {
    const allowed = ['name', 'phone', 'document'];
    const patch: any = {};
    for (const k of allowed) if (data[k] !== undefined) patch[k] = data[k];
    const updated = await (this.prisma as any).customer.update({
      where: { id: customerId },
      data:  patch,
    });
    return this.sanitize(updated);
  }

  async changePassword(customerId: number, current: string, next: string) {
    if (!next || next.length < 6) throw new BadRequestException('Nova senha precisa de pelo menos 6 caracteres');
    const customer = await (this.prisma as any).customer.findUnique({ where: { id: customerId } });
    if (!customer?.passwordHash) throw new BadRequestException('Conta sem senha definida');
    const ok = await bcrypt.compare(current, customer.passwordHash);
    if (!ok) throw new UnauthorizedException('Senha atual incorreta');
    const passwordHash = await bcrypt.hash(next, 10);
    await (this.prisma as any).customer.update({
      where: { id: customerId },
      data:  { passwordHash },
    });
    return { ok: true };
  }

  /**
   * Inicia recuperação de senha. Gera token único, salva expiração de 1h, envia email
   * com link `<storeUrl>/redefinir-senha?token=<token>`.
   * Por segurança, NUNCA revela se o email existe ou não — sempre retorna sucesso.
   */
  async forgotPassword(input: { tenantId: number; email: string; storeUrl?: string }) {
    if (!input.email) throw new BadRequestException('Email obrigatório');

    const customer = await (this.prisma as any).customer.findFirst({
      where: { tenantId: input.tenantId, email: input.email },
    });

    if (customer) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await (this.prisma as any).customer.update({
        where: { id: customer.id },
        data:  { passwordResetToken: token, passwordResetExpires: expires },
      });

      // Carrega settings pra montar o email
      const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId: input.tenantId } });
      const storeName = settings?.storeConfig?.storeName || settings?.companyName || 'Loja';
      const storeColor = settings?.storeConfig?.primaryColor || '#1D9E75';
      const baseUrl = input.storeUrl || settings?.storeConfig?.storeUrl || '';
      const resetLink = `${baseUrl}/redefinir-senha?token=${token}`;

      const html = this.renderResetEmail({ storeName, storeColor, resetLink, customerName: customer.name });

      try {
        await this.messaging.sendEmail(
          customer.email,
          `Redefinir senha — ${storeName}`,
          html,
          input.tenantId,
        );
      } catch (e: any) {
        this.logger.error(`Falha ao enviar email de reset: ${e.message}`);
      }
    }

    // Sempre retorna o mesmo resultado — não vaza se o email existe
    return { ok: true, message: 'Se o email estiver cadastrado, você receberá as instruções em alguns minutos.' };
  }

  /** Redefine a senha usando o token recebido no email. */
  async resetPassword(input: { token: string; newPassword: string }) {
    if (!input.token) throw new BadRequestException('Token obrigatório');
    if (!input.newPassword || input.newPassword.length < 6) {
      throw new BadRequestException('Senha precisa de pelo menos 6 caracteres');
    }

    const customer = await (this.prisma as any).customer.findFirst({
      where: { passwordResetToken: input.token },
    });

    if (!customer || !customer.passwordResetExpires || customer.passwordResetExpires < new Date()) {
      throw new BadRequestException('Link expirado ou inválido. Solicite uma nova recuperação.');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await (this.prisma as any).customer.update({
      where: { id: customer.id },
      data:  {
        passwordHash,
        passwordResetToken:   null,
        passwordResetExpires: null,
      },
    });

    return { ok: true, message: 'Senha redefinida com sucesso. Faça login com a nova senha.' };
  }

  private renderResetEmail(d: { storeName: string; storeColor: string; resetLink: string; customerName: string }): string {
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px">
        <tr><td style="padding:28px 32px;background:${d.storeColor};color:#ffffff">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.85">${this.escape(d.storeName)}</div>
        </td></tr>
        <tr><td style="padding:36px 32px">
          <h1 style="margin:0 0 14px;font-size:22px;color:#1f2937">Redefinir sua senha</h1>
          <p style="margin:0 0 18px;font-size:14px;color:#4b5563;line-height:1.6">
            Olá ${this.escape(d.customerName?.split(' ')[0] || 'cliente')}, recebemos um pedido pra redefinir a senha da sua conta.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6">
            Clique no botão abaixo pra criar uma nova senha. O link é válido por <strong>1 hora</strong>.
          </p>
          <p style="margin:0 0 28px">
            <a href="${d.resetLink}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">
              Redefinir senha
            </a>
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6">
            Se você não pediu pra trocar sua senha, ignore este email — sua senha continua a mesma.
          </p>
          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e7eb">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5">
              Não consegue clicar no botão? Copie e cole este link no navegador:<br>
              <span style="word-break:break-all">${d.resetLink}</span>
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center">
          © ${new Date().getFullYear()} ${this.escape(d.storeName)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private escape(s: string): string {
    return String(s || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  private sanitize(customer: any) {
    const { passwordHash: _ph, passwordResetToken: _t, passwordResetExpires: _e, emailVerificationToken: _v, ...rest } = customer;
    return rest;
  }
}
