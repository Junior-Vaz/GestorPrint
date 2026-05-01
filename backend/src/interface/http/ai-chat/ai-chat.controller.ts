import {
  Controller, Post, Get, Patch, Delete, Body, Query, Param, UseGuards, Req, Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AiChatService } from './ai-chat.service';
import { McpService } from '../mcp/mcp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';

/** Defaults dos comandos rápidos do widget — usados quando AiConfig.quickCommands está vazio. */
const DEFAULT_QUICK_COMMANDS = [
  { icon: '📊', text: 'Me dá um resumo do dia (dashboard)' },
  { icon: '📋', text: 'Quais pedidos estão pendentes hoje?' },
  { icon: '💰', text: 'Resumo financeiro dos últimos 30 dias' },
  { icon: '🧾', text: 'Quais cobranças estão vencidas?' },
  { icon: '👥', text: 'Top 10 clientes do mês' },
  { icon: '📦', text: 'Produtos com estoque baixo' },
];

/**
 * Endpoints do chat IA do ERP — usado pelo AiChatWidget flutuante no Vue.
 *
 * Diferente de /mcp/rpc (consumido pelo ai-agent/), aqui o caller é um
 * operador autenticado via JWT.
 *
 * Rate limit por user: 30 msgs/min (defesa contra loops/abuso, separado do
 * rate limit do provider de IA).
 */
