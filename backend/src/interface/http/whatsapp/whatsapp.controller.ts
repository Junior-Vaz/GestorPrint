import {
  Controller, Post, Body, Headers, Query, HttpCode, HttpStatus,
  UnauthorizedException, Logger, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { WhatsappService } from './whatsapp.service';
import { McpService } from '../mcp/mcp.service';

/**
 * WhatsappController — recebe webhook da Evolution API e dispara o agente.
 *
 * O webhook é público (Evolution chama de fora), mas validamos via token
 * configurado em WHATSAPP_WEBHOOK_TOKEN. Se vazio, aceita tudo (modo dev).
 *
 * Multi-tenancy: o webhook traz o `instance` da Evolution; resolvemos pra
 * tenantId via AiConfig.evolutionInstance.
 */
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  // Idempotência — Evolution às vezes manda o mesmo messageId 2x
  private processedMessages = new Map<string, number>();
  private readonly MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly MESSAGE_CLEANUP_THRESHOLD = 1000;

  // Cache de tenantId por instance (evita query a cada msg)
  private tenantCache = new Map<string, { tenantId: number; ts: number }>();
  private readonly TENANT_CACHE_TTL_MS = 60_000;

  constructor(
    private readonly whatsapp:   WhatsappService,
    private readonly mcpService: McpService,
  ) {}

  /**
   * Endpoint chamado pela Evolution quando uma mensagem chega.
   * Sempre retorna 200 — Evolution faz retry agressivo se receber !=2xx.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  async webhook(
    @Body() body: any,
    @Headers('x-webhook-token') tokenHeader: string | undefined,
    @Query('token') tokenQuery: string | undefined,
    @Req() req: Request,
  ) {
    if (!this.validateToken(tokenHeader || tokenQuery)) {
      this.logger.warn(`Webhook rejeitado: token inválido (ip=${req.ip})`);
      throw new UnauthorizedException();
    }

    const event = body?.event;
    const data  = body?.data;

    // Só processa msgs novas vindas de fora (não fromMe)
    if (event !== 'messages.upsert' || data?.key?.fromMe) return { ok: true };

    const contact: string | undefined   = data?.key?.remoteJid;
    const messageId: string | undefined = data?.key?.id;
    const message = data?.message;
    if (!contact || !message) return { ok: true };

    if (messageId && !this.markAsProcessed(messageId)) {
      this.logger.debug(`msg duplicada ignorada (id=${messageId})`);
      return { ok: true };
    }

    const text: string | undefined =
      message?.conversation || message?.extendedTextMessage?.text;
    const mediaType: 'image' | 'document' | null =
      message?.imageMessage ? 'image' : message?.documentMessage ? 'document' : null;
    if (!text && !mediaType) return { ok: true };

    const instance = this.extractInstanceName(body);
    const tenantId = await this.resolveTenantId(instance);
    if (!tenantId) {
      this.logger.warn(`Sem tenant pra mensagem (instance=${instance}), ignorando`);
      return { ok: true };
    }

    this.logger.log(
      `📨 tenant=${tenantId} from=${contact} type=${mediaType || 'text'} preview="${text?.slice(0, 60) || '(media)'}"`,
    );

    // Processa em background — webhook responde 200 imediatamente
    void this.handleAsync(tenantId, contact, text || '', message, mediaType);
    return { ok: true };
  }

  /**
   * Preview do agente — testar conversa pela UI sem mandar WhatsApp real.
   * Auth via JWT + role ADMIN — só admins configuram/testam IA.
   * tenantId vem do JWT, não do body (segurança).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('ai', 'create')
  @Post('preview')
  async preview(
    @Body() body: { sessionId?: string; message?: string; reset?: boolean },
    @CurrentTenant() tenantId: number,
  ) {
    const previewContact = `preview-${body.sessionId || 'default'}`;

    if (body.reset) {
      this.whatsapp.clearSession(tenantId, previewContact);
      return { response: null };
    }

    try {
      const response = await this.whatsapp.processMessage(
        tenantId, previewContact, body.message || '',
      );
      return { response: response || null };
    } catch (e: any) {
      this.logger.error(`Erro no preview: ${e.message}`);
      return { response: `Erro: ${e.message}` };
    }
  }

  /**
   * Envio direto via Evolution API. Operador clica "Enviar WhatsApp" no
   * Kanban/orçamento/pedido e dispara essa rota — sem abrir nova janela.
   *
   * Auth: ADMIN. Multi-tenancy via JWT.
   * Falha graciosa: se Evolution não está conectada, retorna 400 com
   * `{ ok: false, reason: 'NOT_CONFIGURED' }` pra UI fazer fallback wa.me.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @CanAccess('ai', 'create')
  @Post('send')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async send(
    @Body() body: { phone?: string; message?: string },
    @CurrentTenant() tenantId: number,
  ) {
    const phone   = String(body.phone   || '').trim();
    const message = String(body.message || '').trim();
    if (!phone || !message) {
      return { ok: false, reason: 'INVALID_INPUT', error: 'phone e message são obrigatórios' };
    }

    // Reusa a tool já existente do MCP (mesmo path do agente IA)
    const result = await this.mcpService.sendWhatsappMessage({ phone, message }, tenantId);

    if ((result as any)?.error) {
      const err = String((result as any).error);
      // Distingue "Evolution não configurada/conectada" pra UI cair pra wa.me
      const notConfigured = /n[aã]o configurad|n[aã]o conectad|sem (token|chave|instance)/i.test(err);
      return {
        ok: false,
        reason: notConfigured ? 'NOT_CONFIGURED' : 'SEND_FAILED',
        error:  err,
      };
    }
    return { ok: true, ...(result as any) };
  }

  // ── Privates ─────────────────────────────────────────────────────────────

  /** Processa msg + responde — async pra liberar o webhook na hora. */
  private async handleAsync(
    tenantId: number,
    contact: string,
    text: string,
    message: any,
    mediaType: 'image' | 'document' | null,
  ) {
    try {
      const cfg = await this.mcpService.getAiConfig(tenantId);
      if (!cfg?.enabled) return;

      let mediaData: { base64: string; mimetype: string } | undefined;
      if (mediaType && cfg.allowFileUploads) {
        mediaData = (await this.whatsapp.downloadMedia(tenantId, message, mediaType)) || undefined;
      }
      if (!text && !mediaData) return;

      const reply = await this.whatsapp.processMessage(tenantId, contact, text, mediaData);
      if (!reply) return;

      const ok = await this.whatsapp.sendText(tenantId, contact, reply);
      if (ok) {
        this.logger.log(`✉️  tenant=${tenantId} to=${contact} preview="${reply.slice(0, 80)}"`);
      }
    } catch (e: any) {
      this.logger.error(`erro async no webhook (tenant=${tenantId}): ${e.message}`);
    }
  }

  private validateToken(provided: string | undefined): boolean {
    const expected = process.env.WHATSAPP_WEBHOOK_TOKEN || process.env.WEBHOOK_TOKEN || '';
    if (!expected) return true; // dev mode
    return provided === expected;
  }

  private markAsProcessed(messageId: string): boolean {
    const now = Date.now();
    if (this.processedMessages.size > this.MESSAGE_CLEANUP_THRESHOLD) {
      for (const [id, ts] of this.processedMessages) {
        if (now - ts > this.MESSAGE_TTL_MS) this.processedMessages.delete(id);
      }
    }
    if (this.processedMessages.has(messageId)) return false;
    this.processedMessages.set(messageId, now);
    return true;
  }

  private extractInstanceName(body: any): string | undefined {
    return (
      body?.instance ?? body?.instanceName ?? body?.data?.instance ??
      body?.data?.instanceName ?? body?.sender ?? undefined
    );
  }

  private async resolveTenantId(instance: string | undefined): Promise<number | null> {
    if (!instance) return null;
    const cached = this.tenantCache.get(instance);
    if (cached && Date.now() - cached.ts < this.TENANT_CACHE_TTL_MS) return cached.tenantId;
    const result = await this.mcpService.getTenantByEvolutionInstance(instance);
    if (!result?.tenantId) return null;
    this.tenantCache.set(instance, { tenantId: result.tenantId, ts: Date.now() });
    return result.tenantId;
  }
}
