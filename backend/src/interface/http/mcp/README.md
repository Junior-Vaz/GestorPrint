# MCP — Model Context Protocol (servidor de tools compartilhado)

Este módulo é o **servidor de capacidades** consumido pelos dois agentes IA do GestorPrint:

```
        ┌──────────────────────────┐
        │   /interface/http/mcp/   │ ◄── tools compartilhadas
        └──────────┬───────────────┘
                   │
       ┌───────────┴────────────┐
       ▼                        ▼
┌──────────────┐         ┌────────────────┐
│ /ai-chat/    │         │ whatsapp-ai/   │
│ (chat ERP)   │         │ (Evolution WA) │
└──────────────┘         └────────────────┘
```

## O que vive aqui

### `mcp.service.ts` — coração

- **`toolsCatalog()`** — lista de 16 tools com schema JSON (Gemini function-calling)
- **`callTool(name, args, tenantId)`** — dispatch que executa a tool e retorna no formato MCP
- 16 tools agrupadas:
  - **Cliente**: `find_or_create_customer`, `get_customer_history`
  - **Catálogo**: `search_products`, `quote_price`
  - **Orçamentos**: `create_estimate`, `send_estimate_link`, `list_customer_estimates`
  - **Pedidos**: `convert_estimate_to_order`, `get_order_status`, `list_customer_orders`
  - **Pagamentos**: `generate_payment`, `check_payment_status`
  - **Arquivos**: `upload_artwork`
  - **Negócio**: `get_business_info`
  - **Escalação**: `notify_operator`
- CRUD da `AiConfig` (chave Gemini, modelo, prompt, restrições, instância Evolution)
- Proxy Evolution API (status/connect/logout/restart)

### `mcp.controller.ts` — só HTTP

- `POST /mcp/rpc` — Gemini function-calling (chamado pelo whatsapp-ai). Rate limit 30/s.
- `POST /mcp/preview` — testar conversa pela UI (proxy pro `/preview` do whatsapp-ai)
- `GET/PATCH /mcp/config` — UI do ERP edita AiConfig
- `/mcp/evolution/*` — UI conecta/desconecta WhatsApp
- `GET /mcp/config-internal` — usado internamente pelo whatsapp-ai (`x-internal-key`)
- `GET /mcp/tenant-by-instance/:instance` — base da multi-tenancy real

## Quem importa o quê

```typescript
McpModule
  ├─ exports: McpService   ← AiChatModule importa pra usar tools
  └─ controllers: McpController
```

## Credenciais sensíveis

`geminiKey` e `evolutionKey` são encriptadas em repouso via `CredentialEncryptor` (AES-256-GCM, chave master `ENCRYPTION_KEY` no env). Migração lazy — valores legados em texto puro re-encriptam na próxima save.

## Variáveis no `agentPrompt`

`getAiConfig()` injeta automaticamente:

| Variável | Origem |
|---|---|
| `{{businessName}}` | `Tenant.name` |
| `{{address}}` | `Tenant.address` + bairro/cidade/estado |
| `{{phone}}` | `Tenant.ownerPhone` |
| `{{email}}` | `Tenant.ownerEmail` |
| `{{businessHours}}` | `Settings.businessHours` |
| `{{paymentMethods}}` | hardcoded `['PIX','Cartão','Boleto','Dinheiro']` |
| `{{deliveryDays}}` | `Settings.defaultDeliveryDays` |

O admin escreve um prompt enxuto e a IA recebe contexto completo da gráfica.
