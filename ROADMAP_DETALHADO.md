# 🗺️ ROADMAP DETALHADO DE IMPLEMENTAÇÃO

**Documento**: Phase-by-Phase Implementation Guide
**Stack**: NestJS + Vue3 + PostgreSQL + Prisma
**Regras**: Seguir .rules (atomic changes: DB + Backend + Frontend)

---

## 📍 FASE 0: PREPARAÇÃO SAAS (2-3 horas)

### Objetivo
Preparar arquitetura base para multi-tenant (1 tenant para início, depois escalável)

### Tarefas Atômicas

#### TAREFA 0.1: Adicionar tenantId a Prisma Schema
**Duração**: 30 min
**Files alterados**: 1

```
PASSO 1: DATABASE
├─ Abrir: backend/prisma/schema.prisma
├─ Adicionar novo model Tenant (no topo)
├─ Adicionar tenantId a TODOS 16 models (Customer, Product, Order, etc)
├─ Validar relacionamentos
└─ Validar @unique em fields (nem sempre com tenantId)

PASSO 2: VERIFICAÇÃO
├─ Rodar: npm run prisma:generate
├─ Sem erros? ✓ Próximo
```

**Checklist Regra #3**:
- [ ] Schema.prisma tem novo model Tenant
- [ ] Todos 16 models têm tenantId
- [ ] Relacionamentos corretos
- [ ] @unique validado (alguns precisam (tenantId, field) @unique)

---

#### TAREFA 0.2: Criar Migrations Prisma
**Duração**: 15 min
**Files alterados**: 1

```
PASSO 1: GERAR MIGRATION
├─ Terminal: npm run prisma:migrate dev --name add_tenant_support
├─ Verificar migrations/*/migration.sql criado
└─ Confirmar que tables têm coluna tenant_id

PASSO 2: BACKUP
├─ Copiar migrations para pasta de backup
└─ Comitar no git
```

**Checklist**:
- [ ] Migration gerada sem erros
- [ ] Arquivo .sql criado em migrations/
- [ ] Database atualizado localmente

---

#### TAREFA 0.3: Atualizar JWT para incluir TenantId
**Duração**: 20 min
**Files alterados**: 2

```
PASSO 1: BACKEND - JWT Payload
├─ Arquivo: backend/src/auth/auth.service.ts
├─ Função: login()
├─ Adicionar tenantId ao JWT payload
└─ Exemplo:
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId  // ← NOVO
    };

PASSO 2: INTERFACE JWT
├─ Arquivo: backend/src/auth/jwt.strategy.ts
├─ Adicionar tenantId na interface JwtPayload
└─ Exemplo:
    interface JwtPayload {
      sub: number;
      email: string;
      tenantId: number;  // ← NOVO
    }

PASSO 3: VERIFICAÇÃO
├─ npm run build (sem erros)
├─ npm run start:dev
├─ Não há erros? ✓
```

**Checklist**:
- [ ] auth.service.ts atualizado com tenantId no payload
- [ ] jwt.strategy.ts atualizado com interface
- [ ] npm run build sem erros
- [ ] npm run start:dev sem erros

---

#### TAREFA 0.4: Criar Middleware de Tenant
**Duração**: 30 min
**Files alterados**: 3

```
PASSO 1: CRIAR MIDDLEWARE
├─ Criar: backend/src/tenant/tenant.middleware.ts
├─ Código:
    @Injectable()
    export class TenantMiddleware implements NestMiddleware {
      use(req: any, res: Response, next: NextFunction) {
        if (!req.user) {
          throw new UnauthorizedException('Não autenticado');
        }
        req.tenantId = req.user.tenantId;
        next();
      }
    }
└─ Salvar

PASSO 2: ADICIONAR AO APP.MODULE
├─ Arquivo: backend/src/app.module.ts
├─ No método configure():
    app.use(TenantMiddleware);
└─ Salvar

PASSO 3: CRIAR DECORATOR
├─ Criar: backend/src/common/decorators/tenant.decorator.ts
├─ Código:
    import { createParamDecorator, ExecutionContext } from '@nestjs/common';
    export const Tenant = createParamDecorator(
      (data, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();
        return req.tenantId;
      }
    );
└─ Salvar

PASSO 4: VERIFICAÇÃO
├─ npm run build (sem erros)
├─ npm run start:dev (sem erros)
```

