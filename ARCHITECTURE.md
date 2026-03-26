# GestorPrint - Documentação de Arquitetura

## 1. Visão Geral do Projeto

### 1.1 Descrição

O **GestorPrint** é um sistema ERP SaaS multi-tenant completo para gestão de empresas gráficas, desenvolvido com tecnologias modernas e escaláveis. O sistema oferece funcionalidades completas para gerenciamento de orçamentos, pedidos, clientes, produtos, finanças e automação de atendimento via WhatsApp com inteligência artificial.

### 1.2 Stack Tecnológico

| Componente | Tecnologia | Versão |
|------------|------------|---------|
| **Backend API** | NestJS | 11.x |
| **ORM** | Prisma | 5.21.1 |
| **Banco de Dados** | PostgreSQL | 15+ |
| **Frontend ERP** | Vue 3 + TypeScript | 3.5.x |
| **Estado Global** | Pinia | 3.0.x |
| **UI Framework** | TailwindCSS | 4.x |
| **Admin SaaS** | Vue 3 + TailwindCSS | 3.5.x |
| **WhatsApp AI** | Express + Gemini AI | 5.x |
| **Real-time** | Socket.IO | 4.8.x |
| **Build Tools** | Vite | 7.x |

---

## 2. Arquitetura de Diretórios

