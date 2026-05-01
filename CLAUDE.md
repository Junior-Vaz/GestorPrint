# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Workspace rules (preserve these always)

### SSOT — AI tooling mirrors
**`.cursor/` is the only canonical source.** Never edit `.claude/`, `.vscode/`, `.continue/`, or `.opencode/` directly — they are symlink mirrors of `.cursor/`. All edits must go in `.cursor/` and be propagated by `bootstrap-mirror-symlinks.ps1`.

### Protected areas — plan required before structural changes
Before creating, moving, renaming, merging, or deleting files under any of these paths, **present a complete plan and wait for explicit approval** — even if the user says "execute":

| Area | Path |
|------|------|
| Documentation | `Documentation/` (recursive) |
| Skills | `.cursor/skills/` (recursive) |
| Templates | `.cursor/Templates/` (recursive) |
| Agents | `.cursor/agents/` (recursive) |
| Rules | `.cursor/rules/` (recursive) |

---

## Project overview

**GestorPrint** is a multi-tenant SaaS ERP for print shops. Four services:

| Service | Tech | Dev port | Purpose |
|---------|------|----------|---------|
| `backend/` | NestJS 11 + Prisma 5.21 + PostgreSQL 15 | 3000 | REST API + WebSockets |
| `frontend/` | Vue 3.5 + Pinia + TailwindCSS 4 + Vite 7 | 5173 | ERP SPA (TypeScript) |
| `saas-admin/` | Vue 3.5 + Pinia + TailwindCSS 4 + Vite 7 | 5174 | Platform admin panel |
| `ai-agent/` | Express 5 + Google Gemini + MCP SDK | 3005 | WhatsApp AI flow agent |

Full architecture: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Development commands

### Backend
```bash
cd backend
npm run start:dev                                     # watch mode
npm run build && npm run start:prod                   # production
npm run test                                          # jest
npm run test -- --testPathPattern=orders.service      # single file
npm run test:cov                                      # coverage
npm run lint && npm run format
npx prisma db push                                    # sync schema (dev)
npx prisma studio                                     # DB GUI
```

### Frontend
```bash
cd frontend
npm run dev              # http://localhost:5173
npm run build            # type-check + vite build
npm run build-only       # vite build only (skip type-check)
npm run type-check       # vue-tsc
npm run lint             # oxlint + eslint (both with --fix)
npm run format
```

### SaaS Admin
```bash
cd saas-admin
npm run dev              # http://localhost:5174
npm run build
npm run type-check
```

### WhatsApp AI
```bash
cd ai-agent
npm run dev              # tsx watch
npm run start            # tsx (production)
```

### Full stack
```bash
docker-compose up -d                   # start all
docker-compose logs -f backend         # follow logs
```

Swagger: http://localhost:3000/api/docs  
Health: http://localhost:3000/api/health

---

## Backend architecture

### Layer structure
```
src/
  domain/entitlement/      # Pure domain: TenantEntitlement entity, FeatureKey enum
  application/entitlement/ # CheckFeatureUseCase — single source of truth for feature gates
  infrastructure/
    persistence/prisma/    # PrismaService
    entitlement/           # PrismaEntitlementRepository
    storage/               # IStorageProvider (local | minio, switched via STORAGE_PROVIDER env)
  shared/                  # @Global() SharedModule + StorageModule
    guards/feature.guard.ts
    decorators/require-feature.decorator.ts
  interface/
    http/                  # One folder per module (controller + service + DTOs)
    websocket/             # orders.gateway.ts, notifications.gateway.ts, logs.gateway.ts
```

### Module list (`src/interface/http/`)
`auth`, `audit`, `billing`, `customers`, `estimates`, `expenses`, `files`, `logs`, `mcp`, `messaging`, `notifications`, `orders`, `payments`, `plans`, `product-types`, `products`, `reports`, `settings`, `suppliers`, `tenants`, `users`

### Global providers (no import needed in other modules)
- `SharedModule` — exports `PrismaService`, `CheckFeatureUseCase`, `FeatureGuard`
- `StorageModule` — exports `IStorageProvider` token