**Checklist**:
- [ ] tenant.middleware.ts criado
- [ ] Adicionado em app.module.ts
- [ ] tenant.decorator.ts criado
- [ ] npm run build sem erros
- [ ] npm run start:dev rodando

---

#### TAREFA 0.5: Criar Helper de TenantId Filter
**Duração**: 20 min
**Files alterados**: 1

```
PASSO 1: CRIAR HELPER
├─ Criar: backend/src/common/helpers/tenant.helper.ts
├─ Código:
    export class TenantHelper {
      static createTenantFilter(tenantId?: number) {
        if (!tenantId) return {};
        return { tenantId };
      }
    }
└─ Salvar

PASSO 2: DOCUMENTAÇÃO
├─ Adicionar comentário em services:
    // TODO: Adicionar tenantId filter a TODAS queries
└─ Salvar
```

**Checklist**:
- [ ] Helper criado
- [ ] Estrutura documentada
- [ ] Pronto para usar em services

---

### Validação FASE 0

```
✅ Ao final desta fase:
- [ ] Schema.prisma tem tenantId em 16 models
- [ ] JWT contém tenantId
- [ ] Middleware injeta tenantId em requests
- [ ] Decorator @Tenant disponível
- [ ] Backend compila sem erros
- [ ] Frontend ainda funciona (sem alterações)
```

---

## 📍 FASE 1: SEGURANÇA MVP (3-4 horas)

### Objetivo
Adicionar validação, guards e segurança antes de produção

### Tarefas Atômicas

#### TAREFA 1.1: Adicionar DTO Validation
**Duração**: 90 min
**Files alterados**: 12 DTOs

```
PASSO 1: INSTALAR CLASS-VALIDATOR
├─ npm install class-validator --save
└─ Pronto

PASSO 2: APLICAR A TODOS DTOS
├─ Arquivos a atualizar (todos em backend/src/**/dto/):
│  1. create-customer.dto.ts
│  2. update-customer.dto.ts
│  3. create-product.dto.ts
│  4. update-product.dto.ts
│  5. create-estimate.dto.ts
│  6. update-estimate.dto.ts
│  7. create-order.dto.ts
│  8. update-order.dto.ts
│  9. create-user.dto.ts
│  10. update-user.dto.ts
│  11. create-expense.dto.ts
│  12. create-supplier.dto.ts
│
├─ Padrão para TODOS:
    import { IsString, IsNumber, IsEmail, Min, Length, IsOptional } from 'class-validator';

    export class CreateProductDto {
      @IsString()
      @Length(1, 255)
      name: string;

      @IsNumber()
      @Min(0)
      unitPrice: number;

      @IsNumber()
      @Min(0)
      stock: number;

      @IsOptional()
      @IsString()
      description?: string;
    }

PASSO 3: ATIVAR VALIDATION PIPE
├─ Arquivo: backend/src/main.ts
├─ Adicionar (caso não tenha):
    app.useGlobalPipes(new ValidationPipe());
└─ Salvar

PASSO 4: RODAR TESTES
├─ npm run build (sem erros)
├─ npm run start:dev (sem erros)
└─ Testar com dados inválidos no Swagger (deve rejeitar)
```

**Checklist Regra #3**:
- [ ] class-validator instalado
- [ ] 12 DTOs com decorators @IsString, @IsNumber, etc
- [ ] ValidationPipe ativo em main.ts
- [ ] npm run build sem erros
- [ ] npm run start:dev rodando
- [ ] Swagger rejeita dados inválidos

---

#### TAREFA 1.2: Adicionar Backend Route Guards
**Duração**: 60 min
**Files alterados**: 14 controllers