```
GestorPrint/
├── backend/                    # API REST NestJS (Porta 3000)
│   ├── prisma/
│   │   └── schema.prisma       # Schema do banco de dados
│   ├── src/
│   │   ├── auth/               # Módulo de autenticação JWT
│   │   ├── tenants/            # Gestão multi-tenant
│   │   ├── users/              # Gestão de usuários
│   │   ├── customers/          # Gestão de clientes
│   │   ├── products/           # Catálogo de produtos
│   │   ├── product-types/      # Tipos de produtos
│   │   ├── estimates/          # Orçamentos
│   │   ├── orders/             # Pedidos de produção
│   │   ├── payments/           # Integração Mercado Pago
│   │   ├── billing/            # Gestão Asaas (SaaS)
│   │   ├── plans/              # Planos e features
│   │   ├── expenses/           # Controle de despesas
│   │   ├── reports/            # Relatórios financeiros
│   │   ├── files/              # Upload de arquivos
│   │   ├── messaging/          # Envio de e-mails SMTP
│   │   ├── notifications/      # Notificações do sistema
│   │   ├── audit/              # Logs de auditoria
│   │   ├── mcp/                # Model Context Protocol
│   │   ├── logs/               # WebSocket de logs
│   │   ├── settings/           # Configurações da empresa
│   │   ├── suppliers/          # Gestão de fornecedores
│   │   ├── prisma/             # Prisma Service
│   │   ├── app.module.ts       # Módulo raiz
│   │   ├── main.ts             # Entry point
│   │   └── app.controller.ts  # Health check
│   └── uploads/                # Arquivos enviados
├── frontend/                   # Aplicação Vue 3 (Porta 5173)
│   ├── src/
│   │   ├── components/         # Componentes reutilizáveis
│   │   │   ├── AppBoard.vue    # Layout principal com Kanban
│   │   │   ├── PaymentModal.vue
│   │   │   ├── ConfirmModal.vue
│   │   │   ├── ToastContainer.vue
│   │   │   ├── NotificationBell.vue
│   │   │   ├── flow/           # Componentes do Flow Builder
│   │   │   └── icons/          # Ícones
│   │   ├── views/              # Páginas principais
│   │   │   ├── HomeView.vue    # Dashboard
│   │   │   ├── ProductsView.vue
│   │   │   ├── CustomersView.vue
│   │   │   ├── PdvView.vue     # Ponto de venda
│   │   │   ├── FinancialView.vue
│   │   │   ├── ReportsView.vue
│   │   │   ├── SettingsView.vue
│   │   │   ├── UsersView.vue
│   │   │   ├── AiView.vue      # Configuração WhatsApp AI
│   │   │   ├── AuditView.vue
│   │   │   ├── ExpensesView.vue
│   │   │   ├── SuppliersView.vue
│   │   │   ├── EstimatesListView.vue
│   │   │   ├── LoginView.vue
│   │   │   ├── AboutView.vue
│   │   │   └── estimates/      # Módulos de orçamento
│   │   │       ├── EstimatesServiceView.vue
│   │   │       ├── EstimatesPlotterView.vue
│   │   │       ├── EstimatesCuttingView.vue
│   │   │       ├── EstimatesEmbroideryView.vue
│   │   │       └── EstimateCalculator.vue
│   │   ├── stores/             # Pinia stores
│   │   │   ├── auth.ts         # Estado de autenticação
│   │   │   ├── plan.ts        # Features do plano
│   │   │   ├── notification.ts
│   │   │   ├── ui.ts
│   │   │   └── counter.ts
│   │   ├── composables/        # Composables Vue
│   │   │   ├── useEstimateBase.ts
│   │   │   ├── useToast.ts
│   │   │   └── useConfirm.ts
│   │   ├── utils/
│   │   │   └── api.ts          # Fetch wrapper com JWT
│   │   ├── router/
│   │   │   └── index.ts        # Rotas Vue Router
│   │   ├── App.vue
│   │   └── main.ts
│   └── package.json
├── saas-admin/                 # Painel Admin SaaS
│   ├── src/
│   │   ├── views/
│   │   │   ├── DashboardView.vue
│   │   │   ├── TenantsView.vue
│   │   │   ├── TenantDetailView.vue
│   │   │   ├── PlansView.vue
│   │   │   ├── BillingView.vue
│   │   │   ├── LogsView.vue
│   │   │   ├── SettingsView.vue
│   │   │   └── LoginView.vue
│   │   ├── components/
│   │   │   ├── SidebarLayout.vue
│   │   │   └── AlertModal.vue
│   │   └── App.vue
│   └── package.json
├── whatsapp-ai/               # Agente WhatsApp AI (Porta 3005)
│   ├── src/
│   │   ├── index.ts            # Servidor Express
│   │   ├── agent/
│   │   │   ├── ai-agent.ts     # Agente principal
│   │   │   └── gemini.ts       # Integração Gemini
│   │   ├── engine/
│   │   │   ├── flow-engine.ts  # Motor de fluxos
│   │   │   └── session-store.ts
│   │   ├── handlers/           # Handlers de nós
│   │   │   ├── triage.ts
│   │   │   ├── collect.ts
│   │   │   ├── situational.ts
│   │   │   ├── choice.ts
│   │   │   ├── vision.ts
│   │   │   ├── action.ts
│   │   │   └── end.ts
│   │   └── types/
│   │       └── flow.ts         # TypeScript definitions
│   └── package.json
└── ARCHITECTURE.md             # Este documento
```

---

## 3. Arquitetura de Dados (Prisma Schema)

### 3.1 Entidades Principais

#### Tenant (Multi-Tenant SaaS)
```prisma
model Tenant {
  id              Int       @id @default(autoincrement())
  name            String
  slug            String    @unique
  // Plano & Assinatura
  plan            String    @default("FREE")    // FREE, BASIC, PRO, ENTERPRISE
  planStatus      String    @default("TRIAL")  // TRIAL, ACTIVE, SUSPENDED, CANCELLED
  trialEndsAt     DateTime?
  planExpiresAt   DateTime?
  maxUsers        Int       @default(3)
  maxOrders       Int       @default(100)
  maxCustomers    Int       @default(50)
  // Dados da empresa
  razaoSocial     String?
  cpfCnpj         String?
  // Integração Asaas
  asaasCustomerId     String?
  asaasSubscriptionId String?
  // Relacionamentos
  customers, products, estimates, orders, users, expenses, etc.
}
```

#### Customer (Clientes)
```prisma
model Customer {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  name      String
  email     String?
  phone     String?
  document  String?
  address   String?
  city      String?
  state     String?
  orders    Order[]
  estimates Estimate[]
}
```

