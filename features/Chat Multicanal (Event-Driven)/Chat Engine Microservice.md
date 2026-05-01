# Master Plan: Chat Engine Enterprise

## 📌 Visão Geral
Microserviço de atendimento omnichannel (WhatsApp, Instagram, Messenger) com suporte a automações avançadas (Macros), gestão de equipes (Teams) e organização por etiquetas (Tags).

## 🏗️ Arquitetura de Isolamento (Multi-tenant & Padrão Chatwoot)
- **Identidade:** O microserviço não possui cadastro próprio para o SaaS; ele valida o UUID do `Tenant` e do `User` via JWT assinado pelo ERP principal (GestorPrint).
- **Separação de APIs:** O sistema expõe 3 camadas de rede distintas:
  1. **Platform API:** Comunicação Server-to-Server (ERP -> Chat Engine) para gerenciar organizações e limites.
  2. **Application API:** Consumida pelo Frontend Vue.js dos atendentes (Rotas isoladas por `org_id`).
  3. **Client API:** Para widgets públicos instalados em sites externos.
- **Banco de Dados:** PostgreSQL exclusivo para garantir que o crescimento do volume de mensagens não afete a performance financeira do ERP.
- **Storage:** S3-Compatible (MinIO) para isolamento de arquivos binários.

---

## 📋 Fases de Execução

### Fase 1: Setup e Infraestrutura
- Configurar projeto Node.js/TS com Fastify, Prisma e BullMQ.
- Provisionar banco de dados e Redis exclusivos.

### Fase 2: Roteamento Seguro (Padrão Chatwoot)
- Criar a estrutura de pastas dividindo as rotas em `platform/`, `application/` e `client/`.
- Implementar Middleware que obriga o repasse do `organization_id` na URL para rotas da Application API.

### Fase 3: Gestão de Atendimento (Teams & Tags)
- Implementar lógica de Times e vinculação de usuários.
- Criar sistema de etiquetas coloridas para conversas.

### Fase 4: Motor de Automação (Macros & Actions)
- Desenvolver o executor de Macros (JSON-based sequential actions).
- Implementar ações como: Enviar Texto, Adicionar Tag, Transferir Time, Alterar Status.

### Fase 5: Omnichannel & Real-time
- Integração com Evolution API (Webhooks e Workers).
- Socket.io com Rooms isoladas estritamente por `Organization.id`.

### Fase 6: Componente Vue.js Reutilizável
- Criar o widget frontend modular que consome a Application API enviando Props (`token`, `api_url`, `tenant_uuid`).