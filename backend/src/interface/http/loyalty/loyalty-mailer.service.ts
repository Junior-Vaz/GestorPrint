import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';

/**
 * LoyaltyMailerService — emails transacionais do programa de fidelidade.
 *
 * Templates inline (sem partials externos) pra simplicidade — cada método
 * monta um HTML completo. Cor primária e nome da loja vêm de Settings.storeConfig.
 *
 * Falha silenciosa (try/catch + log): email não-essencial não pode derrubar
 * o fluxo principal (crédito de pontos, mudança de tier, etc).
 */
@Injectable()
export class LoyaltyMailerService {
  private readonly logger = new Logger(LoyaltyMailerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  /** Helper: busca branding (nome + cor) do tenant pra header dos emails */
  private async getBrand(tenantId: number) {
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    return {
      storeName:  settings?.storeConfig?.storeName || settings?.companyName || 'Sua loja',
      storeColor: settings?.storeConfig?.primaryColor || '#7c3aed',
    };
  }

  /** Wrapper HTML comum a todos os emails — header com cor da loja + footer simples. */
  private wrap(brand: { storeName: string; storeColor: string }, content: string): string {
    return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${brand.storeName}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#1e293b">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <tr><td style="background:${brand.storeColor};padding:20px 28px">
          <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.02em">${brand.storeName}</span>
        </td></tr>
        <tr><td style="padding:32px 28px">${content}</td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:11px;color:#64748b;text-align:center">
          Você recebeu este email porque é cliente da ${brand.storeName}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  // ─── 1. Pontos ganhos ─────────────────────────────────────────────────────

  /**
   * Envia notificação após `creditOrderEarnings` creditar pontos/cashback.
   * Inclui breakdown (pontos × multiplicador de tier) pra reforçar o benefício
   * do tier — gatilho psicológico pra cliente continuar comprando.
   */
  async sendPointsEarned(tenantId: number, opts: {
    email: string; name: string; orderId: number; orderAmount: number;
    points: number; cashback: number; tier: string | null; multiplier: number;
    newBalance: number; newCashbackBalance: number; pointsValue: number;
  }) {
    if (!opts.email || (opts.points <= 0 && opts.cashback <= 0)) return;
    const brand = await this.getBrand(tenantId);

    const lines: string[] = [];
    if (opts.points > 0) {
      const tierBadge = opts.tier && opts.multiplier > 1
        ? ` <span style="color:#7c3aed;font-size:13px">(×${opts.multiplier} ${opts.tier})</span>` : '';
      lines.push(`<li style="padding:6px 0">⭐ <strong>+${opts.points.toLocaleString('pt-BR')} pontos</strong>${tierBadge}</li>`);
    }
    if (opts.cashback > 0) {
      lines.push(`<li style="padding:6px 0">💵 <strong>+R$ ${opts.cashback.toFixed(2).replace('.', ',')} de cashback</strong></li>`);
    }

    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:#1e293b">Olá, ${opts.name.split(' ')[0]}! 👋</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#475569">
        Boa notícia: seu pedido <strong>#${String(opts.orderId).padStart(5, '0')}</strong>
        (R$ ${opts.orderAmount.toFixed(2).replace('.', ',')}) gerou benefícios pra você:
      </p>
      <ul style="margin:0 0 24px;padding:16px 20px;background:#f1f5f9;border-radius:6px;list-style:none">${lines.join('')}</ul>
      <div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:6px;padding:16px;margin-bottom:20px">
        <div style="font-size:12px;color:#6d28d9;text-transform:uppercase;letter-spacing:.06em;font-weight:600">Saldo atual</div>
        <div style="margin-top:6px;font-size:18px;color:#1e293b">
          <strong>${opts.newBalance.toLocaleString('pt-BR')} pontos</strong>
          <span style="color:#64748b;font-size:13px">≈ R$ ${opts.pointsValue.toFixed(2).replace('.', ',')}</span>
          ${opts.newCashbackBalance > 0 ? `<br><strong>R$ ${opts.newCashbackBalance.toFixed(2).replace('.', ',')}</strong> <span style="color:#64748b;font-size:13px">de cashback</span>` : ''}
        </div>
      </div>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">
        Use seu saldo no próximo pedido pra ganhar desconto direto no checkout.
      </p>`;

    try {
      await this.messaging.sendEmail(opts.email, `Você ganhou pontos — pedido #${opts.orderId}`, this.wrap(brand, content), tenantId);
    } catch (e: any) {
      this.logger.warn(`Email pontos-ganhos falhou (cliente=${opts.email}): ${e.message}`);
    }
  }

  // ─── 2. Tier promovido ────────────────────────────────────────────────────

  /**
   * Quando o cliente sobe de tier (BRONZE→SILVER, etc). Mensagem celebratória
   * + lista os benefícios do novo tier (desconto + multiplicador).
   */
  async sendTierPromoted(tenantId: number, opts: {
    email: string; name: string; oldTier: string | null; newTier: string;
    discount: number; multiplier: number;
  }) {
    if (!opts.email) return;
    const brand = await this.getBrand(tenantId);

    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:#1e293b">Parabéns, ${opts.name.split(' ')[0]}! 🎉</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#475569">
        Você acabou de subir pro nível <strong style="color:${brand.storeColor};font-size:18px;letter-spacing:.05em">${opts.newTier}</strong>${opts.oldTier ? ` (era ${opts.oldTier})` : ''}.
        Isso significa benefícios novos a partir de agora:
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:20px;margin-bottom:20px">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${opts.discount > 0 ? `<tr><td style="padding:8px 0">🏷️ <strong>${opts.discount}% de desconto</strong> em todo pedido</td></tr>` : ''}
          ${opts.multiplier > 1 ? `<tr><td style="padding:8px 0">⭐ <strong>${opts.multiplier}× pontos</strong> ganhos por compra</td></tr>` : ''}
        </table>
      </div>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">
        Continue comprando pra acumular ainda mais. Seu nível é recalculado mensalmente
        com base nos seus gastos dos últimos 12 meses.
      </p>`;

    try {
      await this.messaging.sendEmail(opts.email, `Você subiu pra ${opts.newTier}!`, this.wrap(brand, content), tenantId);
    } catch (e: any) {
      this.logger.warn(`Email tier-up falhou: ${e.message}`);
    }
  }

  // ─── 3. Pontos vão expirar ────────────────────────────────────────────────

  /**
   * Disparado pelo cron diário (avisa 7 dias antes da expiração mais próxima).
   * Agrupa pontos + cashback expirando do mesmo cliente num único email.
   */
  async sendPointsExpiringSoon(tenantId: number, opts: {
    email: string; name: string; points: number; cashback: number;
    expiresAt: Date; pointsValue: number;
  }) {
    if (!opts.email || (opts.points <= 0 && opts.cashback <= 0)) return;
    const brand = await this.getBrand(tenantId);

    const dateStr = opts.expiresAt.toLocaleDateString('pt-BR');
    const items: string[] = [];
    if (opts.points > 0) items.push(`<strong>${opts.points.toLocaleString('pt-BR')} pontos</strong> (≈ R$ ${opts.pointsValue.toFixed(2).replace('.', ',')})`);
    if (opts.cashback > 0) items.push(`<strong>R$ ${opts.cashback.toFixed(2).replace('.', ',')}</strong> de cashback`);

    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:#1e293b">Não deixe vencer, ${opts.name.split(' ')[0]}!</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#475569">
        Você tem ${items.join(' + ')} que vão <strong style="color:#dc2626">expirar em ${dateStr}</strong>.
      </p>
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:16px;margin-bottom:20px">
        <p style="margin:0;font-size:14px;color:#78350f;line-height:1.5">
          Faça um pedido antes da data limite e use seu saldo direto no checkout pra ganhar
          desconto. É rápido — basta acumular o que você quer e usar a opção "Usar pontos / cashback"
          na tela de finalização.
        </p>
      </div>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">
        Se preferir não receber esses lembretes, fale com a gente.
      </p>`;

    try {
      await this.messaging.sendEmail(opts.email, `Seus pontos expiram em ${dateStr}`, this.wrap(brand, content), tenantId);
    } catch (e: any) {
      this.logger.warn(`Email expiração falhou: ${e.message}`);
    }
  }

  // ─── 4. Indicação convertida ──────────────────────────────────────────────

  /**
   * Avisa quem indicou que o indicado finalmente fez a 1ª compra paga e o
   * bônus foi liberado. Reforça o comportamento de indicação ("compartilhar = ganhar").
   */
  async sendReferralConverted(tenantId: number, opts: {
    email: string; name: string; referredCustomerName: string;
    bonusPoints: number; bonusCashback: number; newBalance: number;
  }) {
    if (!opts.email) return;
    const brand = await this.getBrand(tenantId);

    const bonusLine: string[] = [];
    if (opts.bonusPoints > 0) bonusLine.push(`<strong>${opts.bonusPoints} pontos</strong>`);
    if (opts.bonusCashback > 0) bonusLine.push(`<strong>R$ ${opts.bonusCashback.toFixed(2).replace('.', ',')} de cashback</strong>`);

    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:#1e293b">Sua indicação rendeu, ${opts.name.split(' ')[0]}! 🤝</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#475569">
        <strong>${opts.referredCustomerName.split(' ')[0]}</strong> usou seu código e fez a 1ª compra.
        Como prometido, seu bônus foi liberado:
      </p>
      <div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:6px;padding:20px;margin-bottom:20px;text-align:center">
        <div style="font-size:12px;color:#6d28d9;text-transform:uppercase;letter-spacing:.06em;font-weight:600">Você ganhou</div>
        <div style="margin-top:8px;font-size:20px;color:#1e293b;line-height:1.4">
          + ${bonusLine.join(' + ')}
        </div>
        <div style="margin-top:12px;font-size:13px;color:#64748b">
          Saldo atualizado: <strong>${opts.newBalance.toLocaleString('pt-BR')} pontos</strong>
        </div>
      </div>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">
        Continue indicando! Cada amigo que comprar pela 1ª vez te dá mais bônus.
      </p>`;

    try {
      await this.messaging.sendEmail(opts.email, `Sua indicação rendeu bônus 🎁`, this.wrap(brand, content), tenantId);
    } catch (e: any) {
      this.logger.warn(`Email referral-converted falhou: ${e.message}`);
    }
  }
}