```
PASSO 1: ATUALIZAR CONTROLLERS
├─ Padrão (para TODAS rotas protegidas):
    ❌ @UseGuards(JwtAuthGuard)
    ✅ @UseGuards(JwtAuthGuard, RolesGuard)
    ✅ @Roles('ADMIN', 'SALES')  // ou PRODUCTION

├─ Controllers a atualizar:
│  1. customers.controller.ts      → ADMIN, SALES, PRODUCTION
│  2. products.controller.ts        → ADMIN, SALES
│  3. orders.controller.ts          → ADMIN, SALES, PRODUCTION
│  4. estimates.controller.ts       → ADMIN, SALES
│  5. users.controller.ts           → ADMIN
│  6. expenses.controller.ts        → ADMIN, SALES
│  7. suppliers.controller.ts       → ADMIN, SALES
│  8. payments.controller.ts        → ADMIN, SALES
│  9. reports.controller.ts         → ADMIN, SALES
│  10. settings.controller.ts       → ADMIN
│  11. audit.controller.ts          → ADMIN
│  12. notifications.controller.ts  → ADMIN
│  13. files.controller.ts          → ADMIN, SALES, PRODUCTION
│  14. mcp.controller.ts            → ADMIN
│
├─ Exemplo:
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'SALES')
    @Post()
    create(@Body() dto: CreateCustomerDto) {
      return this.customersService.create(dto);
    }

PASSO 2: MARCAR ROTAS PÚBLICAS
├─ Rotas sem @UseGuards:
│  - POST /auth/login (login)
│  - POST /auth/register (registro)
│  - POST /auth/logout (logout)
└─ Deixar sem guards

PASSO 3: TESTAR NO SWAGGER
├─ Backend: npm run start:dev
├─ Swagger: http://localhost:3000/api/docs
├─ Tentar chamar rota sem JWT → deve rejeitar
├─ Tentar com JWT errado → deve rejeitar
├─ Tentar com permission errada → deve rejeitar
```

**Checklist**:
- [ ] 14 controllers com @UseGuards(JwtAuthGuard, RolesGuard)
- [ ] @Roles decorators aplicados corretamente
- [ ] Rotas públicas (auth) sem guards
- [ ] npm run build sem erros
- [ ] npm run start:dev rodando
- [ ] Swagger rejeitando requisições sem autorização

---

#### TAREFA 1.3: Email Notification Triggers
**Duração**: 90 min
**Files alterados**: 3

```
PASSO 1: CRIAR EMAIL SERVICE (se não existir)
├─ Arquivo: backend/src/notifications/email.service.ts
├─ Código base:
    @Injectable()
    export class EmailService {
      private transporter: any;

      constructor() {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      }

      async send(to: string, subject: string, html: string) {
        return this.transporter.sendMail({ to, subject, html });
      }
    }
└─ Salvar

PASSO 2: ADICIONAR TRIGGERS EM ORDERS
├─ Arquivo: backend/src/orders/orders.service.ts
├─ Função: update() ou status change handler
├─ Adicionar email quando order.status muda:
    if (oldStatus !== newStatus) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: order.customerId }
      });

      const emails = {
        'PRODUCTION': `Seu pedido #${order.id} entrou em produção!`,
        'FINISHED': `Seu pedido #${order.id} está pronto para buscar!`,
        'DELIVERED': `Seu pedido #${order.id} foi entregue!`
      };

      if (emails[newStatus]) {
        await this.emailService.send(
          customer.email,
          `Pedido #${order.id}`,
          emails[newStatus]
        );
      }
    }

PASSO 3: ADICIONAR TRIGGERS EM PAYMENTS
├─ Arquivo: backend/src/payments/payments.service.ts
├─ Quando payment.status = PAID:
    await this.emailService.send(
      customer.email,
      `Pagamento recebido - Pedido #${order.id}`,
      `Obrigado pelo pagamento!`
    );

PASSO 4: TESTAR
├─ Configurar SMTP em .env (ou usar Mailtrap para teste)
├─ npm run start:dev
├─ Criar pedido e mudar status → email deveria ser enviado
```

**Checklist**:
- [ ] EmailService criado/atualizado
- [ ] Triggers adicionados em orders.service.ts
- [ ] Triggers adicionados em payments.service.ts
- [ ] .env tem SMTP configurado
- [ ] npm run build sem erros
- [ ] npm run start:dev rodando
- [ ] Testar envio de email

---

#### TAREFA 1.4: File Upload Security
**Duração**: 45 min
**Files alterados**: 1

```
PASSO 1: ATUALIZAR FILES SERVICE
├─ Arquivo: backend/src/files/files.service.ts
├─ Função: uploadFile()
├─ Adicionar validações:
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh'];

    validateFile(file: any) {
      // Validar tamanho
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException('Arquivo muito grande (máx 100MB)');
      }

      // Validar extensão
      const ext = file.originalname.substring(
        file.originalname.lastIndexOf('.')
      ).toLowerCase();

      if (BLOCKED_EXTENSIONS.includes(ext)) {
        throw new BadRequestException(`Tipo de arquivo não permitido: ${ext}`);
      }

      return true;
    }

