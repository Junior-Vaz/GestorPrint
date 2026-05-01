import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { generateText, tool, jsonSchema, type CoreMessage } from 'ai';
import { McpService } from '../mcp/mcp.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { buildModel, isValidProvider } from '../../../shared/ai-provider.factory';

/**
 * WhatsappService — agente IA do **canal WhatsApp** (atendente que fala com
 * cliente final via Evolution API).
 *
 * Diferenças vs AiChatService (chat ERP):
 *  - Sessão indexada por phone (não userId), sem auth.
 *  - Prompt customizado (AiConfig.agentPrompt) com persona "atendente da gráfica".
 *  - Aplica restrições do AiConfig (allowedProductIds, allowedEstimateTypes).
 *  - Suporta mídia (image/document base64) — multimodal.
 *  - Histórico em memória (Map<phone, history>) com TTL — atendimento de
 *    cliente é curto, não justifica gravar tudo no banco.
 *  - Sem streaming (Evolution não suporta — entrega resposta de uma vez).
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  // Loop agentic — quantas tools encadeadas a IA pode chamar
  private readonly MAX_STEPS = 12;
  // Quantas msgs do histórico mandamos como contexto pro modelo
  private readonly MAX_HISTORY = 30;
  // Limpa contatos inativos depois de 1h sem msg (atendimento típico < 30min)
  private readonly SESSION_TTL_MS = 60 * 60 * 1000;

  // sessionKey = `${tenantId}::${phone}` — multi-tenant safe
  private sessions = new Map<string, { history: CoreMessage[]; updatedAt: number }>();

  constructor(
    private readonly mcpService: McpService,
    private readonly prisma:     PrismaService,
  ) {}

  /** Limpa sessão de um contato — chamado quando atendente "encerra atendimento". */
  clearSession(tenantId: number, contact: string) {
    this.sessions.delete(this.key(tenantId, contact));
  }

  /**
   * Processa mensagem recebida do WhatsApp. Retorna o texto da resposta
   * (a quem chama é responsável por enviar via Evolution).
   */
  async processMessage(
    tenantId: number,
    contact: string,
    text: string,
    mediaData?: { base64: string; mimetype: string },
  ): Promise<string> {
    const cfg = await this.mcpService.getAiConfig(tenantId);
    if (!cfg?.enabled) return '';
    if (!cfg.geminiKey) {
      this.logger.warn(`Tenant ${tenantId} sem geminiKey — ignorando msg WhatsApp.`);
      return '';
    }

    const provider = isValidProvider(cfg.aiProvider) ? cfg.aiProvider : 'google';
    let model;
    try {
      model = buildModel(provider, cfg.geminiModel || '', cfg.geminiKey);
    } catch (e: any) {
      this.logger.error(`Falha ao construir modelo (tenant=${tenantId}): ${e.message}`);
      return 'Desculpe, tive um problema técnico. Pode tentar de novo?';
    }

    const session = this.getOrCreateSession(tenantId, contact);

    // Constrói conteúdo da msg do user — multimodal se tiver mídia
    let userContent: any = text;
    if (mediaData) {
      const isImage = mediaData.mimetype.startsWith('image/');
      userContent = [
        { type: 'text', text },
        isImage
          ? { type: 'image', image: Buffer.from(mediaData.base64, 'base64'), mimeType: mediaData.mimetype }
          : { type: 'file',  data:  Buffer.from(mediaData.base64, 'base64'), mimeType: mediaData.mimetype },
      ];
    }
    session.history.push({ role: 'user', content: userContent });

    const tools = this.buildTools(tenantId);
    const systemPrompt = this.buildWhatsappSystemPrompt(cfg.agentPrompt, cfg.whatsappPromptStrict);

    try {
      const result = await generateText({
        model,
        system:    systemPrompt,
        messages:  session.history.slice(-this.MAX_HISTORY),
        tools,
        maxSteps:  this.MAX_STEPS,
      });

      const reply = result.text || '';
      session.history.push({ role: 'assistant', content: reply });
      session.updatedAt = Date.now();

      // Trim agressivo se ficar grande demais
      if (session.history.length > this.MAX_HISTORY * 2) {
        session.history = session.history.slice(-this.MAX_HISTORY);
      }
      return reply;
    } catch (error: any) {
      this.logger.error(
        `Erro WhatsApp (tenant=${tenantId} contact=${contact} provider=${provider}): ${error?.message || error}`,
      );
      return 'Desculpe, tive um problema técnico ao processar sua mensagem. Poderia repetir?';
    } finally {
      this.gcSessions();
    }
  }

  /**
   * Envia texto pra um contato via Evolution API. Retry com backoff exponencial.
   * Centraliza aqui pra o controller de webhook ficar fino.
   */
  async sendText(tenantId: number, contact: string, text: string, attempts = 3): Promise<boolean> {
    const cfg = await this.mcpService.getAiConfig(tenantId);
    if (!cfg?.evolutionUrl || !cfg.evolutionKey || !cfg.evolutionInstance) {
      this.logger.error(`Tenant ${tenantId} sem credencial Evolution — não envia.`);
      return false;
    }

    const url = `${cfg.evolutionUrl.replace(/\/$/, '')}/message/sendText/${cfg.evolutionInstance}`;
    const payload = {
      number:      contact.split('@')[0],
      text,
      delay:       1200,
      linkPreview: false,
    };
    const headers = { apikey: cfg.evolutionKey };

    let lastError: any;
    for (let i = 0; i < attempts; i++) {
      try {
        await axios.post(url, payload, { headers, timeout: 10_000 });
        return true;
      } catch (e: any) {
        lastError = e;
        const status = e?.response?.status;
        // 4xx (exceto 429) são erros do nosso lado — não retry
        if (status && status >= 400 && status < 500 && status !== 429) {
          this.logger.error(`Evolution rejeitou (${status}): ${e?.response?.data?.message || e.message}`);
          return false;
        }
        if (i < attempts - 1) {
          const backoff = 1000 * Math.pow(2, i);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }
    this.logger.error(`Falha definitiva ao enviar Evolution (tenant=${tenantId}): ${lastError?.message}`);
    return false;
  }

  /**
   * Baixa mídia de uma mensagem via Evolution (download proxy). Retorna
   * { base64, mimetype } ou null se falhar.
   */
  async downloadMedia(tenantId: number, message: any, mediaType: 'image' | 'document'):
    Promise<{ base64: string; mimetype: string } | null>
  {
    const cfg = await this.mcpService.getAiConfig(tenantId);
    if (!cfg?.evolutionUrl || !cfg.evolutionKey || !cfg.evolutionInstance) return null;

    try {
      const res = await axios.post(
        `${cfg.evolutionUrl.replace(/\/$/, '')}/chat/getBase64FromMediaMessage/${cfg.evolutionInstance}`,
        { message: { message } },
        { headers: { apikey: cfg.evolutionKey }, timeout: 15_000 },
      );
      const data = res.data as any;
      if (!data?.base64) return null;
      let b64 = data.base64 as string;
      if (b64.includes(',')) b64 = b64.split(',')[1];
      const mimetype = message[`${mediaType}Message`]?.mimetype ||
        (mediaType === 'image' ? 'image/jpeg' : 'application/pdf');
      return { base64: b64, mimetype };
    } catch (e: any) {
      this.logger.error(`Falha download mídia (tenant=${tenantId}): ${e.message}`);
      return null;
    }
  }

  // ── Privates ─────────────────────────────────────────────────────────────

  private key(tenantId: number, contact: string) { return `${tenantId}::${contact}`; }

  private getOrCreateSession(tenantId: number, contact: string) {
    const k = this.key(tenantId, contact);
    let s = this.sessions.get(k);
    if (!s) {
      s = { history: [], updatedAt: Date.now() };
      this.sessions.set(k, s);
    }
    return s;
  }

  /** Garbage-collect sessões antigas — evita vazamento de memória. */
  private gcSessions() {
    const now = Date.now();
    if (this.sessions.size < 100) return; // só faz GC se mapa ficar grande
    for (const [k, s] of this.sessions) {
      if (now - s.updatedAt > this.SESSION_TTL_MS) this.sessions.delete(k);
    }
  }

  /**
   * Tools do WhatsApp — usa contexto 'whatsapp' (aplica restrições do AiConfig).
   */
  private buildTools(tenantId: number) {
    const catalog = this.mcpService.toolsCatalog();
    const tools: Record<string, any> = {};
    for (const t of catalog) {
      tools[t.name] = tool({
        description: t.description,
        parameters:  jsonSchema(t.inputSchema as any),
        execute: async (args: any) => {
          const result: any = await this.mcpService.callTool(t.name, args, tenantId, 'whatsapp');
          const text = result?.content?.[0]?.text;
          if (text) {
            try { return JSON.parse(text); } catch { return text; }
          }
          return result;
        },
      });
    }
    return tools;
  }

  /**
   * System prompt do agente WhatsApp. agentPrompt da AiConfig já vem com vars
   * expandidas pelo McpService (variáveis tipo {{businessName}}).
   *
   * `strict=true` → usa só o que o admin escreveu, sem apendar regras do sistema.
   */
  private buildWhatsappSystemPrompt(customPrompt?: string, strict = false): string {
    const base = customPrompt?.trim() || 'Você é um atendente inteligente da nossa gráfica.';
    if (strict) return base;
    return `${base}

REGRAS CRÍTICAS DE COMPORTAMENTO:
- NUNCA invente valores, preços ou prazos. Use as ferramentas pra buscar.
- NUNCA repita uma pergunta que você já fez nesta conversa.
- Se o cliente já forneceu uma informação (nome, quantidade, tamanho, arquivo), REGISTRE-A e NÃO pergunte novamente.
- Se o cliente diz "já enviei", acredite nele.
- Seja objetivo e linear. Após reunir os dados necessários, crie o orçamento imediatamente.
- Antes de chamar uma ferramenta, confirme que tem TODOS os parâmetros obrigatórios.
- NUNCA chame a mesma ferramenta duas vezes seguidas com os mesmos argumentos.
- Mande respostas curtas — você está no WhatsApp, não num email. Sem markdown elaborado.`;
  }
}
