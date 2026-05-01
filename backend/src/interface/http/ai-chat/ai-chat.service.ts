import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { generateText, streamText, tool, jsonSchema, type CoreMessage } from 'ai';
import { McpService } from '../mcp/mcp.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { buildModel, isValidProvider } from '../../../shared/ai-provider.factory';

/**
 * Eventos emitidos pelo stream do chat IA. Servem pra o widget mostrar
 * tokens incrementais + indicadores de tool em execução.
 */
export type AiChatStreamEvent =
  | { type: 'delta'; text: string }                                                 // pedaço de texto
  | { type: 'tool-call'; name: string; args?: any }                                 // IA decidiu chamar tool
  | { type: 'tool-result'; name: string; ok: boolean }                              // tool terminou
  | { type: 'done'; text: string; messageId?: number; usage?: any }                 // resposta final + id real
  | { type: 'error'; message: string };                                             // falhou

/**
 * AiChatService — agente IA do **ERP** (operadores chatando com o sistema).
 *
 * Stateless: a cada mensagem, monta o array `messages` a partir do histórico
 * persistido no banco + a nova msg. Não mantém Map<sessionId, chat> — a
 * fonte de verdade é a tabela AiChatMessage.
 *
 * Multi-provider: usa Vercel AI SDK pra normalizar Gemini/GPT/Claude.
 * `cfg.aiProvider` decide qual provider usar; mesma lib, mesmo loop agentic.
 */