PASSO 2: APLICAR VALIDAÇÃO NO CONTROLLER
├─ Arquivo: backend/src/files/files.controller.ts
├─ Antes de salvar:
    @Post('upload')
    upload(@UploadedFile() file: Express.Multer.File) {
      this.filesService.validateFile(file);  // ← NOVO
      return this.filesService.uploadFile(file);
    }

PASSO 3: TESTAR
├─ npm run build (sem erros)
├─ npm run start:dev
├─ Tentar upload de arquivo gigante → deve rejeitar
├─ Tentar upload de .exe → deve rejeitar
├─ Tentar upload de .pdf/.cdr/.svg → deve aceitar
```

**Checklist**:
- [ ] Validação de tamanho (100MB max)
- [ ] Validação de extensão bloqueada
- [ ] Controller chama validateFile()
- [ ] npm run build sem erros
- [ ] npm run start:dev rodando
- [ ] Testes de upload OK

---

### Validação FASE 1

```
✅ Ao final desta fase:
- [ ] 12 DTOs com class-validator
- [ ] ValidationPipe ativo
- [ ] 14 Controllers com @UseGuards + @Roles
- [ ] Email triggers em orders e payments
- [ ] File upload com validação
- [ ] npm run build sem erros
- [ ] npm run start:dev rodando
- [ ] Swagger testando guards corretamente
```

---

## 📍 FASE 2: UPLOAD GRÁFICA (1 hora)

### Objetivo
Aceitar TODOS formatos de arquivo (.cdr, .svg, .psd, .doc, etc)

### Tarefas Atômicas

#### TAREFA 2.1: Remover Whitelist MIME Types
**Duração**: 30 min
**Files alterados**: 1

```
PASSO 1: ATUALIZAR FILES SERVICE
├─ Arquivo: backend/src/files/files.service.ts
├─ Encontrar: ALLOWED_TYPES ou MIME whitelist
├─ Remover/comentar (aceitar tudo):
    ❌ const ALLOWED_TYPES = ['application/pdf', 'image/png'];
    ✅ // Aceitar todos tipos - apenas validar extensão bloqueada

PASSO 2: MANTER VALIDAÇÕES ESSENCIAIS
├─ Manter:
    ├─ MAX_FILE_SIZE = 100MB
    ├─ BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.ps1']
    └─ Limpar nomes de arquivo

PASSO 3: TESTAR FORMATOS
├─ npm run start:dev
├─ Testar uploads:
│  ✅ .cdr (CorelDRAW) → deve aceitar
│  ✅ .psd (Photoshop) → deve aceitar
│  ✅ .svg (Vetor) → deve aceitar
│  ✅ .doc/.docx (Word) → deve aceitar
│  ✅ .ai (Illustrator) → deve aceitar
│  ✅ .pdf → deve aceitar
│  ❌ .exe → deve rejeitar
│  ❌ .bat → deve rejeitar
```

**Checklist**:
- [ ] Whitelist MIME types removido
- [ ] Apenas extensão bloqueada (.exe, .bat)
- [ ] MAX_FILE_SIZE = 100MB mantido
- [ ] Testar .cdr upload → aceita
- [ ] Testar .psd upload → aceita
- [ ] Testar .exe upload → rejeita
- [ ] npm run start:dev rodando

---

#### TAREFA 2.2: Atualizar Frontend Upload
**Duração**: 15 min
**Files alterados**: 1 (vue component que faz upload)

```
PASSO 1: ENCONTRAR COMPONENTE DE UPLOAD
├─ Procurar em: frontend/src/views/ e components/
├─ Procurar por: file input, drag-drop, upload
├─ Comum em: OrdersView, EstimatesView, attachments

PASSO 2: ADICIONAR VALIDAÇÃO FRONTEND
├─ Adicionar validação no handleFileSelect():
    const BLOCKED_EXT = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB

    handleFileSelect(file) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (file.size > MAX_SIZE) {
        this.error = 'Arquivo muito grande';
        return;
      }

      if (BLOCKED_EXT.includes(ext)) {
        this.error = `Tipo ${ext} não permitido`;
        return;
      }

      this.uploadFile(file); // OK para enviar
    }

