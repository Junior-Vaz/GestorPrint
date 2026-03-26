# Database Schema - GestorPrint

## Visão Geral

- **Banco de dados:** PostgreSQL
- **ORM:** Prisma
- **Tipo:** Multi-Tenant (SaaS)

---

## Tabelas Principais

### Tenant
Empresa/cliente do sistema SaaS.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| name | TEXT | Nome da empresa |
| slug | TEXT | URL única (unique) |
| plan | TEXT | FREE, BASIC, PRO, ENTERPRISE |
| planStatus | TEXT | TRIAL, ACTIVE, SUSPENDED, CANCELLED |
| trialEndsAt | TIMESTAMP | Data fim do trial |
| planExpiresAt | TIMESTAMP | Data expiração do plano |
| maxUsers | INTEGER | Limite usuários |
| maxOrders | INTEGER | Limite pedidos/mês |
| maxCustomers | INTEGER | Limite clientes |
| razaoSocial | TEXT | Razão social |
| inscricaoEstadual | TEXT | IE |
| zipCode | TEXT | CEP |
| address | TEXT | Endereço |
| number | TEXT | Número |
| complement | TEXT | Complemento |
| neighborhood | TEXT | Bairro |
| city | TEXT | Cidade |
| state | TEXT | Estado |
| ownerName | TEXT | Nome responsável |
| ownerEmail | TEXT | Email responsável |
| ownerPhone | TEXT | Telefone responsável |
| cpfCnpj | TEXT | CPF/CNPJ |
| asaasCustomerId | TEXT | ID cliente Asaas |
| asaasSubscriptionId | TEXT | ID assinatura Asaas |
| isActive | BOOLEAN | Ativo |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### User
Usuários do sistema (relacionados ao Tenant).

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| email | TEXT | Email (unique por tenant) |
| password | TEXT | Senha hash |
| name | TEXT | Nome |
| role | TEXT | ADMIN, SALES, PRODUCTION |
| isSuperAdmin | BOOLEAN | Admin plataforma |
| phone | TEXT | Telefone |
| document | TEXT | CPF |
| salary | FLOAT | Salário |
| commissionRate | FLOAT | Taxa comissão |
| isActive | BOOLEAN | Ativo |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### Customer
Clientes da gráfica.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| name | TEXT | Nome |
| email | TEXT | Email |
| phone | TEXT | Telefone |
| document | TEXT | CPF/CNPJ |
| zipCode | TEXT | CEP |
| address | TEXT | Endereço |
| number | TEXT | Número |
| neighborhood | TEXT | Bairro |
| city | TEXT | Cidade |
| state | TEXT | Estado |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### ProductType
Tipo de produto (categoria).

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| name | TEXT | Nome (unique por tenant) |
| color | TEXT | Cor hex |
| hasStock | BOOLEAN | Controla estoque |
| createdAt | TIMESTAMP | Criação |

---

### Product
Produtos do catálogo.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| name | TEXT | Nome |
| typeId | INTEGER | FK ProductType |
| unit | TEXT | un, m², kg, h |
| unitPrice | FLOAT | Preço unitário |
| brand | TEXT | Marca |
| markup | FLOAT | Margem % |
| stock | FLOAT | Estoque atual |
| minStock | FLOAT | Estoque mínimo |
| description | TEXT | Descrição |
| supplierId | INTEGER | FK Supplier |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### StockMovement
Movimentações de estoque.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| productId | INTEGER | FK Product |
| quantity | FLOAT | Qtd (positivo=entrada, negativo=saída) |
| type | TEXT | PURCHASE, SALE, ADJUSTMENT |
| reason | TEXT | Motivo |
| createdAt | TIMESTAMP | Criação |

---

### Estimate
Orçamentos.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| customerId | INTEGER | FK Customer |
| status | TEXT | DRAFT, SENT, APPROVED, REJECTED |
| estimateType | TEXT | service, plotter, cutting, embroidery |
| details | JSONB | Campos dinâmicos (calculadora) |
| totalPrice | FLOAT | Preço total |
| salespersonId | INTEGER | FK User (vendedor) |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### Order
Pedidos de produção.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| customerId | INTEGER | FK Customer |
| estimateId | INTEGER | FK Estimate (opcional) |
| productDescription | TEXT | Descrição do produto |
| amount | FLOAT | Valor |
| status | TEXT | PENDING, PRODUCTION, FINISHED, DELIVERED |
| details | JSONB | Itens (para PDV) |
| salespersonId | INTEGER | FK User (vendedor) |
| producerId | INTEGER | FK User (produtor) |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### Transaction
Transações/pagamentos.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| orderId | INTEGER | FK Order |
| amount | FLOAT | Valor |
| status | TEXT | PENDING, PAID, CANCELLED, REFUNDED |
| paymentType | TEXT | PIX, CREDIT_CARD, CASH |
| gatewayId | TEXT | ID gateway (unique) |
| paymentUrl | TEXT | Link pagamento |
| qrCode | TEXT | Pix Copia e Cola |
| qrCodeBase64 | TEXT | QR Code Base64 |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### Expense
Despesas.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| description | TEXT | Descrição |
| amount | FLOAT | Valor |
| category | TEXT | Categoria |
| date | TIMESTAMP | Data |
| supplierId | INTEGER | FK Supplier |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### ExpenseCategory
Categorias de despesas.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| name | TEXT | Nome (unique por tenant) |

---