#### Product (Produtos/Estoque)
```prisma
model Product {
  id          Int    @id @default(autoincrement())
  tenantId    Int
  name        String
  productType ProductType @relation
  typeId      Int
  unit        String   @default("un")  // m², kg, un, h
  unitPrice   Float
  markup      Float   @default(0)      // Margem %
  stock       Float   @default(0)
  minStock    Float   @default(0)
  supplierId  Int?
  movements   StockMovement[]
}
```

#### Estimate (Orçamentos)
```prisma
model Estimate {
  id            Int      @id @default(autoincrement())
  tenantId      Int
  customer      Customer @relation
  customerId    Int
  status        String   @default("DRAFT")  // DRAFT, SENT, APPROVED, REJECTED
  estimateType  String   @default("service")  // service, plotter, cutting, embroidery
  details       Json     // Campos dinâmicos da calculadora
  totalPrice    Float
  salespersonId Int?
  orders        Order[]
  attachments   Attachment[]
}
```

#### Order (Pedidos de Produção)
```prisma
model Order {
  id                 Int       @id @default(autoincrement())
  tenantId           Int
  customer           Customer  @relation
  customerId         Int
  estimate           Estimate? @relation
  estimateId         Int?
  productDescription String    // Snapshot do serviço
  amount             Float
  status             String    @default("PENDING")  // PENDING, PRODUCTION, FINISHED, DELIVERED
  details            Json?     // Itens para pedidos PDV
  salespersonId      Int?
  producerId         Int?
  transactions       Transaction[]
  attachments        Attachment[]
}
```

#### PlanConfig (Planos SaaS)
```prisma
model PlanConfig {
  id          Int      @id @default(autoincrement())
  name        String   @unique  // FREE, BASIC, PRO, ENTERPRISE
  displayName String
  price       Float    @default(0)
  
  // Limites
  maxUsers     Int     @default(1)
  maxOrders    Int     @default(30)
  maxCustomers Int     @default(50)
  
  // Features
  hasPdf              Boolean @default(false)
  hasReports          Boolean @default(false)
  hasKanban           Boolean @default(false)
  hasFileUpload       Boolean @default(false)
  hasWhatsapp         Boolean @default(false)
  hasPix              Boolean @default(false)
  hasPlotterEstimate  Boolean @default(false)
  hasCuttingEstimate  Boolean @default(false)
  hasEmbroideryEstimate Boolean @default(false)
  hasAudit            Boolean @default(false)
  hasCommissions      Boolean @default(false)
  hasApiAccess        Boolean @default(false)
}
```

### 3.2 Fluxo de Dados Entre Entidades

```
Tenant (1) ──────► (N) User
      │
      ├──► (N) Customer ──────► (N) Order
      │         │
      │         └──► (N) Estimate ────► (N) Order
      │
      ├──► (N) Product ──────► (N) StockMovement
      │         │
      │         └──► (N) ProductType
      │
      ├──► (N) Order ──────► (N) Transaction
      │
      ├──► (N) Expense
      │
      ├──► (N) Supplier
      │
      ├──► Settings (1:1)
      │
      ├──► AiConfig (1:1)
      │
      ├──► FlowConfig (1:1)
      │
      └──► (N) FlowSession
```

---

## 4. Arquitetura Backend (NestJS)

### 4.1 Módulos e Responsabilidades