PASSO 3: ATUALIZAR MENSAGEM DE SUPORTE
├─ Adicionar texto na UI:
    "Ace ita: .pdf, .cdr, .psd, .svg, .doc, .xls, etc"
├─ Mostrar máximo 100MB
└─ Bloqueia apenas: .exe, .bat, etc

PASSO 4: TESTAR NO BROWSER
├─ npm run dev (frontend)
├─ Tentar upload .cdr → deve funcionar
├─ Tentar upload .exe → deve bloquear
├─ Sem erros no console
```

**Checklist**:
- [ ] Arquivo upload component localizado
- [ ] Validação BLOCKED_EXT adicionada
- [ ] Validação MAX_SIZE adicionada
- [ ] Mensagem de suporte atualizada
- [ ] npm run dev rodando
- [ ] Testes de upload OK

---

#### TAREFA 2.3: Documentação e Comunicação
**Duração**: 15 min
**Files alterados**: Documentação

```
PASSO 1: DOCUMENTAR SUPORTE
├─ Criar/atualizar: docs/FILE_FORMATS.md
├─ Listar formatos suportados:
    ✅ Suportados:
    - Adobe Suite: .psd, .ai, .indd, .pdf
    - CorelDRAW: .cdr
    - Vetores: .svg, .eps
    - Documento: .doc, .docx, .xlsx, .txt
    - Video: .mp4, .avi, .mov
    - Imagem: .jpg, .png, .bmp, .gif

    ❌ NÃO Suportados (Bloqueados):
    - Executáveis: .exe, .bat, .cmd, .sh
    - Scripts: .ps1, .vbs

PASSO 2: ATUALIZAR .rules
├─ Arquivo: .rules
├─ Adicionar seção "File Upload"
├─ Documentar que aceita tudo exceto executáveis

PASSO 3: COMITAR
├─ git add backend/src/files/files.service.ts
├─ git add frontend/src/views/[Component].vue
├─ git commit -m "feat(files): accept all formats except executables"
```

**Checklist**:
- [ ] Documentação atualizada
- [ ] .rules atualizado
- [ ] Commit com mensagem clara

---

### Validação FASE 2

```
✅ Ao final desta fase:
- [ ] Files service aceita .cdr, .psd, .svg, .doc
- [ ] Frontend valida formato antes de enviar
- [ ] Backend rejeita executáveis
- [ ] Documentação atualizada
- [ ] Testes OK
```

---

## 📍 FASE 3: DASHBOARD & REPORTS (3-4 horas)

### Objetivo
Melhorar visualizações com gráficos real-time

### Tarefas Atômicas

#### TAREFA 3.1: Instalar Biblioteca de Gráficos
**Duração**: 15 min
**Files alterados**: 1

```
PASSO 1: INSTALAR CHARTJS
├─ npm install chart.js vue-chartjs
├─ npm install lodash-es
└─ Pronto

PASSO 2: IMPORTAR NO MAIN
├─ Arquivo: frontend/src/main.ts
├─ Adicionar (se não tiver):
    import Chart from 'chart.js/auto';
```

**Checklist**:
- [ ] chart.js instalado
- [ ] vue-chartjs instalado

---

#### TAREFA 3.2: Criar Dashboard com Gráficos
**Duração**: 120 min
**Files alterados**: 2 (Frontend: ReportsView.vue + Store)

```
PASSO 1: ATUALIZAR REPORTS STORE
├─ Arquivo: frontend/src/stores/reports.store.ts
├─ Adicionar estados:
    state: {
      revenue: [],    // [{ date, amount }]
      expenses: [],   // [{ date, amount }]
      topProducts: [], // [{ name, quantity }]
      ordersByStatus: {}, // { PENDING: 5, PRODUCTION: 3, ... }
      timeRange: '30d' // 7d, 30d, 90d
    },

    getters: {
      revenueTotal: (state) =>
        state.revenue.reduce((sum, r) => sum + r.amount, 0),
      expensesTotal: (state) =>
        state.expenses.reduce((sum, e) => sum + e.amount, 0),
      profitMargin: (state) => {
        const revenue = state.revenue.reduce((s,r) => s + r.amount, 0);
        const expenses = state.expenses.reduce((s,e) => s + e.amount, 0);
        return ((revenue - expenses) / revenue * 100).toFixed(2);
      }
    },

    actions: {
      async fetchReports(timeRange = '30d') {
        try {
          const response = await fetch(
            `/api/reports?timeRange=${timeRange}`
          );
          const data = await response.json();
          this.revenue = data.revenue;
          this.expenses = data.expenses;
          this.topProducts = data.topProducts;
          this.ordersByStatus = data.ordersByStatus;
        } catch (error) {
          console.error('Erro ao buscar relatórios:', error);
        }
      }
    }

