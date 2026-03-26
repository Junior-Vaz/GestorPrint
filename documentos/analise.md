# Análise do Projeto GestorPrint

## 1. Visão Geral
O GestorPrint é um sistema ERP (Enterprise Resource Planning) desenvolvido para empresas de impressão, com funcionalidades como gestão de pedidos, rastreamento de clientes e integração com WhatsApp via IA (Gemini/LLM). O projeto é dividido em:
- Backend (NestJS, Prisma, Node.js)
- Frontend (Vue.js, TypeScript)
- Documentação (APIs, banco de dados, IA)
- Deploy (Docker, multi-container)

## 2. Componentes Principais
### Backend
- **Tecnologias**: NestJS, Prisma, Node.js
- **Arquivos-chave**: `check-db.js`, `Dockerfile`, `package.json`, `tsconfig.json`
- **Banco de Dados**: Migrações Prisma ativas (`migration_lock.toml`, `migration.sql`)
- **Integração**: WhatsApp AI via `whatsapp-ai/` (agentes Gemini/LLM)

### Frontend
- **Tecnologias**: Vue 3, Vite, TypeScript
- **Componentes**: `ShirtCanvas3D.vue`, `NotificationBell.vue`, `stores/` (gerenciamento de estado), `router/` (roteamento)
- **Autenticação**: Gerenciada via `stores/` e `router/`

### Documentação
- `documentos/API-REFERENCE.md`: Referência das APIs do backend
- `documentos/DATABASE.md`: Esquema do banco de dados
- `documentações/Gemini/`: Guia para integração com IA/LLM

### Deploy
- **Docker**: Suporte via `Dockerfile` e `docker-compose.yml`
- **Multi-container**: Frontend, backend, IA e banco de dados em contêineres separados

## 3. Tarefas e Considerações
### Setup
- **Backend**: `npm install` + `nest start` para rodar o servidor
- **Frontend**: `npm install` + `npm run dev` para desenvolvimento
- **Docker**: `docker-compose up` para deploy completo

### Personalização
- **Banco de Dados**: Alterar `prisma/schema.prisma` e rodar migrações
- **WhatsApp AI**: Configurar `gemini.ts` com as chaves da API Gemini
- **UI**: Alterar componentes em `frontend/src/views/` ou `components/`

### Solução de Problemas
- **Prisma**: Verificar `migration.sql` para alterações de esquema
- **Docker**: Confirmar `docker-compose.yml` para dependências e portas
- **IA**: Garantir que `gemini.ts` esteja vinculado à API Gemini

## 4. Próximos Passos
Para ajudar melhor, esclareça:
- Se está configurando o projeto pela primeira vez
- Se precisa de ajuda com uma funcionalidade específica (ex.: IA, 3D, banco de dados)
- Se está enfrentando um erro ou bug

---
*Documentação gerada automaticamente com base na análise técnica do projeto.*