### Supplier
Fornecedores.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| name | TEXT | Nome |
| email | TEXT | Email |
| phone | TEXT | Telefone |
| category | TEXT | Categoria |
| address | TEXT | Endereço |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### Settings
Configurações da empresa.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | INTEGER | PK (tenantId) |
| tenantId | INTEGER | FK Tenant (unique) |
| companyName | TEXT | Nome fantasia |
| cnpj | TEXT | CNPJ |
| phone | TEXT | Telefone |
| email | TEXT | Email |
| address | TEXT | Endereço |
| smtpHost | TEXT | Host SMTP |
| smtpPort | INTEGER | Porta SMTP |
| smtpUser | TEXT | Usuário SMTP |
| smtpPass | TEXT | Senha SMTP |
| smtpSecure | BOOLEAN | TLS/SSL |
| mpAccessToken | TEXT | Token MercadoPago |
| mpPublicKey | TEXT | Chave Pública MP |
| logoUrl | TEXT | URL Logo |
| updatedAt | TIMESTAMP | Atualização |

---

### Notification
Notificações.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| title | TEXT | Título |
| message | TEXT | Mensagem |
| type | TEXT | INFO, SUCCESS, WARNING, ALERTA |
| read | BOOLEAN | Lida |
| createdAt | TIMESTAMP | Criação |

---

### Attachment
Arquivos (uploads).

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| filename | TEXT | Nome arquivo (unique) |
| originalName | TEXT | Nome original |
| mimetype | TEXT | Tipo MIME |
| size | INTEGER | Tamanho |
| orderId | INTEGER | FK Order |
| estimateId | INTEGER | FK Estimate |
| createdAt | TIMESTAMP | Criação |

---

### AiConfig
Configurações do WhatsApp AI.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | INTEGER | PK (tenantId) |
| tenantId | INTEGER | FK Tenant (unique) |
| enabled | BOOLEAN | Ativado |
| geminiKey | TEXT | Chave Gemini |
| geminiModel | TEXT | Modelo Gemini |
| maxTokens | INTEGER | Limite tokens |
| evolutionUrl | TEXT | URL Evolution API |
| evolutionKey | TEXT | Chave Evolution |
| evolutionInstance | TEXT | Instância |
| agentPrompt | TEXT | Prompt do agente |
| allowFileUploads | BOOLEAN | Permite uploads |
| updatedAt | TIMESTAMP | Atualização |

---

### PlanConfig
Planos SaaS.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| name | TEXT | Nome (unique) |
| displayName | TEXT | Nome exibido |
| description | TEXT | Descrição |
| price | FLOAT | Preço R$/mês |
| maxUsers | INTEGER | Usuários |
| maxOrders | INTEGER | Pedidos/mês |
| maxCustomers | INTEGER | Clientes |
| hasPdf | BOOLEAN | PDF |
| hasReports | BOOLEAN | Relatórios |
| hasKanban | BOOLEAN | Kanban |
| hasFileUpload | BOOLEAN | Upload arquivos |
| hasWhatsapp | BOOLEAN | WhatsApp AI |
| hasPix | BOOLEAN | PIX |
| hasPlotterEstimate | BOOLEAN | Orçamento Plotter |
| hasCuttingEstimate | BOOLEAN | Orçamento Corte |
| hasEmbroideryEstimate | BOOLEAN | Orçamento Bordado |
| hasAudit | BOOLEAN | Auditoria |
| hasCommissions | BOOLEAN | Comissões |
| hasApiAccess | BOOLEAN | API |
| isActive | BOOLEAN | Ativo |
| sortOrder | INTEGER | Ordem |
| createdAt | TIMESTAMP | Criação |
| updatedAt | TIMESTAMP | Atualização |

---

### AuditLog
Log de auditoria.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| userId | INTEGER | FK User |
| action | TEXT | CREATE, UPDATE, DELETE |
| entity | TEXT | Entidade |
| entityId | INTEGER | ID entidade |
| details | JSONB | Detalhes |
| createdAt | TIMESTAMP | Criação |

---

### FlowConfig
Configuração do fluxo WhatsApp (Vue Flow).

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant (unique) |
| nodes | JSON | Nós do fluxo |
| edges | JSON | Conexões |
| updatedAt | TIMESTAMP | Atualização |

---

### FlowSession
Sessões ativas do WhatsApp Flow.

| Coluna | Tipo | Descrição |
|--------|------|------------|
| id | SERIAL | PK |
| tenantId | INTEGER | FK Tenant |
| contactPhone | TEXT | Telefone contato |
| currentNodeId | TEXT | Nó atual |
| collectedData | JSON | Dados coletados |
| updatedAt | TIMESTAMP | Atualização |

---

## Relacionamentos

```
Tenant (1) ─── (N) User
                (N) Customer
                (N) ProductType
                (N) Product
                (N) Estimate
                (N) Order
                (N) Expense
                (N) ExpenseCategory
                (N) Supplier
                (N) Notification
                (N) AuditLog
                (N) Settings (1:1)
                (N) AiConfig (1:1)
                (N) FlowConfig (1:1)
                (N) FlowSession

Customer (1) ─── (N) Order
                 (N) Estimate

ProductType (1) ─── (N) Product

Product (1) ─── (N) StockMovement

Supplier (1) ─── (N) Product
                 (N) Expense

Order (1) ─── (N) Transaction
              (N) Attachment

Estimate (1) ─── (N) Attachment

User (1) ─── (N) Order (salesperson)
             (N) Order (producer)
             (N) Estimate (salesperson)
             (N) AuditLog
```

---

## Migration History

| Migration | Data | Descrição |
|-----------|------|------------|
| 20260317000000_init | 2026-03-17 | Schema inicial |
| 20260319000000_add_multi_tenant | 2026-03-19 | Suporte Multi-Tenant SaaS |