| Módulo | Arquivo | Responsabilidade |
|--------|---------|------------------|
| **AuthModule** | `auth/` | JWT authentication, Passport strategy, login/register |
| **TenantsModule** | `tenants/` | CRUD tenants, seed de planos, CRON de expiração trial |
| **UsersModule** | `users/` | Gestão de usuários, roles (ADMIN, SALES, PRODUCTION) |
| **CustomersModule** | `customers/` | CRUD clientes |
| **ProductsModule** | `products/` | Catálogo, movimentação de estoque |
| **ProductTypesModule** | `product-types/` | Categorias de produtos |
| **EstimatesModule** | `estimates/` | Orçamentos com calculadoras dinâmicas |
| **OrdersModule** | `orders/` | Pedidos de produção, WebSocket gateway |
| **PaymentsModule** | `payments/` | Integração Mercado Pago PIX |
| **BillingModule** | `billing/` | Integração Asaas (cobranças SaaS) |
| **PlansModule** | `plans/` | Feature enforcement, limites |
| **ExpensesModule** | `expenses/` | Controle de despesas |
| **ReportsModule** | `reports/` | Relatórios financeiros |
| **FilesModule** | `files/` | Upload/download arquivos |
| **MessagingModule** | `messaging/` | Envio de e-mails SMTP |
| **NotificationsModule** | `notifications/` | Notificações em tempo real |
| **AuditModule** | `audit/` | Logs de auditoria |
| **McpModule** | `mcp/` | Model Context Protocol, tools ERP |
| **LogsModule** | `logs/` | WebSocket streaming de logs |
| **SettingsModule** | `settings/` | Configurações da empresa |
| **SuppliersModule** | `suppliers/` | Gestão de fornecedores |

### 4.2 Padrões de Arquitetura

#### Service Pattern
Cada módulo segue o padrão Service do NestJS:
- **Service**: Lógica de negócio, acesso ao Prisma
- **Controller**: Endpoints HTTP, validação DTO
- **Module**: Registro de providers e imports

#### Exemplo de Estrutura
```
orders/
├── orders.controller.ts   # Endpoints REST
├── orders.service.ts      # Lógica de negócio
├── orders.module.ts      # Registro do módulo
├── orders.gateway.ts     # WebSocket gateway
├── dto/
│   ├── create-order.dto.ts
│   └── update-order.dto.ts
└── entities/ (opcional)
```

### 4.3 Autenticação e Autorização

#### JWT Strategy
```typescript
// Payload do Token
{
  sub: userId,      // ID do usuário
  email: string,
  role: string,     // ADMIN | SALES | PRODUCTION
  tenantId: number,
  isSuperAdmin: boolean
}

// Configuração
{
  secret: 'gestorprint-secret-key-2026',  // TODO: Mover para .env
  signOptions: { expiresIn: '1d' }
}
```

#### Roles e Permissões
| Role | Permissões |
|------|------------|
| **ADMIN** | Acesso completo a todos os recursos |
| **SALES** | Criar orçamentos, visualizar relatórios |
| **PRODUCTION** | Atualizar status de pedidos |

### 4.4 Feature Gates (Planos)

O sistema implementa **feature enforcement** via `PlansService.requireFeature()`:

```typescript
// Exemplo de uso
await this.plansService.requireFeature(tenantId, 'hasPix');

// Called before:
// - PIX payment creation
// - WhatsApp AI usage
// - Report access
// - File uploads
// - etc.
```

### 4.5 Multi-Tenancy

Todas as queries são filtradas por `tenantId`:
```typescript
// Exemplo
const orders = await this.prisma.order.findMany({
  where: { tenantId }  // from JWT context
});
```

---

## 5. Arquitetura Frontend (Vue 3)

### 5.1 Stores Pinia

| Store | Arquivo | Responsabilidade |
|-------|---------|------------------|
| **auth** | `stores/auth.ts` | Token JWT, dados usuário, permissões |
| **plan** | `stores/plan.ts` | Features do plano, limites, usage % |
| **notification** | `stores/notification.ts` | Toasts e alertas |
| **ui** | `stores/ui.ts` | Estado global de UI |

### 5.2 Composables

| Composable | Arquivo | Descrição |
|------------|---------|-----------|
| **useEstimateBase** | `composables/useEstimateBase.ts` | CRUD de orçamentos (244 linhas) |
| **useToast** | `composables/useToast.ts` | Sistema de notificações |
| **useConfirm** | `composables/useConfirm.ts` | Diálogos de confirmação |

### 5.3 API Wrapper

O arquivo `utils/api.ts` centraliza o fetch com injeção automática de JWT:

```typescript
export async function apiFetch(url: string, options = {}) {
  const token = localStorage.getItem('gp_token')
  
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  const response = await fetch(url, { ...options, headers })
  
  // 401 → Redirect to login
  // 403 → Dispatch 'plan:limit' event
  return response
}
```

### 5.4 Rotas do Router

```typescript
const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/login', name: 'login' },
  { path: '/products', name: 'products' },
  { path: '/customers', name: 'customers' },
  { path: '/estimates/service', name: 'estimates-service' },
  { path: '/estimates/plotter', name: 'estimates-plotter' },
  { path: '/estimates/cutting', name: 'estimates-cutting' },
  { path: '/estimates/embroidery', name: 'estimates-embroidery' },
  { path: '/pdv', name: 'pdv' },
  { path: '/expenses', name: 'expenses' },
  { path: '/financial', name: 'financial' },
  { path: '/reports', name: 'reports' },
  { path: '/settings', name: 'settings' },
  { path: '/users', name: 'users' },
  { path: '/ai', name: 'ai' },
  { path: '/audit', name: 'audit' },
]
```

---

## 6. WhatsApp AI (Flow Builder)

### 6.1 Arquitetura do Agente

```
WhatsApp Message
      │
      ▼
Webhook (Evolution API)
      │
      ▼
FlowEngine.processMessage()
      │
      ├──► Load FlowConfig (nodes + edges)
      ├──► Load/Create Session
      │
      └──► Loop: Process Nodes
            │
            ├──► triage    → Gemini AI (triagem)
            ├──► collect  → Coleta dados
            ├──► situational → Consulta ERP
            ├──► choice   → Menu de opções
            ├──► vision   → Análise de imagens
            ├──► action   → Ações no ERP
            └──► end      → Encerramento
```

### 6.2 Tipos de Nós do Flow

| Tipo | Descrição |
|------|-----------|
| **start** | Nó inicial do fluxo |
| **triage** | Triagem com Gemini AI |
| **collect** | Coleta de informações (text, number) |
| **situational** | Consulta ao ERP (estoque, pedidos) |
| **choice** | Menu de opções |
| **vision** | Análise de imagens (Gemini Vision) |
| **action** | Ações no ERP (criar orçamento, gerar PIX) |
| **end** | Encerramento |

### 6.3 Configuração AI

```typescript
interface AiConfig {
  enabled: boolean
  geminiKey: string
  geminiModel: string       // gemini-2.0-flash
  maxTokens: number
  evolutionUrl: string      // Evolution API
  evolutionKey: string
  evolutionInstance: string
  agentPrompt: string
  allowFileUploads: boolean
  tenantId: number
}
```

---

## 7. Integrações

### 7.1 Mercado Pago (PIX)

- **Serviço**: `PaymentsService`
- **Funcionalidade**: Geração de QR Code PIX,-webhooks
- **Feature Gate**: `hasPix`

### 7.2 Asaas (Cobranças SaaS)

- **Serviço**: `BillingService`
- **Funcionalidade**: Assinaturas, cobranças recorrentes
- **Endpoint**: `https://api.asaas.com/v3` (sandbox: `https://sandbox.asaas.com/api/v3`)

### 7.3 Evolution API (WhatsApp)

- **Funcionalidade**: Envio/recebimento de mensagens WhatsApp
- **Porta**: 3005 (whatsapp-ai)

### 7.4 Google Gemini AI

- **Modelos**: gemini-2.0-flash, gemini-3-flash-preview
- **Funcionalidade**: Processamento de linguagem natural, visão computacional

---

## 8. Tempo Real (WebSocket)

### 8.1 Orders Gateway

```typescript
@WebSocketGateway({ cors: { origin: '*' } })
export class OrdersGateway {
  notifyNewOrder(order) {
    this.server.emit('new_order', order)
  }
  
  notifyOrderUpdated(order) {
    this.server.emit('order_updated', order)
  }
}
```

### 8.2 Logs Gateway

Streaming de logs em tempo real para o painel admin.

---

## 9. SaaS Admin

### 9.1 Funcionalidades

