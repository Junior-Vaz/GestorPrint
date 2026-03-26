# API Reference - GestorPrint

Base URL: `http://localhost:3000/api`

> A API utiliza autenticação JWT. Para endpoints protegidos, inclua o token no header: `Authorization: Bearer <token>`

---

## Autenticação

### Login
```http
POST /auth/login
```
**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

### Perfil do Usuário
```http
GET /auth/profile
```
**Headers:** `Authorization: Bearer <token>`
**Retorna:** Dados do usuário autenticado

---

## Usuários

Gerenciamento de usuários do sistema (apenas ADMIN).

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/users` | Listar todos os usuários |
| GET | `/users/:id` | Obter usuário por ID |
| POST | `/users` | Criar novo usuário |
| PATCH | `/users/:id` | Atualizar usuário |
| DELETE | `/users/:id` | Remover usuário |

**Headers:** `Authorization: Bearer <token>`
**Roles:** ADMIN

---

## Clientes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/customers` | Listar todos os clientes |
| GET | `/customers/:id` | Obter cliente por ID |
| POST | `/customers` | Criar novo cliente |
| PATCH | `/customers/:id` | Atualizar cliente |
| DELETE | `/customers/:id` | Remover cliente |

**Headers:** `Authorization: Bearer <token>`

---

## Produtos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/products` | Listar todos os produtos |
| GET | `/products/:id` | Obter produto por ID |
| POST | `/products` | Criar novo produto |
| PATCH | `/products/:id` | Atualizar produto |
| DELETE | `/products/:id` | Remover produto |
| POST | `/products/:id/stock` | Ajustar estoque |

**Ajustar Estoque:**
```json
{
  "quantity": 10,
  "type": "INPUT" | "OUTPUT",
  "reason": "string"
}
```

**Headers:** `Authorization: Bearer <token>`

---

## Orçamentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/estimates` | Listar orçamentos (filtro `?type=embroidery\|plotter\|cutting\|service`) |
| GET | `/estimates/:id` | Obter orçamento por ID |
| POST | `/estimates` | Criar novo orçamento |
| PATCH | `/estimates/:id` | Atualizar orçamento |
| DELETE | `/estimates/:id` | Remover orçamento |
| POST | `/estimates/:id/convert` | Converter em pedido |
| POST | `/estimates/:id/payment` | Obter dados de pagamento |
| GET | `/estimates/:id/pdf` | Gerar PDF do orçamento |

**Headers:** `Authorization: Bearer <token>`

---

## Pedidos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/orders` | Listar todos os pedidos |
| GET | `/orders/:id` | Obter pedido por ID |
| POST | `/orders` | Criar novo pedido |
| PATCH | `/orders/:id` | Atualizar pedido (status) |
| DELETE | `/orders/:id` | Remover pedido |
| GET | `/orders/:id/receipt` | Gerar recibo em PDF |

**Headers:** `Authorization: Bearer <token>`

---

## Despesas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/expenses` | Listar todas as despesas |
| PATCH | `/expenses/:id` | Atualizar despesa |
| DELETE | `/expenses/:id` | Remover despesa |
| GET | `/expenses/export/csv` | Exportar CSV |
| GET | `/expenses/categories` | Listar categorias |
| POST | `/expenses/categories` | Criar categoria |
| DELETE | `/expenses/categories/:id` | Remover categoria |

**Headers:** `Authorization: Bearer <token>`

---

## Fornecedores

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/suppliers` | Listar todos os fornecedores |
| GET | `/suppliers/:id` | Obter fornecedor por ID |
| POST | `/suppliers` | Criar novo fornecedor |
| PATCH | `/suppliers/:id` | Atualizar fornecedor |
| DELETE | `/suppliers/:id` | Remover fornecedor |

**Headers:** `Authorization: Bearer <token>`

---

## Pagamentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/payments/create/:orderId?type=PIX\|LINK` | Criar pagamento (MercadoPago/Asaas) |
| POST | `/payments/webhook` | Webhook de pagamento |
| GET | `/payments/stats` | Estatísticas financeiras |
| GET | `/payments/history` | Histórico de transações |
| POST | `/payments/confirm/:id` | Confirmar pagamento manualmente |
| GET | `/payments/check/:id` | Verificar status do pagamento |
| GET | `/payments/config-status` | Status da integração |

---

## Relatórios

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/reports/summary?period=7d\|30d\|90d\|1y` | Resumo de dados |
| GET | `/reports/stats?period=...` | Estatísticas |
| GET | `/reports/export/csv` | Exportar fluxo de caixa CSV |
| GET | `/reports/export/pdf?period=...` | Exportar relatório PDF |

**Headers:** `Authorization: Bearer <token>`
**Roles:** ADMIN, SALES

---

## Arquivos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/files/upload/:orderId` | Upload de arquivo para pedido |
| POST | `/files/upload-estimate/:estimateId` | Upload de arquivo para orçamento |
| GET | `/files/estimate/:estimateId` | Listar arquivos do orçamento |
| GET | `/files/order/:orderId` | Listar arquivos do pedido |
| GET | `/files/:tenantId/:filename` | Baixar arquivo (público) |
| DELETE | `/files/:id` | Remover arquivo |

**Headers:** `Authorization: Bearer <token>`
**Configurações:**
- Tamanho máx: 50MB
- Bloqueados: .exe, .bat, .cmd, .js, .py, .php, etc.

---

## Tenants (SaaS)

Gerenciamento de empresas (apenas ADMIN do sistema).

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/tenants` | Listar todos os tenants |
| GET | `/tenants/dashboard` | Dashboard admin |
| GET | `/tenants/:id` | Obter tenant por ID |
| POST | `/tenants` | Criar novo tenant |
| PATCH | `/tenants/:id` | Atualizar tenant |
| PATCH | `/tenants/:id/suspend` | Suspender tenant |
| PATCH | `/tenants/:id/activate` | Ativar tenant |
| POST | `/tenants/:id/admin-user` | Criar usuário admin |

**Headers:** `Authorization: Bearer <token>`
**Roles:** ADMIN

---

## Planos (SaaS)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/plans` | Listar todos os planos |
| GET | `/plans/my` | Plano do tenant atual |
| GET | `/plans/:id` | Detalhes do plano |
| POST | `/plans` | Criar plano (ADMIN) |
| PATCH | `/plans/:id` | Atualizar plano (ADMIN) |
| DELETE | `/plans/:id` | Desativar plano (ADMIN) |

**Headers:** `Authorization: Bearer <token>`

---

## WebSocket Events

### Eventos de Pedido (`orders`)
- `order:created` - Novo pedido criado
- `order:updated` - Pedido atualizado
- `order:deleted` - Pedido removido

### Eventos de Notificações (`notifications`)
- `notification:new` - Nova notificação

---

## Códigos de Status

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado |
| 400 | Bad Request |
| 401 | Não autorizado |
| 403 | Proibido |
| 404 | Não encontrado |
| 500 | Erro interno |

---

## Swagger UI

Acesse a documentação interativa em:
```
http://localhost:3000/api/docs
```