### Feature gate pattern
```typescript
// Controller endpoint:
@Get(':id/pdf')
@RequireFeature(FeatureKey.PDF_GENERATION)  // applies FeatureGuard automatically
async getPdf() { ... }

// Service (programmatic check):
await this.checkFeature.execute(tenantId, FeatureKey.KANBAN_BOARD);
// or boolean:
const allowed = await this.checkFeature.check(tenantId, FeatureKey.PIX_PAYMENTS);
```
`CheckFeatureUseCase` is the **only** source of truth — never replicate this logic in services.

### Authentication
- `JwtAuthGuard` is applied globally; opt out with `@Public()` decorator.
- JWT accepts token via `Authorization: Bearer` header **or** `?token=` query param (used for file downloads).
- `@CurrentTenant()` param decorator extracts `tenantId: number` from the JWT.
- Super admins (`isSuperAdmin: true` in JWT payload) bypass tenant suspension checks and feature gates.

### DTO validation
`ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true, transform: true`. Every field the client sends **must be declared in the DTO**, including optional ones. Use `@ValidateIf(o => !!o.email)` before `@IsEmail()` to avoid failures when optional email fields are empty strings.

### Prisma — date handling
Date-only strings from the frontend (`"2026-03-20"`) must be converted before Prisma queries:
```typescript
function toDateTime(s?: string | null): string | null | undefined {
  if (!s) return s === null ? null : undefined;
  return s.length === 10 ? `${s}T00:00:00.000Z` : s;
}
```

### File uploads
- Limit: 50 MB. Executables and scripts are blocked (see `BLOCKED_EXTENSIONS` in [files.controller.ts](backend/src/interface/http/files/files.controller.ts)).
- Serve files: `GET /api/files/:tenantId/:filename` and `GET /api/files/:filename` are `@Public()` — no auth required (used by `<img>` tags for logos).
- Storage provider switches via `STORAGE_PROVIDER=minio` env; defaults to local disk.

### WebSocket gateways
Three Socket.IO gateways in `src/interface/websocket/`: `orders.gateway.ts` (production Kanban), `notifications.gateway.ts`, `logs.gateway.ts`. The logs gateway is wired as the app logger in `main.ts`.

---

## Frontend architecture

### API calls
All HTTP calls **must** use `apiFetch` from [src/utils/api.ts](frontend/src/utils/api.ts). Never use raw `fetch()` or `axios` — `apiFetch` injects the JWT from `localStorage` key `gp_token`, handles 401 redirects to `/login`, and emits `plan:limit` custom events on 403 responses.

### Authenticated file downloads
Use `?token=` — never open a URL without auth:
```typescript
const token = localStorage.getItem('gp_token')
window.open(`/api/files/${id}/download?token=${token}`)
```

### Pinia stores
| Store | Key exports |
|-------|-------------|
| `auth.ts` | JWT, user, role, `gp_token` / `gp_user` localStorage keys |
| `plan.ts` | Feature computed refs (`hasPdf`, `hasKanban`, `hasWhatsapp`, etc.); all fail-closed while loading — returns `false` until data arrives |
| `notification.ts` | Toast queue |
| `ui.ts` | Global UI state |

Plan store feature flags gate UI elements. Always check them before rendering plan-gated sections.

### Vue Router
Token key is `gp_token`. Guard uses return syntax (not the deprecated `next()` callback):
```typescript
router.beforeEach((to) => {
  if (!localStorage.getItem('gp_token') && !publicRoutes.includes(to.name)) return { name: 'login' }
})
```

### Composables
- `useEstimateBase.ts` — shared CRUD logic reused by all four estimate type views
- `useToast.ts` — notifications
- `useConfirm.ts` — confirmation dialogs

### Vite proxy (dev only)
`/api` → `http://localhost:3000`, `/socket.io` → `http://localhost:3000` (WebSocket). Production uses `VITE_API_URL` build arg baked in at Docker build time.

---

## SaaS Admin panel

Separate Vue 3 SPA at port 5174. Uses `sa_token` (not `gp_token`) in localStorage. Routes: dashboard, tenants (CRUD + detail), plans, settings, logs. Communicates with the same backend via `/api/`.

---

## Dois agentes IA — separados mas compartilham tools

O GestorPrint tem **dois agentes Gemini distintos** que reusam o mesmo conjunto de capacidades:

