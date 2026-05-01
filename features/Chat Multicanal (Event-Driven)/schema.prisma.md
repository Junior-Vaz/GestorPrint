---

### Arquivo 4: `prisma/schema.prisma`
```prisma
// prisma/schema.prisma (Standalone Chat Engine)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── NÚCLEO MULTI-TENANT ─────────────────────────────────────────────────────

model Organization {
  id        String   @id // Vinculado ao Tenant.uuid do ERP 
  name      String
  active    Boolean  @default(true) // Sincronizado com Tenant.isActive
  inboxes   Inbox[]
  contacts  Contact[]
  teams     Team[]
  tags      Tag[]
  macros    Macro[]
  conversations Conversation[]
  createdAt DateTime @default(now())
}

model User {
  id             String   @id // Vinculado ao User.uuid do ERP 
  organizationId String
  name           String
  role           String   @default("AGENT") // Sincronizado com User.role
  teamMemberships TeamMember[]
}

// ─── ESTRUTURA DE ATENDIMENTO ───────────────────────────────────────────────

model Team {
  id             String       @id @default(uuid())
  name           String
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  members        TeamMember[]
  conversations  Conversation[]
}

model TeamMember {
  id     String @id @default(uuid())
  teamId String
  userId String
  team   Team   @relation(fields: [teamId], references: [id])
  user   User   @relation(fields: [userId], references: [id])
  @@unique([teamId, userId])
}

model Inbox {
  id             String       @id @default(uuid())
  name           String       
  provider       String       @default("EVOLUTION_API") 
  instanceId     String       // ID da instância (ex: AiConfig.evolutionInstance)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  conversations  Conversation[]
}

// ─── CONVERSAS E MENSAGENS ──────────────────────────────────────────────────

model Contact {
  id             String       @id @default(uuid())
  externalId     String?      // UUID do Customer no ERP 
  name           String
  phone          String
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  conversations  Conversation[]

  @@unique([phone, organizationId])
}

model Conversation {
  id             String       @id @default(uuid())
  status         String       @default("OPEN") // OPEN, PENDING, CLOSED
  contactId      String
  contact        Contact      @relation(fields: [contactId], references: [id])
  inboxId        String
  inbox          Inbox        @relation(fields: [inboxId], references: [id])
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  teamId         String?
  team           Team?        @relation(fields: [teamId], references: [id])
  assigneeId     String?      // User.uuid
  tags           ConversationTag[]
  messages       Message[]
  updatedAt      DateTime     @updatedAt
}

model Message {
  id             String       @id @default(uuid())
  content        String       @db.Text // Texto ou URL no MinIO
  type           String       @default("TEXT") // TEXT, IMAGE, AUDIO, VIDEO, DOCUMENT, INTERNAL_NOTE
  fromMe         Boolean      @default(false)
  metadata       Json?        // Armazena menções ex: { "mentions": ["user-uuid"] }
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  createdAt      DateTime     @default(now())
}

// ─── ORGANIZAÇÃO E AUTOMAÇÃO ────────────────────────────────────────────────

model Tag {
  id             String       @id @default(uuid())
  name           String
  color          String       @default("#6366f1") // Padrão visual do ProductType
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  conversations  ConversationTag[]
}

model ConversationTag {
  conversationId String
  tagId          String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  tag            Tag          @relation(fields: [tagId], references: [id])
  @@id([conversationId, tagId])
}

model Macro {
  id             String       @id @default(uuid())
  name           String
  actions        Json         // Fluxo sequencial de ações
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}