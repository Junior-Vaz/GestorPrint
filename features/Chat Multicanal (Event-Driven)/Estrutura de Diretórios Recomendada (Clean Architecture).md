# Estrutura de Diretórios Recomendada (Clean Architecture)

📂 src/
 ┣ 📂 modules/
 ┃ ┣ 📂 chat/            # Lógica de conversas e mensagens
 ┃ ┣ 📂 teams/           # Gestão de times e permissões
 ┃ ┣ 📂 macros/          # Engine de execução de automações
 ┃ ┗ 📂 webhooks/        # Ingestão de mensagens (Evolution API / Meta)
 ┣ 📂 shared/
 ┃ ┣ 📂 infra/
 ┃ ┃ ┣ 📜 prisma.ts      # Instância do Banco de Dados do Chat
 ┃ ┃ ┣ 📜 redis.ts       # Conexão BullMQ e Cache
 ┃ ┃ ┗ 📜 s3.ts          # Conexão MinIO Storage
 ┃ ┗ 📂 middleware/      
 ┃   ┣ 📜 auth.ts        # Validação de JWT (Application API)
 ┃   ┗ 📜 platform.ts    # Validação de API Key interna (Platform API)
 ┣ 📂 routes/            # PADRÃO CHATWOOT DE ROTEAMENTO
 ┃ ┣ 📂 platform/        # Server-to-Server (ERP gerencia o Chat)
 ┃ ┃ ┗ 📜 v1.routes.ts   # ex: POST /platform/api/v1/organizations
 ┃ ┣ 📂 application/     # Painel do Atendente (Requer JWT)
 ┃ ┃ ┗ 📜 v1.routes.ts   # ex: GET /api/v1/orgs/{org_id}/conversations
 ┃ ┗ 📂 client/          # Widget Público (Sem senha, usa identifier)
 ┃   ┗ 📜 v1.routes.ts   # ex: POST /client/api/v1/inboxes/{identifier}/messages
 ┣ 📜 server.ts          # Ponto de entrada (Fastify / Socket.io)