```
              ┌─────────────────────────────┐
              │   /mcp/* (backend)          │
              │   16 tools compartilhadas   │
              └──────────┬──────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
   ┌────────────────┐        ┌────────────────┐
   │ Chat ERP       │        │ WhatsApp Agent │
   │ /api/ai-chat/  │        │ ai-agent/   │
   │ (operador)     │        │ (cliente)      │
   └────────────────┘        └────────────────┘
```

### Chat ERP — backend `src/interface/http/ai-chat/`
Widget flutuante no canto inferior direito do ERP. Operador autenticado conversa em linguagem natural pra executar comandos no sistema. Reusa `McpService.callTool()` direto (sem HTTP). Sessão por `(tenantId, userId)`. Persona: "assistente operacional do ERP".
Ver [backend/src/interface/http/ai-chat/README.md](backend/src/interface/http/ai-chat/README.md).

### WhatsApp Agent — `ai-agent/` (porta 3005)
Express server separado. Recebe webhooks da Evolution API, processa via Gemini com function-calling, e responde via Evolution. Sessão por telefone. Persona: "atendente da gráfica falando com cliente".
Ver [ai-agent/README.md](ai-agent/README.md).

### Servidor compartilhado de tools — backend `src/interface/http/mcp/`
16 funções declarativas (`find_or_create_customer`, `search_products`, `create_estimate`, `generate_payment`, etc) com schema JSON pra Gemini function-calling. Implementação única em `mcp.service.ts`. Adicionar tool nova propaga pros 2 agentes automaticamente.
Ver [backend/src/interface/http/mcp/README.md](backend/src/interface/http/mcp/README.md).

### Credenciais sensíveis
`geminiKey` e `evolutionKey` são encriptadas em repouso via `CredentialEncryptor` (AES-256-GCM, chave master `ENCRYPTION_KEY` no `.env`). Migração lazy — valores legados em texto puro re-encriptam na próxima save.

---

## Prisma schema highlights

Key models and their tenant-scoping:
- `Tenant` — SaaS account; `plan` (FREE/BASIC/PRO/ENTERPRISE) + `planStatus` (TRIAL/ACTIVE/SUSPENDED/CANCELLED)
- `PlanConfig` — feature flags per plan (the `PrismaEntitlementRepository` reads this to resolve feature access)
- `TenantEntitlement` + `TenantFeatureOverride` — per-tenant quota overrides and individual feature grants/blocks
- `Subscription` + `SubscriptionEvent` — Asaas/Stripe payment lifecycle state machine
- `Estimate` — polymorphic via `estimateType` field (service | plotter | cutting | embroidery); details stored as `Json`
- `Order` — production job; status: PENDING → PRODUCTION → FINISHED → DELIVERED
- `AiConfig` — chave Gemini, modelo, prompt, restrições (allowedProductIds/allowedEstimateTypes), instância Evolution. Credenciais encriptadas (AES-256-GCM).

All tenant-scoped models have `tenantId Int @default(1)` — always filter by it in every query.

Schema: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

---

## Environment variables

Copy `.env.production.example`. Required:

```env
# Database
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
DATABASE_URL=postgresql://...@db:5432/gestorprint_db?schema=public

# Backend
JWT_SECRET=<long random string>
API_URL=https://api.your-domain.com

# Payments / billing
MP_ACCESS_TOKEN / MP_PUBLIC_KEY        # Mercado Pago PIX
ASAAS_API_KEY / ASAAS_WEBHOOK_TOKEN    # Asaas SaaS billing
ASAAS_ENV=sandbox|production

# WhatsApp AI
INTERNAL_API_KEY=<shared secret between backend and ai-agent>
TENANT_ID=1

# Frontend (build arg — baked in at Docker build time)
VITE_API_URL=https://api.your-domain.com
```

Optional: `STORAGE_PROVIDER=minio` (defaults to local disk).

---

## CI/CD

`.github/workflows/build.yml` triggers on push to `main`:
1. Validates each service (build / type-check) in parallel
2. Builds and pushes Docker images to GHCR tagged `:latest` and `:{git-sha}`

Images: `ghcr.io/{owner}/gestorprint-{backend|frontend|saas-admin|ai-agent}`

<!-- internal_template_version: 2.1.0 -->
