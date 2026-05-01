# AI Chat — agente IA do **ERP** (chat operacional)

Este é **o agente que opera o ERP por linguagem natural**. Diferente do agente do WhatsApp, aqui quem fala é o **operador autenticado** (admin/seller/operator) — não o cliente final.

```
┌─────────────────────────────────────────────────────┐
│  AiChatWidget (Vue, canto inferior direito)         │
│         │                                            │
│         ▼ POST /api/ai-chat/message  (JWT)          │
│  ┌─────────────────────┐                            │
│  │  AiChatService      │                            │
│  │  (Gemini SDK +      │                            │
│  │   loop agentic)     │                            │
│  └──────────┬──────────┘                            │
│             │ McpService.callTool(name, args, ten)  │
│             ▼                                        │
│  ┌─────────────────────┐                            │
│  │  16 tools MCP       │ ← compartilhadas com WA    │
│  └─────────────────────┘                            │
└─────────────────────────────────────────────────────┘
```

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/ai-chat/message` | manda mensagem do operador, devolve resposta |
| `POST` | `/api/ai-chat/reset` | limpa o histórico da sessão |

Ambos exigem JWT + feature `WHATSAPP_AI` (mesma do WhatsApp por enquanto).

## Diferenças vs agente do WhatsApp

| | WhatsApp | Chat ERP |
|---|---|---|
| **Quem fala** | Cliente final | Operador da gráfica |
| **Sessão** | Por telefone | Por `(tenantId, userId, sessionId)` |
| **Persona** | "atendente da gráfica" | "assistente operacional do ERP" |
| **Persiste** | Não (state em memória do AiAgent) | Não (state em memória do AiChatService) |
| **TTL ocioso** | 5min cache de tools | 30min cleanup automático |
| **Prompt** | Foco em vendas/atendimento | Foco em executar comandos |
| **Loop agentic** | até 12 rounds | até 12 rounds |

## Reutilização — o ponto-chave

`AiChatService` **não duplica** as 16 tools — importa o `McpService` e chama `callTool()` direto. Adicionar uma tool nova no MCP propaga automaticamente pros 2 agentes.

## Configuração

O agente lê `AiConfig` do tenant (mesma usada pelo WhatsApp):
- `geminiKey` — API key do Google AI Studio
- `geminiModel` — `gemini-2.0-flash` recomendado
- `agentPrompt` — usado como persona, com `{{variáveis}}` expandidas em runtime
- `enabled` — ativa/desativa o agente

Se `enabled=false` ou `geminiKey` vazio → `AiChatService.sendMessage()` lança `BadRequestException` e o widget mostra mensagem de erro.
