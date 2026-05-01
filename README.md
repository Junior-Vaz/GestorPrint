<div align="center">

# 🖨️ GestorPrint

**ERP SaaS multi-tenant completo para gráficas e comunicação visual**

Orçamentos · Produção (Kanban) · PDV · Financeiro · Loja online · WhatsApp IA · Fidelidade

[![NestJS](https://img.shields.io/badge/Backend-NestJS_11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Vue 3](https://img.shields.io/badge/Frontend-Vue_3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org)
[![Prisma](https://img.shields.io/badge/ORM-Prisma_5.21-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![Postgres](https://img.shields.io/badge/DB-PostgreSQL_15-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![TailwindCSS](https://img.shields.io/badge/Style-Tailwind_4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Deploy-Docker_+_EasyPanel-2496ED?logo=docker&logoColor=white)](https://easypanel.io)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

</div>

---

## 🎯 O que é?

**GestorPrint** é uma plataforma SaaS multi-tenant pensada de ponta a ponta para o dia a dia de uma gráfica moderna — do primeiro contato com o cliente até a entrega do pedido. Cada gráfica vira um **tenant isolado** com plano, time, clientes e dados próprios, tudo orquestrado por um painel administrativo separado.

> Construído pra rodar em produção em VPS modesto (4 GB RAM dão conta) com deploy via Docker + EasyPanel.

---

## ✨ Funcionalidades

### 📋 Orçamentos especializados
- **4 calculadoras dedicadas:** Serviço/Insumo, Plotter (com **preview 3D realista**), Recorte e Bordado
- Configuração 100% custodiada pela gráfica (preços, regras, materiais)
- **Link público** de aprovação do orçamento sem login
- Conversão automática em pedido com migração de anexos

### 🏭 Produção (Kanban)
- Quadro arrastável por status (Pendente → Produção → Finalizado → Entregue)
- WebSocket em tempo real entre operadores
- Filtros, busca e tags por equipe

### 🛒 PDV
- Caixa rápido com busca de produtos, carrinho e múltiplos métodos de pagamento
- **Resgate de pontos** de fidelidade no checkout
- Geração de pedido + comprovante PDF na hora

### 🧾 Financeiro & BI
- Contas a receber, contas a pagar, fluxo de caixa, despesas operacionais
- **Relatórios avançados** com gráficos e exportação **XLSX estilizado** (Excel pronto pra reunião)
- DRE, ticket médio, top clientes, top produtos, sazonalidade

### 🛍️ Loja online (Ecommerce SPA)
- Catálogo dinâmico, carrinho, checkout integrado **Mercado Pago** (PIX, cartão Brick, boleto)
- Frete real **Melhor Envios** (etiqueta comprada direto do admin)
- Reviews, cupons, wishlist server-side, blog gerenciável
- *(Storefront vive em [repositório separado](#-ecossistema))*

### 💎 Fidelidade
- Pontos por compra (configurável por gráfica) + cashback
- **Tiers** Bronze → Prata → Ouro → Platina
- Cupom de aniversário automático
- Programa de **indicação** com código pessoal
- Cron de expiração de pontos com aviso por e-mail (7 dias antes)

### 🤖 Dois agentes IA — schema compartilhado
| Agente | Onde | Quem usa | Persona |
|--------|------|----------|---------|
| **Chat ERP** | Widget flutuante no ERP | Operador autenticado | Assistente operacional |
| **WhatsApp** | Webhook Evolution API | Cliente final no WhatsApp | Atendente da gráfica |

Os dois consomem o **mesmo catálogo de 16+ tools** (criar orçamento, gerar cobrança PIX, buscar produto, marcar pago, etc) via servidor MCP único. Provider configurável: **Gemini, Groq, DeepSeek, OpenRouter, Ollama** — credenciais encriptadas em repouso (AES-256-GCM).

### 👥 RBAC granular
- Permissões por role + override por usuário
- Tela admin pra ajustar quem vê/cria/edita o quê
- Separação clara **TENANT** (gráfica) vs **PLATFORM** (sua equipe SaaS)

### 🏢 Painel SaaS Admin
- CRUD de tenants + plano + feature overrides individuais
- Métricas de MRR, churn, ativação
- **Impersonate** — entra no ERP de qualquer tenant pra dar suporte
- Equipe da plataforma separada do time das gráficas

---

## 🏗️ Arquitetura

```
                                ┌────────────────────────┐
                                │   PostgreSQL 15        │
                                │   (multi-tenant DB)    │
                                └───────────▲────────────┘
                                            │ Prisma 5
                                            │
                  ┌─────────────────────────┴─────────────────────────┐
                  │                  Backend NestJS 11                │
                  │  ┌─────────┬─────────┬─────────┬───────┬────────┐ │
                  │  │  Auth   │  ERP    │ MCP/AI  │ E-com │ Loyalty│ │
                  │  │  RBAC   │  Tools  │ 16 fns  │  API  │  Cron  │ │
                  │  └─────────┴─────────┴─────────┴───────┴────────┘ │
                  │       Swagger · WebSockets · Cron · Mailer        │
                  └─▲────────▲────────────▲───────────▲───────────▲──┘
                    │        │            │           │           │
            ┌───────┘   ┌────┘            │           │           └─────┐
            │           │                 │           │                 │
   ┌────────┴───┐ ┌─────┴──────┐  ┌───────┴────┐ ┌────┴─────┐ ┌─────────┴───┐
   │ ERP (Vue3) │ │ SaaS Admin │  │ WhatsApp   │ │ Storefront│ │   AI Chat   │
   │  app.*     │ │  admin.*   │  │  Evolution │ │  loja.*  │ │   widget    │
   │  port 5173 │ │  port 5174 │  │   webhook  │ │  (repo    │ │   no ERP    │
   └────────────┘ └────────────┘  └────────────┘ │  separado)│ └─────────────┘
                                                  └──────────┘
```

**Padrões fundamentais:**
- 🔐 JWT global com `userType: PLATFORM | TENANT` — duas portas de login distintas
- 🎯 `CheckFeatureUseCase` é a **única fonte da verdade** sobre o que cada plano libera
- 🚦 Feature gates em 3 camadas: `plan flag` + `RBAC` + `tenant config`
- 🗄️ Storage abstrato (`IStorageProvider`) — alterna disco local ↔ MinIO/S3 por env
- 📡 WebSocket gateways: produção (Kanban), notificações, logs

📖 **Documentação completa:** [`CLAUDE.md`](./CLAUDE.md) · [`AGENTS.md`](./AGENTS.md)

---

## 🧰 Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | NestJS 11 · TypeScript · Prisma 5.21 · PostgreSQL 15 · Socket.IO · BullMQ · Vercel AI SDK |
| **ERP** | Vue 3.5 (Composition API) · Pinia · TailwindCSS 4 · Vite 7 · Three.js (3D Plotter) · Chart.js |
| **SaaS Admin** | Vue 3.5 · Pinia · TailwindCSS 4 · Vite 7 |
| **Pagamentos** | Mercado Pago (PIX + Card Brick + Boleto) · Asaas (cobrança SaaS) |
| **Frete** | Melhor Envios (cotação + compra de etiqueta) |
| **WhatsApp** | Evolution API (gateway) + Vercel AI SDK function calling |
| **IA** | Gemini · Groq · DeepSeek · OpenRouter · Ollama · OpenAI TTS · ElevenLabs |
| **E-mail** | Nodemailer (SMTP transacional) · 4+ templates HTML responsivos |
| **Deploy** | Docker multi-stage · GitHub Actions · GHCR · EasyPanel |

---

## 🚀 Início rápido (dev)

### Pré-requisitos
- Node.js **20+** · Docker · PostgreSQL 15 (local ou Docker)

### Subindo tudo
```bash
git clone https://github.com/junior-vaz/GestorPrint.git
cd GestorPrint
cp .env.production.example .env

# Sobe Postgres + backend + frontends de uma vez
docker compose -f docker-compose.easypanel.yml up -d db
```

### Cada serviço em dev (com hot-reload)
```bash
# Backend
cd backend && npm install && npx prisma db push && npm run start:dev
# → http://localhost:3000  (Swagger em /api/docs · health em /api/health)

# ERP
cd frontend && npm install && npm run dev
# → http://localhost:5173

# SaaS Admin
cd saas-admin && npm install && npm run dev
# → http://localhost:5174
```

### Primeiro acesso
O backend cria o **super admin** automaticamente no boot inicial usando as variáveis:

```env
SUPER_ADMIN_EMAIL=admin@suaempresa.com
SUPER_ADMIN_PASSWORD=senha-forte-aqui
SUPER_ADMIN_NAME=Administrador
```

Faltando essas vars, fallback é `admin@gestorprint.com` / `admin123`. **Troque em produção.**

Login do SaaS Admin → `http://localhost:5174` · Login do ERP (após criar um tenant) → `http://localhost:5173`.

---

## 📦 Deploy em produção (EasyPanel)

O projeto vem com **`docker-compose.easypanel.yml`** pronto pra apontar no EasyPanel. As imagens vêm do **GHCR** (`ghcr.io/junior-vaz/gestorprint-{backend,frontend,saas-admin}`) atualizadas a cada push em `main` via [`build.yml`](./.github/workflows/build.yml).

```yaml
services:
  db:         postgres:15-alpine
  backend:    ghcr.io/junior-vaz/gestorprint-backend:latest
  frontend:   ghcr.io/junior-vaz/gestorprint-frontend:latest
  saas-admin: ghcr.io/junior-vaz/gestorprint-saas-admin:latest
```

### Variáveis obrigatórias

| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET` | Hex 32+ chars · `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Hex 32+ chars · usada pra encriptar credenciais Gemini/Evolution |
| `DATABASE_URL` | `postgresql://user:pass@db:5432/gestorprint_db?schema=public` |
| `API_URL` | URL pública da API · usada em webhooks e e-mails |
| `ALLOWED_ORIGINS` | CSV das origens do CORS (ERP + Admin + Loja) |
| `SUPER_ADMIN_*` | Seed do primeiro administrador |
| `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` | Mercado Pago |
| `ASAAS_API_KEY` / `ASAAS_WEBHOOK_TOKEN` | Cobrança SaaS |
| `INTERNAL_API_KEY` | Compartilhada com o WhatsApp gateway |

Veja [`.env.production.example`](./.env.production.example) pro template completo.

### Mapeamento de domínios sugerido
| Subdomínio | Aponta para | Função |
|------------|-------------|--------|
| `api.suaempresa.com` | service `backend` :3000 | API REST + WebSocket |
| `app.suaempresa.com` | service `frontend` :80 | ERP das gráficas |
| `admin.suaempresa.com` | service `saas-admin` :80 | Painel da plataforma |

---

## 🗂️ Estrutura do repositório

```
GestorPrint/
├── backend/              # NestJS API + Prisma + AI Engine
│   ├── prisma/           # schema, migrations, seed
│   └── src/
│       ├── domain/       # Entidades puras
│       ├── application/  # Casos de uso (CheckFeature, etc)
│       ├── infrastructure/  # Prisma, Storage, repos
│       ├── shared/       # SharedModule global, guards, decorators
│       └── interface/
│           ├── http/     # Um folder por módulo (auth, orders, loyalty, ai-chat, mcp...)
│           └── websocket/  # Gateways Kanban + notifs + logs
│
├── frontend/             # ERP Vue 3 (operadores das gráficas)
│   └── src/
│       ├── views/        # Home, PDV, Kanban, Estimates*, Customers, Loyalty...
│       ├── stores/       # Pinia (auth, plan, notification, ui)
│       ├── components/   # AiChatWidget, modals compartilhados, sidebar
│       └── composables/  # useEstimateBase, useToast, useConfirm
│
├── saas-admin/           # Painel SaaS Admin Vue 3 (sua equipe)
│   └── src/views/        # Dashboard, Tenants, Plans, PlatformTeam, Logs
│
├── .github/workflows/    # CI/CD — build + push pra GHCR
├── docker-compose.easypanel.yml  # Stack pronta pra EasyPanel
├── .env.production.example
├── CLAUDE.md             # Guia para Claude Code (regras de codebase)
├── AGENTS.md             # Mapa dos agentes IA
└── README.md             # você está aqui
```

---

## 🌐 Ecossistema

| Repo | Stack | Função |
|------|-------|--------|
| [`GestorPrint`](https://github.com/junior-vaz/GestorPrint) | NestJS + Vue 3 ×2 | **Este repo** — backend + ERP + SaaS Admin |
| `Ecommerce` *(separado)* | Vue 3 SPA | Storefront público da loja online |

---

## 🛡️ Segurança

- 🔒 JWT global com `JwtAuthGuard` (opt-out via `@Public()`)
- 🛡️ Rate-limit em login + endpoints sensíveis
- 🪖 Helmet + CORS estrito por origem
- 🔐 Credenciais de IA/WhatsApp encriptadas em repouso (AES-256-GCM)
- 📜 Auditoria automática de ações críticas (`AuditLog`)
- ✅ Webhook Mercado Pago com validação HMAC
- 🚫 Tenant suspenso → 403 em qualquer endpoint protegido
- 🧱 `ValidationPipe` com `whitelist + forbidNonWhitelisted` global

---

## 📊 Highlights de engenharia

- **Multi-tenant real:** todo modelo escopável tem `tenantId`, queries filtram automaticamente, super admin só por `userType: PLATFORM`
- **Single source of truth pra features:** `CheckFeatureUseCase` é o ÚNICO lugar que decide se um plano libera algo
- **Storage agnóstico:** troca disco local ↔ MinIO/S3 só mudando uma env
- **Tools-first AI:** adicionar uma nova capacidade pro chat IA = registrar 1 função no `mcp.service.ts`. Os 2 agentes (ERP + WhatsApp) ganham automaticamente
- **3D no Plotter:** preview com Three.js, decal de arte aplicado em tempo real, exportação no PDF
- **Migrations idempotentes:** primeiro boot detecta legado e migra `isSuperAdmin → userType=PLATFORM` sem dor

---

## 📞 Contato

**Desenvolvedor principal:** [@junior-vaz](https://github.com/junior-vaz)

Para bugs, sugestões ou customização para sua gráfica → abra uma issue ou contato direto.

---

<div align="center">

**Construído com ❤️ para gráficas brasileiras que querem operar como SaaS sério.**

</div>
