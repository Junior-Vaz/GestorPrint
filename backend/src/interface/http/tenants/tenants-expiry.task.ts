import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { PlatformSettingsService } from '../../../shared/platform-settings.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class TenantsExpiryTask {
  private readonly logger = new Logger(TenantsExpiryTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  // Roda todo dia às 02:00 (horário do servidor)
  @Cron('0 2 * * *')
  async handleExpiry() {
    this.logger.log('Running trial/plan expiry check...');
    const now = new Date();

    await this.suspendExpiredTrials(now);
    await this.suspendExpiredPlans(now);
    await this.warnExpiringTrials(now);
  }

  // ─── Suspender trials vencidos ──────────────────────────────────────────────
  private async suspendExpiredTrials(now: Date) {
    const expired = await (this.prisma as any).tenant.findMany({
      where: {
        planStatus: 'TRIAL',
        trialEndsAt: { lt: now },
        isActive: true,
      },
    });

    for (const tenant of expired) {
      await (this.prisma as any).tenant.update({
        where: { id: tenant.id },
        data: { planStatus: 'SUSPENDED', isActive: false },
      });
      this.logger.warn(`Trial expired → tenant ${tenant.id} (${tenant.name}) suspended`);
      await this.sendEmail(
        tenant.ownerEmail,
        `[GestorPrint] Seu período de trial encerrou — ${tenant.name}`,
        `Olá ${tenant.ownerName || tenant.name},\n\nSeu período de trial no GestorPrint encerrou e sua conta foi temporariamente suspensa.\n\nEntre em contato conosco para continuar utilizando o sistema ou assinar um plano.\n\nAtenciosamente,\nEquipe GestorPrint`,
      );
    }

    if (expired.length > 0) {
      this.logger.log(`Suspended ${expired.length} expired trial(s)`);
    }
  }

  // ─── Suspender planos vencidos ──────────────────────────────────────────────
  private async suspendExpiredPlans(now: Date) {
    const expired = await (this.prisma as any).tenant.findMany({
      where: {
        planStatus: 'ACTIVE',
        planExpiresAt: { lt: now, not: null },
        isActive: true,
      },
    });

    for (const tenant of expired) {
      await (this.prisma as any).tenant.update({
        where: { id: tenant.id },
        data: { planStatus: 'SUSPENDED', isActive: false },
      });
      this.logger.warn(`Plan expired → tenant ${tenant.id} (${tenant.name}) suspended`);
      await this.sendEmail(
        tenant.ownerEmail,
        `[GestorPrint] Seu plano expirou — ${tenant.name}`,
        `Olá ${tenant.ownerName || tenant.name},\n\nSeu plano GestorPrint expirou e sua conta foi temporariamente suspensa.\n\nPara reativar, entre em contato com nossa equipe ou renove sua assinatura.\n\nAtenciosamente,\nEquipe GestorPrint`,
      );
    }

    if (expired.length > 0) {
      this.logger.log(`Suspended ${expired.length} expired plan(s)`);
    }
  }

  // ─── Avisar trials próximos de expirar (3 dias) ─────────────────────────────
  private async warnExpiringTrials(now: Date) {
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const expiring = await (this.prisma as any).tenant.findMany({
      where: {
        planStatus: 'TRIAL',
        isActive: true,
        trialEndsAt: { gte: now, lte: in3Days },
      },
    });

    for (const tenant of expiring) {
      const expiresAt = new Date(tenant.trialEndsAt);
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      this.logger.log(`Trial warning: tenant ${tenant.id} (${tenant.name}) expires in ${daysLeft} day(s)`);
      await this.sendEmail(
        tenant.ownerEmail,
        `[GestorPrint] Seu trial expira em ${daysLeft} dia(s) — ${tenant.name}`,
        `Olá ${tenant.ownerName || tenant.name},\n\nSeu período de trial no GestorPrint expira em ${daysLeft} dia(s) (${expiresAt.toLocaleDateString('pt-BR')}).\n\nPara continuar utilizando sem interrupção, entre em contato conosco e assine um plano.\n\nAtenciosamente,\nEquipe GestorPrint`,
      );
    }

    if (expiring.length > 0) {
      this.logger.log(`Sent ${expiring.length} trial expiry warning(s)`);
    }
  }

  // ─── Envio de email via SMTP configurado ────────────────────────────────────
  private async sendEmail(to: string | undefined, subject: string, text: string) {
    if (!to) return;
    const host = await this.platformSettings.get('smtpHost');
    if (!host) return;
    const port = await this.platformSettings.getNumber('smtpPort', 587);
    const user = await this.platformSettings.get('smtpUser');
    const pass = await this.platformSettings.get('smtpPass');
    const from = (await this.platformSettings.get('smtpFrom')) || user;

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: { user, pass },
      });

      await transporter.sendMail({ from, to, subject, text });

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err}`);
    }
  }
}