PASSO 2: ATUALIZAR BACKEND REPORTS
├─ Arquivo: backend/src/reports/reports.service.ts
├─ Adicionar endpoint /reports com filtro timeRange:
    async getReports(timeRange: string = '30d', tenantId: number) {
      const date = new Date();
      let fromDate = new Date();

      if (timeRange === '7d') fromDate.setDate(date.getDate() - 7);
      else if (timeRange === '30d') fromDate.setDate(date.getDate() - 30);
      else if (timeRange === '90d') fromDate.setDate(date.getDate() - 90);

      // Queries agrupadas por data
      const revenue = await this.prisma.transaction.groupBy({
        by: ['createdAt'],
        where: {
          tenantId,
          order: {
            createdAt: { gte: fromDate }
          }
        },
        _sum: { amount: true }
      });

      const expenses = // similar query

      const topProducts = // top 10 produtos vendidos

      const ordersByStatus = // count por status

      return { revenue, expenses, topProducts, ordersByStatus };
    }

PASSO 3: ATUALIZAR CONTROLLER
├─ Arquivo: backend/src/reports/reports.controller.ts
├─ Adicionar:
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'SALES')
    async getReports(
      @Query('timeRange') timeRange: string = '30d',
      @Tenant() tenantId: number
    ) {
      return this.reportsService.getReports(timeRange, tenantId);
    }

PASSO 4: ATUALIZAR FRONTEND VIEW
├─ Arquivo: frontend/src/views/ReportsView.vue
├─ Template:
    <div class="reports-container">
      <div class="controls">
        <button
          v-for="range in ['7d', '30d', '90d']"
          @click="changeTimeRange(range)"
          :class="{ active: selectedRange === range }"
        >
          {{ range }}
        </button>
      </div>

      <div class="charts-grid">
        <!-- Revenue Chart -->
        <div class="chart-container">
          <h3>Receita</h3>
          <LineChart :data="revenueChartData" />
        </div>

        <!-- Expenses Chart -->
        <div class="chart-container">
          <h3>Despesas</h3>
          <LineChart :data="expensesChartData" />
        </div>

        <!-- Top Products -->
        <div class="chart-container">
          <h3>Top 10 Produtos</h3>
          <BarChart :data="topProductsChartData" />
        </div>

        <!-- Orders by Status -->
        <div class="chart-container">
          <h3>Pedidos por Status</h3>
          <PieChart :data="ordersStatusChartData" />
        </div>
      </div>

      <div class="kpis">
        <div class="kpi">
          <span>Receita Total</span>
          <strong>R$ {{ revenueTotal }}</strong>
        </div>
        <div class="kpi">
          <span>Despesas</span>
          <strong>R$ {{ expensesTotal }}</strong>
        </div>
        <div class="kpi">
          <span>Margem</span>
          <strong>{{ profitMargin }}%</strong>
        </div>
      </div>
    </div>

├─ Script:
    import { useReportsStore } from '@/stores/reports.store';
    import LineChart from '@/components/charts/LineChart.vue';
    import BarChart from '@/components/charts/BarChart.vue';
    import PieChart from '@/components/charts/PieChart.vue';

    export default {
      components: { LineChart, BarChart, PieChart },
      setup() {
        const reportsStore = useReportsStore();
        const selectedRange = ref('30d');

        onMounted(async () => {
          await reportsStore.fetchReports('30d');
        });

        const changeTimeRange = async (range) => {
          selectedRange.value = range;
          await reportsStore.fetchReports(range);
        };

        return {
          selectedRange,
          changeTimeRange,
          revenueChartData: computed(() => ({ /* ... */ })),
          expensesChartData: computed(() => ({ /* ... */ })),
          topProductsChartData: computed(() => ({ /* ... */ })),
          ordersStatusChartData: computed(() => ({ /* ... */ })),
          revenueTotal: computed(() => reportsStore.revenueTotal),
          expensesTotal: computed(() => reportsStore.expensesTotal),
          profitMargin: computed(() => reportsStore.profitMargin)
        };
      }
    }

