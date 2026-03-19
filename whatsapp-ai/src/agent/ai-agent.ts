import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

// Session holds chat history AND cached tools so we don't hit the ERP
// on every single message — tools are refreshed after TOOL_CACHE_TTL ms.
const TOOL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface SessionData {
  chat: any;
  tools: any[];
  toolsFetchedAt: number;
}

export class AiAgent {
  private genAI: GoogleGenerativeAI;
  private erpBaseUrl: string;
  private geminiModel: string;
  private maxTokens: number;

  private sessions: Map<string, SessionData> = new Map();

  constructor(
    apiKey: string,
    geminiModel = "gemini-2.0-flash",
    maxTokens = 1000,
    erpBaseUrl = "http://localhost:3000/api",
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey.trim());
    this.geminiModel = geminiModel;
    this.maxTokens = maxTokens;
    this.erpBaseUrl = erpBaseUrl;
  }

  // Clear conversation memory for a contact (call after order is complete)
  clearSession(contact: string) {
    this.sessions.delete(contact);
  }

  async processMessage(
    contact: string,
    text: string,
    systemPrompt: string,
    mediaData?: { base64: string; mimetype: string },
  ): Promise<string> {
    // Anti-hallucination addendum appended to every system prompt.
    // Based on Gemini best practices: be explicit, avoid ambiguity, constrain scope.
    const fullSystemPrompt =
      systemPrompt +
      `

REGRAS CRÍTICAS DE COMPORTAMENTO:
- NUNCA invente valores, preços ou prazos. Se não souber, use a ferramenta adequada do ERP para buscar.
- NUNCA repita uma pergunta que você já fez nesta conversa.
- Se o usuário já forneceu uma informação (nome, quantidade, tamanho, arquivo), REGISTRE-A e NÃO pergunte novamente.
- Se o usuário diz "já enviei", "já disse" ou similar, acredite nele e avance no fluxo.
- Seja objetivo e linear. Colete um dado por vez. Após reunir nome, serviço, quantidade e arte, crie o orçamento imediatamente.
- Antes de chamar qualquer ferramenta, confirme mentalmente que tem TODOS os parâmetros obrigatórios.
- NUNCA chame a mesma ferramenta duas vezes seguidas com os mesmos argumentos.`;

    try {
      // 1. Retrieve or initialise session (with tool cache)
      const tools = await this._getTools(contact);

      // 2. Map MCP tools → Gemini function declarations
      const functionDeclarations = tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      }));

      // 3. Build model — thinkingConfig (Gemini 2.0+) forces the model to reason
      //    before answering, which dramatically reduces hallucinations and wrong
      //    function calls. Docs: ai.google.dev/gemini-api/docs/thinking
      //    Temperature MUST stay at 1.0 for Gemini 2.0+ (see function-calling docs).
      const model = this.genAI.getGenerativeModel({
        model: this.geminiModel,
        systemInstruction: { role: "system", parts: [{ text: fullSystemPrompt }] },
        tools: [{ functionDeclarations }],
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: 1.0,
          // thinkingConfig — low = cost-efficient but still ~60 % improvement
          // in reasoning accuracy vs no thinking. Use "medium" for more complex flows.
          thinkingConfig: { thinkingLevel: "low" },
        } as any,
      });

      // 4. Get or create chat session (preserves full conversation history)
      let session = this.sessions.get(contact);
      if (!session || !session.chat) {
        const chat = model.startChat({ history: [] });
        session = { chat, tools, toolsFetchedAt: session?.toolsFetchedAt ?? Date.now() };
        this.sessions.set(contact, session);
      }

      // 5. Build message payload (text-only or multimodal)
      let messagePayload: any = text;
      if (mediaData) {
        messagePayload = [
          text,
          { inlineData: { data: mediaData.base64, mimeType: mediaData.mimetype } },
        ];
      }

      // 6. Send message and handle agentic tool-call loop
      let result = await session.chat.sendMessage(messagePayload);
      let response = result.response;

      // Limit to 5 tool-call rounds to avoid runaway loops
      let callCount = 0;
      while (
        callCount < 5 &&
        response.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall)
      ) {
        const toolCalls = response.candidates![0].content.parts.filter(
          (p: any) => p.functionCall,
        );

        const toolResponses = await Promise.all(
          toolCalls.map(async (call: any) => {
            const { name, args, id } = call.functionCall;
            const toolResult = await this._callErpTool(name, args);
            return {
              functionResponse: {
                // Include `id` as required by Gemini 2.0+ for thought signatures
                // (docs: function-calling.md, line ~981)
                ...(id ? { id } : {}),
                name,
                response: toolResult,
              },
            };
          }),
        );

        result = await session.chat.sendMessage(toolResponses as any);
        response = result.response;
        callCount++;
      }

      return response.text();
    } catch (error: any) {
      console.error("AI Error:", error?.response?.data || error?.message || error);
      return "Desculpe, tive um problema técnico ao processar sua consulta. Poderia repetir?";
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Returns cached tools for the contact session, refreshing if TTL expired.
   * Avoids one ERP round-trip per message — tools rarely change mid-conversation.
   */
  private async _getTools(contact: string): Promise<any[]> {
    const session = this.sessions.get(contact);
    const now = Date.now();

    if (session && now - session.toolsFetchedAt < TOOL_CACHE_TTL_MS) {
      return session.tools;
    }

    const toolsResponse = await axios.post(`${this.erpBaseUrl}/mcp/rpc`, {
      method: "tools/list",
      params: {},
    });

    const tools: any[] = toolsResponse.data.tools ?? [];

    // Update or create partial session data (chat will be set later if needed)
    const existing = this.sessions.get(contact);
    this.sessions.set(contact, {
      chat: existing?.chat ?? null,
      tools,
      toolsFetchedAt: now,
    });

    return tools;
  }

  /** Calls an ERP MCP tool and returns its result (or an error object). */
  private async _callErpTool(name: string, args: any): Promise<any> {
    try {
      const response = await axios.post(`${this.erpBaseUrl}/mcp/rpc`, {
        method: "tools/call",
        params: { name, arguments: args },
      });
      return response.data;
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
