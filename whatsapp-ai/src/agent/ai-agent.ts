import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import axios from "axios";

export class AiAgent {
  private genAI: GoogleGenerativeAI;
  private erpBaseUrl = "http://localhost:3000/api";
  private geminiModel: string;
  private maxTokens: number;

  private chatSessions: Map<string, any> = new Map();

  constructor(apiKey: string, geminiModel = "gemini-2.0-flash", maxTokens = 1000) {
    this.genAI = new GoogleGenerativeAI(apiKey.trim());
    this.geminiModel = geminiModel;
    this.maxTokens = maxTokens;
  }

  // Clear memory for a contact (call after order is complete)
  clearSession(contact: string) {
    this.chatSessions.delete(contact);
    console.log(`🗑️ Sessão apagada para ${contact}`);
  }

  async processMessage(contact: string, text: string, systemPrompt: string, mediaData?: { base64: string, mimetype: string }) {
    // Anti-hallucination addendum: always appended to system prompt
    const fullSystemPrompt = systemPrompt + `

REGRAS CRÍTICAS DE COMPORTAMENTO:
- NUNCA repita uma pergunta que você já fez nesta conversa.
- Se o usuário já forneceu uma informação (nome, quantidade, tamanho, arquivo), REGISTRE-A e NÃO pergunte novamente.
- Se o usuário diz "já enviei", "já disse" ou similar, acredite nele e avance no fluxo.
- Seja objetivo. Após coletar todas as informações necessárias (nome, serviço, quantidade, arte), crie imediatamente o orçamento e gere o Pix.`;

    try {
      // 1. Get available tools from ERP MCP
      const toolsResponse = await axios.post(`${this.erpBaseUrl}/mcp/rpc`, {
        method: "tools/list",
        params: {}
      });
      
      const mcpTools = toolsResponse.data.tools;

      // 2. Map MCP tools to Gemini function declarations
      const declarationTools = mcpTools.map((t: any) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }));

      const model = this.genAI.getGenerativeModel({
        model: this.geminiModel,
        systemInstruction: { role: "system", parts: [{ text: fullSystemPrompt }] },
        tools: [{ functionDeclarations: declarationTools }],
      });

      // 3. Start Chat or retrieve existing (preserves history across messages)
      let chat = this.chatSessions.get(contact);
      if (!chat) {
        chat = model.startChat({
          history: [],
          generationConfig: { maxOutputTokens: this.maxTokens },
        });
        this.chatSessions.set(contact, chat);
        console.log(`🆕 Nova sessão criada para ${contact}`);
      } else {
        console.log(`♻️ Sessão reutilizada para ${contact}`);
      }

      let messagePayload: any = text;
      if (mediaData) {
        messagePayload = [
          text,
          { inlineData: { data: mediaData.base64, mimeType: mediaData.mimetype } }
        ];
      }

      let result = await chat.sendMessage(messagePayload);
      let response = result.response;
      
      // Handle potential multiple tool calls in a loop
      let callCount = 0;
      while (response.candidates![0].content.parts.some((p: any) => p.functionCall) && callCount < 5) {
        const toolCalls = response.candidates![0].content.parts.filter((p: any) => p.functionCall);
        const toolResponses = [];

        for (const call of toolCalls) {
          const { name, args } = (call as any).functionCall;
          console.log(`AI calling tool: ${name}`, args);
          
          const toolResult = await this.callErpTool(name, args);
          console.log(`   🛠️ Ferramenta "${name}" respondeu com sucesso.`);
          toolResponses.push({
            functionResponse: {
              name,
              response: toolResult
            }
          });
        }

        result = await chat.sendMessage(toolResponses as any);
        response = result.response;
        callCount++;
      }

      return response.text();
    } catch (error: any) {
      console.error("AI Error Full:", error?.response?.data || error);
      if (error.response?.data) console.error("ERP Error Details:", error.response.data);
      require('fs').writeFileSync('ai-error-dump.log', JSON.stringify({ message: error.message, error: error, data: error?.response?.data }, null, 2));
      return "Desculpe, tive um problema técnico ao processar sua consulta. Poderia repetir?";
    }
  }

  private async callErpTool(name: string, args: any) {
    try {
      const response = await axios.post(`${this.erpBaseUrl}/mcp/rpc`, {
        method: "tools/call",
        params: { name, arguments: args }
      });
      return response.data;
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