@Controller('ai-chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireFeature(FeatureKey.WHATSAPP_AI)
export class AiChatController {
  constructor(
    private readonly aiChat:     AiChatService,
    private readonly mcpService: McpService,
  ) {}

  /**
   * Comandos rápidos do widget (chips no estado vazio). Lê de AiConfig.quickCommands;
   * se vazio, devolve defaults. Endpoint leve, sem rate-limit pesado — chamado
   * 1x quando o widget abre.
   */
  @Get('quick-commands')
  @CanAccess('ai', 'view')
  async getQuickCommands(@CurrentTenant() tenantId: number) {
    const cfg = await this.mcpService.getAiConfig(tenantId);
    const custom = cfg?.quickCommands;
    if (Array.isArray(custom) && custom.length > 0) {
      return { commands: custom };
    }
    return { commands: DEFAULT_QUICK_COMMANDS };
  }

  /** Manda mensagem do operador pra IA (modo síncrono — fallback do stream). */
  @Post('message')
  @CanAccess('ai', 'create')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async sendMessage(
    @Body() body: { message: string; sessionId?: string },
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    const message = (body.message || '').trim();
    if (!message) throw new BadRequestException('Mensagem vazia.');

    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');

    const sessionId = body.sessionId || 'default';
    const reply = await this.aiChat.sendMessage(tenantId, userId, sessionId, message);
    void this.aiChat.touchSession(tenantId, userId, sessionId, message);
    return { reply, sessionId };
  }

  /**
   * Streaming SSE — eventos:
   *   {type: 'delta', text: '...'}            → pedaço de texto
   *   {type: 'tool-call', name: '...', args}  → IA chamou tool
   *   {type: 'tool-result', name, ok}         → tool terminou
   *   {type: 'done', text, usage}             → fim
   *   {type: 'error', message}                → erro
   *
   * O widget consome via fetch + ReadableStream.
   */
  @Post('message/stream')
  @CanAccess('ai', 'create')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async streamMessage(
    @Body() body: {
      message:    string;
      sessionId?: string;
      mediaData?: { base64: string; mimetype: string; filename?: string };
    },
    @CurrentTenant() tenantId: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const message = (body.message || '').trim();
    if (!message && !body.mediaData) throw new BadRequestException('Mensagem ou anexo obrigatório.');

    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');

    const sessionId = body.sessionId || 'default';

    // Headers SSE — text/event-stream + sem buffer/cache de proxy/CDN
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx/CDN: não bufferizar
    res.flushHeaders?.();

    void this.aiChat.touchSession(tenantId, userId, sessionId, message);

    try {
      for await (const evt of this.aiChat.streamMessage(tenantId, userId, sessionId, message, body.mediaData)) {
        res.write(`data: ${JSON.stringify(evt)}\n\n`);
      }
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: e?.message || 'Falha no stream' })}\n\n`);
    } finally {
      res.end();
    }
  }

  /**
   * Histórico persistido — usado pelo widget pra carregar conversa anterior
   * quando o operador volta. Limit default 50, max 200.
   */
  @Get('history')
  @CanAccess('ai', 'view')
  async getHistory(
    @Query('sessionId') sessionId: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');
    const limit = limitStr ? +limitStr : 50;
    const messages = await this.aiChat.getHistory(
      tenantId, userId, sessionId || 'default', limit,
    );
    return { messages };
  }

  /** Limpa histórico da sessão atual (memória + banco). */
  @Post('reset')
  @CanAccess('ai', 'edit')
  async reset(
    @Body() body: { sessionId?: string },
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');
    await this.aiChat.resetSessionPersistent(
      tenantId, userId, body.sessionId || 'default',
    );
    return { ok: true };
  }

  /**
   * Deleta a mensagem com fromId e todas posteriores. Usado pelo edit+resend:
   * usuário edita uma msg antiga, frontend apaga tudo dela pra frente, manda a
   * versão editada como novo turno.
   */
  @Delete('messages/from/:id')
  @CanAccess('ai', 'delete')
  async deleteFrom(
    @Param('id') idStr: string,
    @Body() body: { sessionId?: string },
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');
    const id = +idStr;
    if (!Number.isFinite(id)) throw new BadRequestException('ID inválido.');
    return this.aiChat.deleteMessagesFrom(tenantId, userId, body.sessionId || 'default', id);
  }

  // ── Sessões (múltiplas conversas) ─────────────────────────────────────────

  /** Lista as sessões do user, ordenadas por última atividade. */
  @Get('sessions')
  @CanAccess('ai', 'view')
  async listSessions(@CurrentTenant() tenantId: number, @Req() req: any) {
    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');
    const sessions = await this.aiChat.listSessions(tenantId, userId);
    return { sessions };
  }

  /** Cria uma nova sessão. */
  @Post('sessions')
  @CanAccess('ai', 'create')
  async createSession(
    @Body() body: { id?: string; title?: string },
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');
    const session = await this.aiChat.createSession(
      tenantId, userId, body.id, body.title,
    );
    return { session };
  }

  /** Renomeia uma sessão. */
  @Patch('sessions/:id')
  @CanAccess('ai', 'edit')
  async renameSession(
    @Param('id') id: string,
    @Body() body: { title: string },
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');
    if (!body.title?.trim()) throw new BadRequestException('Título vazio.');
    const session = await this.aiChat.renameSession(tenantId, userId, id, body.title.trim());
    return { session };
  }

  /** Apaga sessão e suas mensagens. */
  @Delete('sessions/:id')
  @CanAccess('ai', 'delete')
  async deleteSession(
    @Param('id') id: string,
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');
    await this.aiChat.deleteSession(tenantId, userId, id);
    return { ok: true };
  }

  // ── Feedback (👍/👎) ──────────────────────────────────────────────────────

  /**
   * TTS — gera áudio MP3 a partir do texto.
   *
   * Dispatcher entre 3 providers conforme AiConfig.ttsProvider:
   *   - openai     → /v1/audio/speech (POST com bearer)
   *   - elevenlabs → /v1/text-to-speech/{voice_id} (header xi-api-key)
   *   - google     → /v1/text:synthesize?key=K (returns base64 audioContent)
   *
   * Texto limitado a 4000 chars (limite mais restritivo entre os providers
   * é OpenAI 4096). Áudio cacheado 1h pelo browser via Cache-Control.
   */
  @Post('tts')
  @CanAccess('ai', 'create')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async tts(
    @Body() body: { text: string },
    @CurrentTenant() tenantId: number,
    @Res() res: Response,
  ) {
    const text = (body.text || '').trim().slice(0, 4000);
    if (!text) throw new BadRequestException('Texto vazio.');

    const cfg = await this.mcpService.getAiConfig(tenantId);
    const provider = cfg?.ttsProvider;
    if (!provider || provider === 'browser') {
      throw new BadRequestException('TTS cloud não configurado.');
    }

    let buf: Buffer;
    try {
      if (provider === 'openai') {
        buf = await this.ttsOpenAi(text, cfg);
      } else if (provider === 'elevenlabs') {
        buf = await this.ttsElevenLabs(text, cfg);
      } else if (provider === 'google') {
        buf = await this.ttsGoogle(text, cfg);
      } else {
        throw new BadRequestException(`Provider TTS "${provider}" não suportado.`);
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(e?.message || 'Falha ao gerar áudio.');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buf);
  }

  /** OpenAI /v1/audio/speech — voices: alloy, echo, fable, onyx, nova, shimmer */
  private async ttsOpenAi(text: string, cfg: any): Promise<Buffer> {
    if (!cfg.openaiTtsKey) throw new BadRequestException('OpenAI TTS sem API key.');
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.openaiTtsKey.trim()}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:           cfg.ttsModel || 'tts-1',
        voice:           cfg.ttsVoice || 'nova',
        input:           text,
        response_format: 'mp3',
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      throw new BadRequestException(`OpenAI TTS (${r.status}): ${err.slice(0, 200)}`);
    }
    return Buffer.from(await r.arrayBuffer());
  }

  /**
   * ElevenLabs /v1/text-to-speech/{voice_id}
   * ttsVoice = voice_id (ex: "21m00Tcm4TlvDq8ikWAM" = Rachel)
   * ttsModel = model_id (recomendado "eleven_multilingual_v2" pra pt-BR)
   */
  private async ttsElevenLabs(text: string, cfg: any): Promise<Buffer> {
    if (!cfg.elevenlabsKey) throw new BadRequestException('ElevenLabs sem API key.');
    const voiceId = cfg.ttsVoice || '21m00Tcm4TlvDq8ikWAM'; // Rachel default
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key':    cfg.elevenlabsKey.trim(),
        'Content-Type':  'application/json',
        'Accept':        'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: cfg.ttsModel || 'eleven_multilingual_v2',
        voice_settings: {
          stability:        0.5,
          similarity_boost: 0.75,
          style:            0.2,
          use_speaker_boost: true,
        },
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      throw new BadRequestException(`ElevenLabs (${r.status}): ${err.slice(0, 200)}`);
    }
    return Buffer.from(await r.arrayBuffer());
  }

  /**
   * Google Cloud TTS — texttospeech.googleapis.com/v1/text:synthesize
   * Retorna JSON com audioContent em base64 — convertemos pra Buffer.
   * ttsVoice = name completo (ex: "pt-BR-Neural2-A")
   */
  private async ttsGoogle(text: string, cfg: any): Promise<Buffer> {
    if (!cfg.googleTtsKey) throw new BadRequestException('Google TTS sem API key.');
    const r = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(cfg.googleTtsKey.trim())}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input:       { text },
          voice:       {
            languageCode: 'pt-BR',
            name:         cfg.ttsVoice || 'pt-BR-Neural2-A',
          },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
        }),
      },
    );
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      throw new BadRequestException(`Google TTS (${r.status}): ${err.slice(0, 200)}`);
    }
    const data: any = await r.json();
    if (!data?.audioContent) throw new BadRequestException('Google TTS sem audioContent.');
    return Buffer.from(data.audioContent, 'base64');
  }

  /** Registra feedback do operador numa mensagem da IA. */
  @Patch('messages/:id/feedback')
  @CanAccess('ai', 'edit')
  async setFeedback(
    @Param('id') idStr: string,
    @Body() body: { feedback: 1 | -1 | null },
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new BadRequestException('Sessao sem userId.');
    const id = +idStr;
    if (!Number.isFinite(id)) throw new BadRequestException('ID inválido.');
    if (![1, -1, null].includes(body.feedback as any)) {
      throw new BadRequestException('Feedback deve ser 1, -1 ou null.');
    }
    await this.aiChat.setFeedback(tenantId, userId, id, body.feedback);
    return { ok: true };
  }
}
