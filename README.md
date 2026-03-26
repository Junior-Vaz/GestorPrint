# GestorPrint - Sistema de Gestão para Gráficas

Sistema ERP completo para gestão de empresas gráficas, com orçamentos, pedidos, clientes, produtos, finanças e automação via WhatsApp AI.

## 🚀 Tecnologias

### Backend
- **Framework:** NestJS (Node.js)
- **ORM:** Prisma
- **Banco de Dados:** PostgreSQL
- **Autenticação:** JWT + Passport
- **Documentação:** Swagger
- **Mensageria:** Socket.IO

### Frontend
- **Framework:** Vue 3 + TypeScript
- **Estado:** Pinia
- **UI:** TailwindCSS + Componentes Customizados
- **Visualização:** Vue Flow (diagramas), Three.js (3D)
- **Build:** Vite

### Serviços
- **WhatsApp AI:** Agente automatizado com Gemini AI
- **SaaS Admin:** Painel administrativo multi-tenant
- **Pagamentos:** MercadoPago + Asaas (integrações)

## 📁 Estrutura do Projeto

```
GestorPrint/
├── backend/           # API NestJS
│   ├── src/
│   │   ├── auth/      # Autenticação e autorização
│   │   ├── users/     # Gestão de usuários
│   │   ├── tenants/   # Multi-tenancy (SaaS)
│   │   ├── customers/ # Clientes
│   │   ├── products/  # Catálogo de produtos
│   │   ├── estimates/ # Orçamentos
│   │   ├── orders/    # Pedidos
│   │   ├── payments/ # Pagamentos
│   │   ├── expenses/ # Despesas
│   │   ├── reports/   # Relatórios
│   │   ├── files/     # Upload de arquivos
│   │   ├── messaging/# Mensagens
│   │   ├── notifications/ # Notificações
│   │   └── mcp/       # Model Context Protocol
│   └── prisma/        # Schema do banco
├── frontend/          # App Vue.js principal
├── saas-admin/       # Painel admin SaaS
├── whatsapp-ai/      # Agente WhatsApp AI
└── docker-compose.yml
```

## 🛠️ Configuração

### Variáveis de Ambiente

```env
# Banco de dados
POSTGRES_USER=gestorprint_admin
POSTGRES_PASSWORD=senha_segura
POSTGRES_DB=gestorprint_db

# Backend
JWT_SECRET=sua_chave_jwt
PORT=3000

# Integrações
MP_ACCESS_TOKEN=token_mercadopago
MP_PUBLIC_KEY=chave_publica_mp
ASAAS_API_KEY=key_asaas
ASAAS_ENV=sandbox
```

### Executando com Docker

```bash
# Subir todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Executando Localmente

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
```

## 📦 Módulos do Sistema

### Módulos Principais
| Módulo | Descrição |
|--------|------------|
| Auth | Login JWT, roles e permissões |
| Tenants | Multi-tenancy para múltiplas empresas |
| Users | Gestão de usuários e acessos |
| Customers | Cadastro de clientes |
| Products | Catálogo de produtos/serviços |
| Estimates | Orçamentos (bordado, plotter, corte, serviço) |
| Orders | Gestão de pedidos |
| Payments | Controle de pagamentos |
| Expenses | Registro de despesas |
| Reports | Relatórios e dashboards |
| Files | Upload e gestão de arquivos |
| Messaging | Envio de mensagens |
| Notifications | Notificações em tempo real |

### Orçamentos Especializados
- **EstimatesEmbroidery** - Bordado
- **EstimatesPlotter** - Plotagem
- **EstimatesCutting** - Corte
- **EstimatesService** - Serviços gerais

## 🔌 API Endpoints

Documentação Swagger disponível em: `http://localhost:3000/api`

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/register` - Registro

### Recursos
- `/users`, `/customers`, `/products`
- `/estimates`, `/orders`, `/payments`
- `/expenses`, `/reports`
- `/tenants`, `/plans` (SaaS)

## 📱 WhatsApp AI

Agente automatizado que processa mensagens via WhatsApp usando Google Gemini AI.

### Fluxos
- Triagem de clientes
- Coleta de informações
- Escolhas e navegação
- Visão computacional (análise de imagens)
- Encerramento e follow-up

## 📄 Licença

Proprietário - Todos os direitos reservados