PASSO 5: CRIAR COMPONENTES DE GRÁFICO
├─ Arquivo: frontend/src/components/charts/LineChart.vue
├─ Arquivo: frontend/src/components/charts/BarChart.vue
├─ Arquivo: frontend/src/components/charts/PieChart.vue
├─ (Usar vue-chartjs)
```

**Checklist**:
- [ ] chart.js + vue-chartjs instalados
- [ ] Orders store atualizado
- [ ] Reports controller com @Get endpoint
- [ ] ReportsView.vue com gráficos
- [ ] Componentes Chart criados
- [ ] npm run dev rodando
- [ ] npm run start:dev rodando
- [ ] Gráficos renderizam dados

---

#### TAREFA 3.3: Real-time Updates via Socket.io
**Duração**: 60 min
**Files alterados**: 3

```
PASSO 1: ADICIONAR REPORT EVENTS NO BACKEND
├─ Arquivo: backend/src/reports/reports.gateway.ts
├─ Código:
    @WebSocketGateway({ namespace: 'reports' })
    export class ReportsGateway {
      @SubscribeMessage('subscribe-reports')
      onSubscribe(client: Socket, data: { timeRange: string }) {
        client.join('reports-' + data.timeRange);
        console.log('Client subscribed to reports');
      }
    }

PASSO 2: EMITIR EVENTOS QUANDO DADOS MUDAM
├─ Em: backend/src/orders/orders.service.ts
├─ Quando order criada/atualizada:
    this.server.to('reports-30d').emit('reports-updated', {
      timestamp: new Date(),
      timeRange: '30d'
    });

PASSO 3: ESCUTAR NO FRONTEND
├─ Arquivo: frontend/src/stores/reports.store.ts
├─ Adicionar socket listener:
    async fetchReports(timeRange = '30d') {
      // ... fetch normal

      // Escutar updates em tempo real
      this.socket.on('reports-updated', (data) => {
        if (data.timeRange === timeRange) {
          this.fetchReports(timeRange); // Atualizar
        }
      });
    }

PASSO 4: TESTAR
├─ npm run start:dev (backend)
├─ npm run dev (frontend)
├─ Criar novo pedido
├─ Verificar se gráfico atualiza em tempo real
```

**Checklist**:
- [ ] ReportsGateway com WebSocket
- [ ] Events emitidos quando dados mudam
- [ ] Frontend escuta eventos
- [ ] Gráficos atualizam real-time
- [ ] npm run start:dev rodando
- [ ] npm run dev rodando

---

### Validação FASE 3

```
✅ Ao final desta fase:
- [ ] ReportsView com 4 gráficos principais
- [ ] Filtro por período (7d/30d/90d)
- [ ] KPIs calculados (receita, despesa, margem)
- [ ] Real-time updates via Socket.io
- [ ] Sem erros no console
- [ ] Responsivo (mobile OK)
```

---

## 📊 RESUMO TIMELINES

| Fase | Tarefas | Duração | Arquivos | Prioridade |
|------|---------|---------|----------|-----------|
| 0 | 5 tarefas | 2-3h | 10 files | 🔴 CRÍTICO |
| 1 | 4 tarefas | 3-4h | 14 files | 🔴 CRÍTICO |
| 2 | 3 tarefas | 1h | 2 files | 🟡 SIMPLES |
| 3 | 3 tarefas | 3-4h | 8 files | 🟢 NICE-TO-HAVE |
| **TOTAL** | **15 tarefas** | **~9-12h** | **~34 files** | - |

---

## 🚀 COMO USAR ESTE DOCUMENTO

1. **Leia uma TAREFA completa** (ex: TAREFA 0.1)
2. **Siga PASSO 1, 2, 3...** na ordem indicada
3. **Faça o CHECKLIST** ao final da tarefa
4. **Valide** seguindo as regras em `.rules`
5. **Comite no git** quando tarefa terminou
6. **Próxima tarefa**

---

**Última atualização**: 2025-03-19
**Status**: Pronto para inicial FASE 0