@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  // Limite do loop agentic (quantas vezes a IA pode encadear tool calls)
  private readonly MAX_STEPS = 12;

  // Quantas msgs do histórico mandamos pra IA como contexto. Mais que isso
  // fica caro em tokens e desnecessário (IA já tem suas tools pra buscar).
  private readonly HISTORY_CONTEXT = 30;

  // Cache do dicionário de tools por tenant (5min). Evita rebuild a cada msg.
  private readonly TOOLS_TTL_MS = 5 * 60 * 1000;
  private toolsCache = new Map<number, { tools: Record<string, any>; ts: number }>();

  constructor(
    private readonly mcpService: McpService,
    private readonly prisma:     PrismaService,
  ) {}

  // ── Persistência (histórico do chat) ─────────────────────────────────────

  async getHistory(tenantId: number, userId: number, sessionId: string, limit = 50) {
    const items = await (this.prisma as any).aiChatMessage.findMany({
      where:   { tenantId, userId, sessionId },
      orderBy: { createdAt: 'asc' },
      take:    Math.min(200, Math.max(1, limit)),
      select:  { id: true, role: true, text: true, feedback: true, createdAt: true },
    });
    return items;
  }

  private async persistMessage(
    tenantId: number, userId: number, sessionId: string,
    role: 'user' | 'assistant', text: string,
  ) {
    try {
      await (this.prisma as any).aiChatMessage.create({
        data: { tenantId, userId, sessionId, role, text },
      });
    } catch (e: any) {
      this.logger.error(`Falha ao persistir msg de chat: ${e.message}`);
    }
  }

  async resetSessionPersistent(tenantId: number, userId: number, sessionId: string) {
    try {
      await (this.prisma as any).aiChatMessage.deleteMany({
        where: { tenantId, userId, sessionId },
      });
    } catch (e: any) {
      this.logger.error(`Falha ao apagar histórico: ${e.message}`);
    }
  }

  /**
   * Deleta a mensagem com `fromId` e todas posteriores (mesma sessão, mesmo
   * user/tenant). Usado pelo "edit + resend" do widget — apaga o que veio
   * depois do ponto de edição pra o próximo turno começar do zero.
   */
  async deleteMessagesFrom(tenantId: number, userId: number, sessionId: string, fromId: number) {
    try {
      const r = await (this.prisma as any).aiChatMessage.deleteMany({
        where: { tenantId, userId, sessionId, id: { gte: fromId } },
      });
      return { ok: true, deleted: r.count };
    } catch (e: any) {
      this.logger.error(`Falha ao deletar msgs a partir de ${fromId}: ${e.message}`);
      throw e;
    }
  }

  // ── Sessões (múltiplas conversas) ────────────────────────────────────────

  async listSessions(tenantId: number, userId: number) {
    try {
      return await (this.prisma as any).aiChatSession.findMany({
        where:   { tenantId, userId },
        orderBy: { lastActivity: 'desc' },
        take:    50,
      });
    } catch (e: any) {
      this.logger.error(`Falha ao listar sessões: ${e.message}`);
      return [];
    }
  }

  /**
   * Cria sessão. id é opcional — se não vier, gera um aleatório.
   * Idempotente: se já existir, retorna a existente.
   */
  async createSession(tenantId: number, userId: number, id?: string, title?: string) {
    const sid = id?.trim() || `s_${Math.random().toString(36).slice(2, 11)}`;
    const data = {
      id:       sid,
      tenantId,
      userId,
      title:    title?.trim() || 'Nova conversa',
    };
    try {
      return await (this.prisma as any).aiChatSession.upsert({
        where:  { id: sid },
        create: data,
        update: { lastActivity: new Date() },
      });
    } catch (e: any) {
      this.logger.error(`Falha ao criar sessão: ${e.message}`);
      throw e;
    }
  }

  async renameSession(tenantId: number, userId: number, id: string, title: string) {
    try {
      // Filtro por tenant+user no update — evita renomear sessão alheia.
      await (this.prisma as any).aiChatSession.updateMany({
        where: { id, tenantId, userId },
        data:  { title, lastActivity: new Date() },
      });
      return await (this.prisma as any).aiChatSession.findUnique({ where: { id } });
    } catch (e: any) {
      this.logger.error(`Falha ao renomear sessão: ${e.message}`);
      throw e;
    }
  }

  async deleteSession(tenantId: number, userId: number, id: string) {
    try {
      await (this.prisma as any).aiChatMessage.deleteMany({
        where: { tenantId, userId, sessionId: id },
      });
      await (this.prisma as any).aiChatSession.deleteMany({
        where: { id, tenantId, userId },
      });
    } catch (e: any) {
      this.logger.error(`Falha ao deletar sessão: ${e.message}`);
    }
  }

  /**
   * Atualiza lastActivity (e cria a sessão se ainda não existir). Chamado
   * a cada mensagem nova — também usa a primeira pergunta como title default.
   */
  async touchSession(tenantId: number, userId: number, sessionId: string, firstMessage?: string) {
    try {
      // Ancora ownership na própria query — sessionId é UUID, mas se vazasse
      // tenants poderiam atualizar lastActivity de sessão alheia.
      const existing = await (this.prisma as any).aiChatSession.findFirst({
        where: { id: sessionId, tenantId, userId },
      });
      if (existing) {
        await (this.prisma as any).aiChatSession.updateMany({
          where: { id: sessionId, tenantId, userId },
          data:  { lastActivity: new Date() },
        });
      } else {
        // Pega primeiras palavras da msg como título sugerido (fallback)
        const title = firstMessage
          ? firstMessage.slice(0, 60).replace(/\s+/g, ' ').trim() || 'Nova conversa'
          : 'Nova conversa';
        await (this.prisma as any).aiChatSession.create({
          data: { id: sessionId, tenantId, userId, title },
        });
      }
    } catch (e: any) {
      // Não bloqueia o chat se a tabela não existir (migration pendente, etc)
      this.logger.warn(`touchSession falhou (ignorando): ${e.message}`);
    }
  }

  // ── Feedback (👍/👎) ─────────────────────────────────────────────────────

  async setFeedback(tenantId: number, userId: number, messageId: number, feedback: 1 | -1 | null) {
    try {
      // updateMany pra garantir que o user só edita as próprias msgs do seu tenant
      const r = await (this.prisma as any).aiChatMessage.updateMany({
        where: { id: messageId, tenantId, userId, role: 'assistant' },
        data:  { feedback },
      });
      if (r.count === 0) {
        throw new BadRequestException('Mensagem não encontrada ou não pertence ao usuário.');
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`Falha ao salvar feedback: ${e.message}`);
      throw e;
    }
  }

  // ── Conversa principal ───────────────────────────────────────────────────

  async sendMessage(
    tenantId: number,
    userId: number,
    sessionId: string,
    text: string,
  ): Promise<string> {
    const cfg = await this.mcpService.getAiConfig(tenantId);
    if (!cfg?.enabled) {
      throw new BadRequestException('IA desativada — ative nas Configurações da IA.');
    }
    if (!cfg.geminiKey) {
      throw new BadRequestException('Configure a API key do provider escolhido nas Configurações da IA.');
    }

    const provider = isValidProvider(cfg.aiProvider) ? cfg.aiProvider : 'google';
    const model = buildModel(provider, cfg.geminiModel || '', cfg.geminiKey);

    // Persiste msg do user SÍNCRONAMENTE — assim entra no histórico já no
    // próximo getHistory, sem precisar pushar manual. Evita ordering bugs.
    await this.persistMessage(tenantId, userId, sessionId, 'user', text);

    // Monta contexto: pega últimas N msgs do banco (já inclui a nova).
    const history = await this.getHistory(tenantId, userId, sessionId, this.HISTORY_CONTEXT);
    const messages: CoreMessage[] = history.map((h: any) => ({
      role:    h.role as 'user' | 'assistant',
      content: h.text,
    }));

    const tools = this.buildTools(tenantId, userId, sessionId);

    try {
      const memory = await this.mcpService.getUserMemory(tenantId, userId);
      const result = await generateText({
        model,
        system:    this.buildErpSystemPrompt(cfg.erpAgentPrompt, cfg.erpPromptStrict, memory),
        messages,
        tools,
        maxSteps:  this.MAX_STEPS,
        // maxOutputTokens não existe em ai@4 — o modelo decide
      });

      const reply = result.text || '(sem resposta)';
      // Síncrono — quem chama o /message não-stream também espera consistência
      await this.persistMessage(tenantId, userId, sessionId, 'assistant', reply);
      return reply;
    } catch (error: any) {
      this.logger.error(
        `Erro no chat (tenant=${tenantId} user=${userId} provider=${provider} model=${cfg.geminiModel}): ${error?.message || error}`,
      );
      // Mensagens humanas pra erros comuns — o user vê isso no widget
      throw new BadRequestException(this.humanizeError(error, provider, cfg.geminiModel));
    }
  }

  /**
   * Versão streaming do sendMessage — retorna async generator de eventos
   * (delta de texto + chamadas de tools) pra UI mostrar resposta progressiva.
   *
   * Uso típico no controller (SSE):
   *   for await (const evt of svc.streamMessage(...)) res.write(`data: ${JSON.stringify(evt)}\n\n`);
   *
   * Persistência da mensagem do user: feita no início.
   * Persistência da resposta: feita no evento 'done' (com texto agregado).
   */
  async *streamMessage(
    tenantId: number,
    userId: number,
    sessionId: string,
    text: string,
    mediaData?: { base64: string; mimetype: string; filename?: string },
  ): AsyncGenerator<AiChatStreamEvent, void, unknown> {
    const cfg = await this.mcpService.getAiConfig(tenantId);
    if (!cfg?.enabled) {
      yield { type: 'error', message: 'IA desativada — ative nas Configurações da IA.' };
      return;
    }
    if (!cfg.geminiKey) {
      yield { type: 'error', message: 'Configure a API key do provider escolhido nas Configurações da IA.' };
      return;
    }

    const provider = isValidProvider(cfg.aiProvider) ? cfg.aiProvider : 'google';
    let model;
    try {
      model = buildModel(provider, cfg.geminiModel || '', cfg.geminiKey);
    } catch (e: any) {
      yield { type: 'error', message: e.message || 'Falha ao construir modelo.' };
      return;
    }

    // Persiste user msg (com hint de mídia no texto se houver).
    // O conteúdo binário NÃO é persistido — fica vivo só nesse turno.
    const persistedText = mediaData
      ? `${text}\n[anexo: ${mediaData.filename || mediaData.mimetype}]`
      : text;
    await this.persistMessage(tenantId, userId, sessionId, 'user', persistedText);

    const history = await this.getHistory(tenantId, userId, sessionId, this.HISTORY_CONTEXT);
    // Histórico já tem a msg do user (persistida acima) — não dupla. Mas se
    // tem mídia, vamos REPLACAR a última msg do user com versão multimodal,
    // pra IA enxergar a imagem/PDF.
    const messages: CoreMessage[] = history.map((h: any) => ({
      role:    h.role as 'user' | 'assistant',
      content: h.text,
    }));
    if (mediaData && messages.length > 0) {
      const isImage = mediaData.mimetype.startsWith('image/');
      messages[messages.length - 1] = {
        role: 'user',
        content: [
          { type: 'text', text },
          isImage
            ? { type: 'image', image: Buffer.from(mediaData.base64, 'base64'), mimeType: mediaData.mimetype }
            : { type: 'file',  data:  Buffer.from(mediaData.base64, 'base64'), mimeType: mediaData.mimetype },
        ] as any,
      };
    }

    const tools = this.buildTools(tenantId, userId, sessionId);

    try {
      // Memória persistente do operador — anexa ao system prompt se houver
      const memory = await this.mcpService.getUserMemory(tenantId, userId);
      const systemPrompt = this.buildErpSystemPrompt(cfg.erpAgentPrompt, cfg.erpPromptStrict, memory);

      const result = streamText({
        model,
        system:    systemPrompt,
        messages,
        tools,
        maxSteps:  this.MAX_STEPS,
      });

      // fullStream emite eventos misturados: text-delta, tool-call, tool-result, finish, error
      let aggregated = '';
      for await (const part of result.fullStream as AsyncIterable<any>) {
        switch (part.type) {
          case 'text-delta': {
            const delta = part.textDelta || part.text || '';
            aggregated += delta;
            yield { type: 'delta', text: delta };
            break;
          }
          case 'tool-call': {
            yield { type: 'tool-call', name: part.toolName, args: part.args };
            break;
          }
          case 'tool-result': {
            const isError = !!part.result?.error || part.isError === true;
            yield { type: 'tool-result', name: part.toolName, ok: !isError };
            break;
          }
          case 'error': {
            const msg = this.humanizeError(part.error, provider, cfg.geminiModel || '');
            yield { type: 'error', message: msg };
            return;
          }
          // outros tipos (finish, step-start, step-finish) não interessam pro UI
        }
      }

      // Texto agregado pra persistir + sinalizar fim.
      // Persistimos SÍNCRONAMENTE antes de yieldar 'done' pra retornar o id
      // real — o widget precisa do id pra registrar feedback (👍/👎).
      const finalText = aggregated || (await result.text) || '(sem resposta)';
      let assistantMessageId: number | undefined;
      try {
        const saved = await (this.prisma as any).aiChatMessage.create({
          data:   { tenantId, userId, sessionId, role: 'assistant', text: finalText },
          select: { id: true },
        });
        assistantMessageId = saved.id;
      } catch (e: any) {
        this.logger.error(`Falha ao persistir resposta da IA: ${e.message}`);
      }
      const usage = await result.usage.catch(() => undefined);
      yield { type: 'done', text: finalText, messageId: assistantMessageId, usage };
    } catch (error: any) {
      this.logger.error(
        `Erro no stream (tenant=${tenantId} user=${userId} provider=${provider}): ${error?.message || error}`,
      );
      yield {
        type: 'error',
        message: this.humanizeError(error, provider, cfg.geminiModel || ''),
      };
    }
  }

  /**
   * Traduz erros do AI SDK em mensagens claras pro operador. Os providers
   * empacotam errors de forma diferente; tentamos extrair o que dá.
   */
  private humanizeError(error: any, provider: string, model: string): string {
    const msg = (error?.message || '').toString();
    const status =
      error?.statusCode ||
      error?.cause?.statusCode ||
      error?.responseHeaders?.status ||
      0;

    // Rate limit (429)
    if (status === 429 || msg.includes('Too Many Requests') || msg.includes('rate limit')) {
      return `⏱ Limite de requisições atingido em ${provider}. Aguarde alguns segundos, troque pra outro provedor ou suba de plano.`;
    }
    // Modelo não existe (404)
    if (status === 404 || msg.includes('Not Found') || msg.includes('does not exist') || msg.includes('model not found')) {
      return `🔍 Modelo "${model}" não encontrado em ${provider}. Vá em Configurações da IA, troque o modelo e salve.`;
    }
    // Auth (401/403)
    if (status === 401 || status === 403 || msg.includes('Unauthorized') || msg.includes('Invalid API key') || msg.includes('Incorrect API key')) {
      return `🔑 API key de ${provider} inválida ou sem permissão. Verifique a chave em Configurações da IA.`;
    }
    // Quota / billing
    if (msg.includes('quota') || msg.includes('insufficient') || msg.includes('billing')) {
      return `💳 ${provider} sem créditos ou cota esgotada. Verifique sua conta no console do provedor.`;
    }
    // Connection (Ollama local desligado, etc)
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('Network')) {
      return `🌐 Falha de conexão com ${provider}. ${provider === 'ollama' ? 'Verifique se o Ollama está rodando localmente (porta 11434).' : 'Confira sua internet e a URL do serviço.'}`;
    }
    // Fallback — devolve a msg crua
    return msg || 'Falha ao processar mensagem.';
  }

  // ── Privates ─────────────────────────────────────────────────────────────

  /**
   * Converte o catálogo de tools do MCP pro formato do AI SDK.
   *
   * userId é capturado no closure pra todas as tools executoras (que mudam
   * estado) gravarem audit log com o operador real, não com hardcode.
   *
   * Cache por (tenant + user) — invalida quando algum dos dois muda.
   */
  private buildTools(tenantId: number, userId: number, sessionId?: string) {
    const cacheKey = tenantId * 1_000_000 + userId;
    const cached = this.toolsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.TOOLS_TTL_MS) {
      return cached.tools;
    }
    const catalog = this.mcpService.toolsCatalog();
    const tools: Record<string, any> = {};
    for (const t of catalog) {
      tools[t.name] = tool({
        description: t.description,
        parameters:  jsonSchema(t.inputSchema as any),
        execute: async (args: any) => {
          // Modo ERP: bypassa restrições do AiConfig + audit log com userId+sessionId
          const result: any = await this.mcpService.callTool(t.name, args, tenantId, 'erp', userId, sessionId);
          const text = result?.content?.[0]?.text;
          if (text) {
            try { return JSON.parse(text); } catch { return text; }
          }
          return result;
        },
      });
    }
    this.toolsCache.set(cacheKey, { tools, ts: Date.now() });
    return tools;
  }

  /**
   * Invalida cache de tools — chamado quando AiConfig muda (ex: nova restrição).
   * Como a chave do cache é (tenantId, userId), invalida todas as chaves do
   * tenant em vez de uma só. Frequência baixa, custo aceitável.
   */
  invalidateToolsCache(tenantId?: number) {
    if (tenantId == null) {
      this.toolsCache.clear();
      return;
    }
    const tenantPrefix = tenantId * 1_000_000;
    for (const key of this.toolsCache.keys()) {
      if (Math.floor(key / 1_000_000) === tenantId) this.toolsCache.delete(key);
    }
    void tenantPrefix; // (referência só pra silenciar lint do "computed but not used")
  }

  /**
   * Constrói o system prompt do chat ERP.
   *
   * Comportamento:
   *  - `strict=false` (default) → apenda mapeamento intenção→tool + REGRAS CRÍTICAS
   *    automáticas. Bom pra usuários comuns que não querem se preocupar.
   *  - `strict=true` → usa SOMENTE o que o admin escreveu na AiView. Power user
   *    assume responsabilidade pelas regras. Útil pra customização extrema
   *    (mudar tom, idioma, fluxo de trabalho diferente, etc).
   */
  private buildErpSystemPrompt(customPrompt?: string, strict = false, memory?: string): string {
    const base = customPrompt?.trim() || `Você é o assistente operacional do ERP GestorPrint. Ajuda o operador da gráfica a executar tarefas via comandos em linguagem natural — buscar clientes, conferir status de pedidos, criar orçamentos, gerar cobranças, etc — usando as ferramentas (tools) disponíveis.

Você não é o atendente que fala com o cliente final. O operador já está autenticado no sistema; você é a "mão direita" dele.`;

    // Memória persistente — preferências aprendidas em conversas passadas.
    // Vai ANTES do conteúdo principal pra a IA "internalizar" antes de
    // responder. Se vazia, ignoramos.
    const memoryBlock = memory?.trim()
      ? `\n\nMEMÓRIA DO OPERADOR (preferências aprendidas em conversas anteriores):\n${memory.trim()}\n`
      : '';

    if (strict) return base + memoryBlock; // power user controla tudo

    return `${base}

FERRAMENTAS RECOMENDADAS POR INTENÇÃO (chat ERP):

Consulta:
- "pedidos pendentes/atrasados/hoje/em produção" → list_orders (filtrar por status, dateFrom)
- "orçamentos pendentes/aprovados/recentes" → list_estimates
- "buscar cliente X" → search_customers (não use find_or_create_customer no chat ERP)
- "top clientes do mês/ano" → top_customers
- "como tá o financeiro/faturamento da semana/mês" → financial_summary
- "cobranças vencidas / contas em atraso" → overdue_payments
- "estoque baixo / produtos pra repor" → low_stock_products
- "resumo do dia / KPIs / dashboard" → dashboard_kpis
- "status do pedido N" → get_order_status

Criação:
- "criar orçamento de X pra cliente Y" → search_customers + search_products + create_estimate
- "cadastra cliente novo X com telefone Y" → create_customer
- "gerar cobrança / PIX do pedido N" → generate_payment
- "lança despesa de R$ X com Y na categoria Z" → add_expense

Mudança de estado (SEMPRE confirme antes — pergunte "pode prosseguir?"):
- "marca pedido N como em produção / finalizado / entregue" → update_order_status
- "cliente X já pagou a cobrança N de R$ Y" → mark_receivable_paid
- "paguei a conta do fornecedor Z" → mark_payable_paid

Comunicação (SEMPRE confirme texto antes — preview o que vai mandar):

⚠️ **DETECÇÃO DE CANAL — leia com MUITA atenção** ⚠️
A escolha entre send_whatsapp_message vs send_email depende EXCLUSIVAMENTE do que o operador escreveu. NÃO use "padrão" nem "geralmente" — leia a mensagem dele.

Indicadores de **WhatsApp** → use send_whatsapp_message:
- "WhatsApp", "whats", "wpp", "zap", "zapzap"
- "manda mensagem" (mensagem genérica geralmente é WhatsApp)
- "manda no celular", "manda no número"

Indicadores de **email** → use send_email:
- "email", "e-mail", "imeio", "correio eletrônico"

Quando AMBÍGUO (só "manda isso pro cliente"), PERGUNTE: "WhatsApp ou email?". NUNCA escolha por padrão.

🚫 **NÃO repita o canal errado** 🚫
Se o operador disser "não, eu disse WhatsApp" / "não é email" / "errei o canal" / "queria pelo Zap", você ERROU na escolha anterior. Pare imediatamente:
1. Reconheça o erro: "Desculpa, errei o canal. Vou mandar via WhatsApp agora."
2. Releia a mensagem original e descubra qual canal foi pedido.
3. Chame a tool CORRETA (send_whatsapp_message se foi WhatsApp).
4. NUNCA insista no canal errado depois de correção explícita.

PDFs e documentos:
- "gera link do orçamento N" / "manda orçamento" → generate_estimate_pdf
- "imprime recibo do pedido N" / "PDF do pedido" → generate_order_receipt_pdf

Financeiro (criar):
- "lança cobrança de R$ X pra cliente Y vencendo Z" → add_receivable
- "lança conta de R$ X com fornecedor Y" → add_payable
- "deu entrada de N papel A4" / "saída de M tinta" → stock_movement

Agenda:
- "o que tem pra entregar hoje/amanhã/essa semana" → get_schedule (range=today/tomorrow/week)
- "pedidos atrasados na entrega" → get_schedule (range=overdue)

Listagens / cadastros:
- "lista produtos" / "produtos com estoque" → list_products (withStock=true)
- "fornecedores cadastrados" → list_suppliers
- "cadastra fornecedor X" → create_supplier
- "cadastra produto X com preço Y" → create_product (precisa typeId — busca antes)

REGRAS CRÍTICAS DE COMPORTAMENTO:
- Quando o operador CORRIGIR você ("não", "errei", "eu disse X", "não é Y", "queria Z"):
  1. Pare imediatamente, NÃO repita a ação errada.
  2. Reconheça o erro com 1 frase ("Desculpa, errei...").
  3. Releia o histórico recente com atenção pra entender o que era pedido.
  4. Execute a ação CORRETA agora.
  5. NUNCA chame a mesma tool com os mesmos args após correção — o user já te disse que tá errado.
- Use tools sempre que precisar de dados reais. NUNCA invente IDs, valores ou status.
- Datas: hoje é ${new Date().toISOString().slice(0, 10)} (UTC). Calcule "essa semana", "este mês" a partir disso.
- Quando o operador pedir algo ambíguo, pergunte UMA pergunta de cada vez pra esclarecer.
- Apresente resultados em **markdown** (listas, tabelas, **negrito**) — não despeje JSON cru.
- Valores monetários: formate como "R$ 1.234,56" (BR locale).
- Se uma tool retornar erro, explique em linguagem humana o que falhou e sugira próximo passo.
- Nunca chame a mesma tool duas vezes seguidas com os mesmos argumentos.
- Se o operador pedir algo destrutivo (deletar, suspender, cancelar), confirme antes de executar.

PLANEJAMENTO DE AÇÕES ENCADEADAS:
- Quando uma intenção precisar de **3 ou mais** chamadas de tools encadeadas (ex: "criar orçamento pra cliente X de produtos Y" = search_customers + search_products[] + create_estimate), ANTES de executar:
  1. Liste o plano numerado em markdown:
     > 📋 **Plano:**
     > 1. Buscar cliente "Maria"
     > 2. Buscar produtos "cartão de visita"
     > 3. Criar orçamento com 100 unidades
  2. Pergunte "Posso prosseguir?"
  3. Aguarde "sim/pode/vai" antes de executar.
- Pra ações simples (1-2 tools), execute direto sem mostrar plano.
- Pra ações destrutivas (qualquer mark_paid, update_order_status, send_*), o plano pode ser apenas 1 passo mas SEMPRE confirme.

MEMÓRIA — quando o operador disser "lembra que..." / "anota aqui que..." / "sempre faço X", chame remember_preference. Quando disser "esquece..." / "não precisa mais lembrar...", chame forget_preference.

PRÓXIMAS AÇÕES SUGERIDAS (regra crítica — leia inteiro):
As sugestões ficam como botões clicáveis abaixo da sua resposta. Elas DEVEM bater com o que você acabou de dizer.

📌 **Caso A — sua resposta termina com PERGUNTA ou apresenta OPÇÕES (lista numerada, bullets, "qual X?")**:
As suggestions DEVEM ser as opções da sua pergunta, em formato curto pra o user clicar e responder.
Exemplo: você listou "Quer enviar: 1) Um orçamento  2) Uma mensagem  3) Um link PIX  4) Um PDF"
→ <!--suggestions:["Um orçamento","Uma mensagem","Link PIX","PDF do pedido"]-->

📌 **Caso B — sua resposta foi informativa (mostrou dados, executou ação)**:
As suggestions são próximas ações naturais que o operador talvez queira fazer.
Exemplo após listar 3 pedidos pendentes:
→ <!--suggestions:["Marcar pedido 42 como produção","Gerar PIX do pedido 38","Buscar contato cliente 15"]-->

REGRAS:
- Cada sugestão = frase curta (≤50 chars) que pode ser enviada de volta como mensagem.
- 2 a 4 sugestões. Não menos, não mais.
- Formato exato no FINAL da mensagem: <!--suggestions:["Frase 1","Frase 2","Frase 3"]-->
- NUNCA sugira ações desconexas do contexto. Se você perguntou "qual canal?", as suggestions são canais, NÃO "ver outros pedidos".
- NUNCA mande suggestions em respostas curtas tipo "Sim" / "Ok" / "Pronto".
- NUNCA repita exatamente a pergunta — a sugestão é o que o user RESPONDE, não o que você perguntou.`;
  }
}