- **Dashboard**: Visão geral da plataforma
- **Tenants**: Gestão de tenants, upgrade/downgrade
- **Plans**: Configuração de planos
- **Billing**: Cobranças e assinaturas
- **Logs**: Logs da plataforma

### 9.2 Views

```typescript
const views = [
  'DashboardView',    // KPIs da plataforma
  'TenantsView',      // Lista de tenants
  'TenantDetailView', // Detalhes de um tenant
  'PlansView',        // CRUD de planos
  'BillingView',      // Assinaturas Asaas
  'LogsView',         // Logs do sistema
  'SettingsView',    // Configurações globais
  'LoginView'        // Login admin
]
```

---

## 10. Problemas Técnicos Identificados

### 10.1 Críticos

| Problema | Localização | Impacto |
|----------|-------------|---------|
| Secret JWT hardcoded | `auth.module.ts:13` | Segurança |
| 50+ casts `as any` | Múltiplos services | Type safety |
| User ID hardcoded em audit | `orders.service.ts:230` | Rastreabilidade |
| Sem índices no banco | Schema Prisma | Performance |

### 10.2 Médios

- Inconsistent error handling
- Missing validation em DTOs
- No rate limiting
- Sem testes no frontend
- Circular dependencies

### 10.3 Minor

- Dead code (`counter.ts`, `HelloWorld.vue`)
- Inconsistent naming (tenantId: number vs tenantId = 1)
- `console.log` vs Logger

---

## 11. Recomendações de Melhoria

### 11.1 Alta Prioridade

1. Mover secrets para variáveis de ambiente
2. Remover casts `as any` - gerar tipos Prisma corretamente
3. Adicionar índices no banco (`tenantId`, composities)
4. Implementar testes unitários

### 11.2 Média Prioridade

1. Adicionar rate limiting (`@nestjs/throttler`)
2. Completar validação DTOs
3. Centralizar formato de erros
4. Logging estruturado

### 11.3 Baixa Prioridade

1. Extrair geração PDF para serviço dedicado
2. Remover código morto
3. Migration para ESM
4. Adicionar Swagger/OpenAPI docs

---

## 12. Variáveis de Ambiente

### Backend (.env)
```env
# Banco
DATABASE_URL=postgresql://user:pass@localhost:5432/gestorprint

# JWT
JWT_SECRET=sua_chave_jwt_segura

# Mercado Pago
MP_ACCESS_TOKEN=token_mp
MP_PUBLIC_KEY=chave_publica

# Asaas
ASAAS_API_KEY=key_asaas
ASAAS_ENV=sandbox

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass

# API
API_URL=https://api.gestorprint.com.br
PORT=3000
```

### WhatsApp AI (.env)
```env
PORT=3005
ERP_API_URL=http://localhost:3000/api
INTERNAL_API_KEY=gestorprint-internal-2026
TENANT_ID=1
```

---

## 13. Scripts de Desenvolvimento

### Backend
```bash
cd backend
npm run build               # Build production
npm run start               # Run production
npm run start:dev           # Watch mode
npm run lint                # ESLint fix
npm run test                # Run tests
```

### Frontend
```bash
cd frontend
npm run dev                 # Development
npm run build              # Production build
npm run type-check         # TypeScript
npm run lint               # Lint all
```

### SaaS Admin
```bash
cd saas-admin
npm run dev
npm run build
```

### WhatsApp AI
```bash
cd whatsapp-ai
npm run dev   # Watch mode (tsx)
npm run start # Production
```

---

## 14. Conclusão

O GestorPrint é uma aplicação bem arquitetada que demonstra:

- **Padrões sólidos**: NestJS services, Vue 3 Composition API
- **Escalabilidade**: Multi-tenant com feature gates
- **Modernidade**: TypeScript, TailwindCSS 4, Vue 3.5
- **Integrações**: PIX, Asaas, WhatsApp AI, Gemini

O código precisa de algumas melhorias de segurança e type safety antes de produção, mas a base arquitetural é forte e escalável.
