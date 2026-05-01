import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { EstimatesService } from '../estimates/estimates.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomersService } from '../customers/customers.service';
import { ReceivablesService } from '../receivables/receivables.service';
import { PayablesService } from '../payables/payables.service';
import { ExpensesService } from '../expenses/expenses.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { MessagingService } from '../messaging/messaging.service';
import { CredentialEncryptor } from '../../../shared/credential-encryptor.service';

/**
 * McpService — backend das ferramentas que o agente IA usa via /mcp/rpc.
 *
 * Cada método aqui é uma "tool" que o Gemini pode chamar via function-calling.
 * A lista declarativa dessas tools (com schemas) está no McpController.
 *
 * Convenção: TODAS as tools recebem tenantId no scope. Multi-tenant é a regra.
 *
 * Credenciais sensíveis (geminiKey, evolutionKey) são encriptadas em repouso
 * via CredentialEncryptor — getAiConfig devolve plaintext, updateAiConfig
 * grava encriptado.
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  // Campos de AiConfig que recebem encriptação AES-256-GCM em repouso
  private readonly ENCRYPTED_FIELDS = [
    'geminiKey', 'evolutionKey',
    'openaiTtsKey', 'elevenlabsKey', 'googleTtsKey',
  ] as const;

  constructor(
    private readonly productsService:      ProductsService,
    private readonly ordersService:        OrdersService,
    private readonly estimatesService:     EstimatesService,
    private readonly paymentsService:      PaymentsService,
    private readonly filesService:         FilesService,
    private readonly notificationsService: NotificationsService,
    private readonly customersService:     CustomersService,
    private readonly receivablesService:   ReceivablesService,
    private readonly payablesService:      PayablesService,
    private readonly expensesService:      ExpensesService,
    private readonly suppliersService:     SuppliersService,
    private readonly messagingService:     MessagingService,
    private readonly prisma:               PrismaService,
    private readonly cryptor:              CredentialEncryptor,
  ) {}

  // ════════════════════════════════════════════════════════════════════════
  // 🧰 CATÁLOGO E DISPATCH DE TOOLS (compartilhado WhatsApp + ChatERP)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Catálogo de 16 tools que a IA pode chamar via function-calling.
   * Mesma estrutura serve o agente do WhatsApp (/mcp/rpc tools/list) e o
   * AiChatService do ERP (sem HTTP — chamada direta).
   */
  toolsCatalog() {
    return [
      // 👤 Cliente / Identificação
      {
        name: 'find_or_create_customer',
        description: 'Identifica o cliente pelo telefone do WhatsApp. Cria se não existir. Use SEMPRE no início da conversa pra obter customerId.',
        inputSchema: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Telefone com DDD, só dígitos.' },
            name:  { type: 'string', description: 'Nome do cliente (se já souber).' },
            email: { type: 'string', description: 'Email do cliente (opcional).' },
          },
          required: ['phone'],
        },
      },
      {
        name: 'get_customer_history',
        description: 'Retorna últimos 5 orçamentos e 5 pedidos do cliente.',
        inputSchema: {
          type: 'object',
          properties: { phone: { type: 'string' } },
          required: ['phone'],
        },
      },
      // 📦 Catálogo / Preços
      {
        name: 'search_products',
        description: 'Busca produtos disponíveis no catálogo (já filtrados pelo que o agente pode oferecer).',
        inputSchema: {
          type: 'object',
          properties: {
            query:    { type: 'string', description: 'Substring no nome do produto.' },
            category: { type: 'number', description: 'Filtra por typeId (categoria).' },
            limit:    { type: 'number', description: 'Máx. de resultados (default 20).' },
          },
        },
      },
      {
        name: 'quote_price',
        description: 'Calcula preço de N unidades de um produto.',
        inputSchema: {
          type: 'object',
          properties: { productId: { type: 'number' }, quantity: { type: 'number' } },
          required: ['productId', 'quantity'],
        },
      },
      // 📝 Orçamentos
      {
        name: 'create_estimate',
        description: 'Cria um orçamento estruturado com items[]. Cada item tem productId + quantity.',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'number' },
                  quantity:  { type: 'number' },
                  unitPrice: { type: 'number', description: 'Opcional. Se omitido, usa o preço cadastrado.' },
                },
                required: ['productId', 'quantity'],
              },
            },
            estimateType: {
              type: 'string',
              enum: ['service', 'plotter', 'cutting', 'embroidery'],
              description: 'Tipo de orçamento. Default: service.',
            },
            notes: { type: 'string', description: 'Observações livres.' },
          },
          required: ['customerId', 'items'],
        },
      },
      {
        name: 'send_estimate_link',
        description: 'Gera URL pública pra o cliente aprovar/rejeitar o orçamento. Marca status como SENT.',
        inputSchema: {
          type: 'object',
          properties: { estimateId: { type: 'number' } },
          required: ['estimateId'],
        },
      },
      {
        name: 'list_customer_estimates',
        description: 'Lista orçamentos do cliente. Filtro opcional por status.',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'number' },
            status:     { type: 'string' },
            limit:      { type: 'number' },
          },
          required: ['customerId'],
        },
      },
      // 🛒 Pedidos
      {
        name: 'convert_estimate_to_order',
        description: 'Aprova orçamento e cria pedido em produção.',
        inputSchema: {
          type: 'object',
          properties: {
            estimateId:   { type: 'number' },
            deliveryDate: { type: 'string', description: 'YYYY-MM-DD (opcional).' },
          },
          required: ['estimateId'],
        },
      },
      {
        name: 'get_order_status',
        description: 'Status de produção e pagamento de um pedido específico.',
        inputSchema: {
          type: 'object',
          properties: { orderId: { type: 'number' } },
          required: ['orderId'],
        },
      },
      {
        name: 'list_customer_orders',
        description: 'Lista pedidos do cliente.',
        inputSchema: {
          type: 'object',
          properties: { customerId: { type: 'number' }, limit: { type: 'number' } },
          required: ['customerId'],
        },
      },
      // 💰 Pagamentos
      {
        name: 'generate_payment',
        description: 'Gera cobrança PIX (QR + copia/cola) ou link Mercado Pago (cartão/boleto/PIX).',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'number' },
            method:  { type: 'string', enum: ['PIX', 'LINK'], description: 'Default: PIX.' },
          },
          required: ['orderId'],
        },
      },
      {
        name: 'check_payment_status',
        description: 'Confere se o pagamento já caiu. Use quando o cliente diz "já paguei".',
        inputSchema: {
          type: 'object',
          properties: { orderId: { type: 'number' } },
          required: ['orderId'],
        },
      },
      // 📎 Arquivos
      {
        name: 'upload_artwork',
        description: 'Anexa arte/foto. target.estimateId pra orçamento, target.orderId pra pedido.',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'object',
              properties: {
                estimateId: { type: 'number' },
                orderId:    { type: 'number' },
              },
            },
            base64:   { type: 'string', description: 'Conteúdo do arquivo em base64.' },
            filename: { type: 'string' },
            mimetype: { type: 'string' },
          },
          required: ['target', 'base64', 'filename', 'mimetype'],
        },
      },
      // ℹ️ Negócio
      {
        name: 'get_business_info',
        description: 'Endereço, horário, formas de pagamento, prazo padrão da gráfica.',
        inputSchema: { type: 'object', properties: {} },
      },
      // 🚨 Escalação
      {
        name: 'notify_operator',
        description: 'Pede atendimento humano. Use quando: cliente solicitou, IA não conseguiu resolver após 2-3 tentativas.',
        inputSchema: {
          type: 'object',
          properties: {
            phone:   { type: 'string' },
            reason:  { type: 'string' },
            summary: { type: 'string', description: 'Resumo da conversa.' },
          },
          required: ['phone', 'reason', 'summary'],
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // Tools do modo ERP — perguntas que o operador faz no chat ERP
      // (top clientes, pedidos pendentes, estoque baixo, financeiro, etc).
      // No WhatsApp essas tools tambem ficam disponiveis, mas raramente sao
      // chamadas porque o cliente final nao pergunta esse tipo de coisa.
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'list_orders',
        description: 'Lista pedidos do tenant com filtros. Use pra "pedidos pendentes hoje", "em producao", "atrasados", etc.',
        inputSchema: {
          type: 'object',
          properties: {
            status:        { type: 'string', enum: ['PENDING','PRODUCTION','FINISHED','DELIVERED'], description: 'Filtra por status de producao.' },
            paymentStatus: { type: 'string', enum: ['PENDING','PAID','PARTIAL','REFUNDED','CANCELLED'], description: 'Filtra por status de pagamento.' },
            customerId:    { type: 'number', description: 'Limita a um cliente.' },
            dateFrom:      { type: 'string', description: 'YYYY-MM-DD inclusive.' },
            dateTo:        { type: 'string', description: 'YYYY-MM-DD inclusive.' },
            limit:         { type: 'number', description: 'Default 20, max 100.' },
          },
        },
      },
      {
        name: 'list_estimates',
        description: 'Lista orcamentos do tenant com filtros. Use pra "orcamentos pendentes", "aprovados na semana", etc.',
        inputSchema: {
          type: 'object',
          properties: {
            status:       { type: 'string', enum: ['DRAFT','SENT','APPROVED','REJECTED','EXPIRED'] },
            estimateType: { type: 'string', enum: ['service','plotter','cutting','embroidery'] },
            customerId:   { type: 'number' },
            dateFrom:     { type: 'string' },
            dateTo:       { type: 'string' },
            limit:        { type: 'number' },
          },
        },
      },
      {
        name: 'search_customers',
        description: 'Busca clientes por nome, email ou telefone (sem auto-criar). Use pra "achar cliente Joao".',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Substring no nome, email ou telefone.' },
            limit: { type: 'number' },
          },
          required: ['query'],
        },
      },
      {
        name: 'top_customers',
        description: 'Top N clientes por receita num periodo. Use pra "top 10 clientes do mes".',
        inputSchema: {
          type: 'object',
          properties: {
            limit:    { type: 'number', description: 'Default 10.' },
            dateFrom: { type: 'string', description: 'YYYY-MM-DD. Default: inicio do mes.' },
            dateTo:   { type: 'string', description: 'YYYY-MM-DD. Default: hoje.' },
          },
        },
      },
      {
        name: 'financial_summary',
        description: 'Resumo financeiro: receita, despesas, saldo num periodo. Use pra "como ta o financeiro da semana".',
        inputSchema: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', description: 'YYYY-MM-DD. Default: 30 dias atras.' },
            dateTo:   { type: 'string', description: 'YYYY-MM-DD. Default: hoje.' },
          },
        },
      },
      {
        name: 'overdue_payments',
        description: 'Lista contas vencidas — recebiveis (clientes devem) e pagaveis (fornecedores a pagar). Use pra "cobrancas vencidas".',
        inputSchema: {
          type: 'object',
          properties: {
            kind:  { type: 'string', enum: ['receivables','payables','both'], description: 'Default: both.' },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'low_stock_products',
        description: 'Lista produtos com estoque <= minStock (ou <= threshold customizado). Use pra "o que precisa repor".',
        inputSchema: {
          type: 'object',
          properties: {
            threshold: { type: 'number', description: 'Override do minStock — produtos com stock <= threshold. Default: usa minStock de cada produto.' },
            limit:     { type: 'number' },
          },
        },
      },
      {
        name: 'dashboard_kpis',
        description: 'KPIs operacionais do dia/mes: pedidos hoje, em producao, faturamento, orcamentos pendentes, recebiveis vencidos.',
        inputSchema: { type: 'object', properties: {} },
      },

      // ────────────────────────────────────────────────────────────────────
      // 🔧 TOOLS EXECUTORAS — agem no ERP (mudam estado).
      // CONFIRMAR antes de chamar — system prompt já instrui a IA.
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'update_order_status',
        description: 'Avanca/muda o status de producao de um pedido. Operacao destrutiva — confirme antes de chamar.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'number' },
            status:  { type: 'string', enum: ['PENDING','PRODUCTION','FINISHED','DELIVERED'] },
          },
          required: ['orderId', 'status'],
        },
      },
      {
        name: 'mark_receivable_paid',
        description: 'Marca uma cobranca/recebivel (Invoice) como paga. Use quando cliente confirma pagamento. Confirme antes de chamar.',
        inputSchema: {
          type: 'object',
          properties: {
            receivableId: { type: 'number' },
            paidAmount:   { type: 'number', description: 'Valor recebido (pode ser parcial).' },
            paidAt:       { type: 'string', description: 'YYYY-MM-DD. Default: hoje.' },
          },
          required: ['receivableId', 'paidAmount'],
        },
      },
      {
        name: 'mark_payable_paid',
        description: 'Marca uma conta a pagar (Bill) como paga. Confirme antes de chamar.',
        inputSchema: {
          type: 'object',
          properties: {
            payableId:  { type: 'number' },
            paidAmount: { type: 'number' },
            paidAt:     { type: 'string', description: 'YYYY-MM-DD. Default: hoje.' },
          },
          required: ['payableId', 'paidAmount'],
        },
      },
      {
        name: 'create_customer',
        description: 'Cria um novo cliente. Use quando operador pede "cadastra cliente novo X". Diferente de find_or_create_customer (que e do fluxo WhatsApp).',
        inputSchema: {
          type: 'object',
          properties: {
            name:    { type: 'string' },
            phone:   { type: 'string', description: 'So digitos. Opcional.' },
            email:   { type: 'string', description: 'Opcional.' },
            cpfCnpj: { type: 'string', description: 'Opcional.' },
            address: { type: 'string', description: 'Endereco completo. Opcional.' },
            notes:   { type: 'string', description: 'Observacoes. Opcional.' },
          },
          required: ['name'],
        },
      },
      {
        name: 'add_expense',
        description: 'Lanca uma despesa (sai do caixa). Use pra "registra a despesa de X reais com Y".',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            amount:      { type: 'number', description: 'Valor em reais.' },
            category:    { type: 'string', description: 'Ex: Utilidades, Insumos, Marketing.' },
            date:        { type: 'string', description: 'YYYY-MM-DD. Default: hoje.' },
            supplierId:  { type: 'number', description: 'Opcional.' },
          },
          required: ['description', 'amount', 'category'],
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 📨 COMUNICACAO — chat ERP dispara WhatsApp/email no mundo real
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'send_whatsapp_message',
        description: 'CANAL WHATSAPP. Use SOMENTE se o operador disse explicitamente "WhatsApp", "whats", "wpp", "zap", "zapzap", "manda mensagem", "no celular" ou "no numero". NAO use pra "manda email". Envia via Evolution API.',
        inputSchema: {
          type: 'object',
          properties: {
            phone:   { type: 'string', description: 'Telefone do cliente — passe como esta no banco/cadastro (ex: "61999989402"). A tool ja adiciona "55" automaticamente se faltar. NAO edite o numero manualmente.' },
            message: { type: 'string', description: 'Texto da mensagem.' },
          },
          required: ['phone', 'message'],
        },
      },
      {
        name: 'send_email',
        description: 'CANAL EMAIL (SMTP). Use SOMENTE se o operador disse explicitamente "email", "e-mail" ou "correio eletronico". NAO use pra "WhatsApp", "whats", "wpp" ou "zap" — pra esses use send_whatsapp_message.',
        inputSchema: {
          type: 'object',
          properties: {
            to:      { type: 'string', description: 'Email destinatario.' },
            subject: { type: 'string' },
            body:    { type: 'string', description: 'HTML ou texto puro.' },
          },
          required: ['to', 'subject', 'body'],
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 📄 PDFs — gera URL publica pra baixar
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'generate_estimate_pdf',
        description: 'Gera URL publica de aprovacao do orcamento (cliente abre, ve, aprova). Marca como SENT. Use pra "manda link do orcamento N".',
        inputSchema: {
          type: 'object',
          properties: { estimateId: { type: 'number' } },
          required:   ['estimateId'],
        },
      },
      {
        name: 'generate_order_receipt_pdf',
        description: 'Gera URL pra baixar PDF do recibo do pedido (2 vias). Use pra "imprime recibo do pedido N".',
        inputSchema: {
          type: 'object',
          properties: { orderId: { type: 'number' } },
          required:   ['orderId'],
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 💸 FINANCEIRO — criar contas (temos mark_paid; faltava criar)
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'add_receivable',
        description: 'Cria nova conta a receber (Invoice). Use pra "lanca cobranca de R$ X pra cliente Y vencendo Z".',
        inputSchema: {
          type: 'object',
          properties: {
            customerId:  { type: 'number' },
            description: { type: 'string' },
            amount:      { type: 'number' },
            dueDate:     { type: 'string', description: 'YYYY-MM-DD' },
            orderId:     { type: 'number', description: 'Opcional — vincula a um pedido.' },
            notes:       { type: 'string', description: 'Opcional.' },
          },
          required: ['customerId', 'description', 'amount', 'dueDate'],
        },
      },
      {
        name: 'add_payable',
        description: 'Cria nova conta a pagar (Bill). Use pra "lanca conta de R$ X com fornecedor Y vencendo Z".',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            amount:      { type: 'number' },
            dueDate:     { type: 'string', description: 'YYYY-MM-DD' },
            supplierId:  { type: 'number', description: 'Opcional.' },
            notes:       { type: 'string', description: 'Opcional.' },
          },
          required: ['description', 'amount', 'dueDate'],
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 📦 ESTOQUE — entrada/saida manual de produto
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'stock_movement',
        description: 'Registra entrada (PURCHASE), saida (SALE) ou ajuste (ADJUSTMENT) de estoque pra um produto. Use pra "deu entrada de N papel A4".',
        inputSchema: {
          type: 'object',
          properties: {
            productId: { type: 'number' },
            quantity:  { type: 'number', description: 'Positivo = entrada, negativo = saida (ou use type pra clareza).' },
            type:      { type: 'string', enum: ['PURCHASE', 'SALE', 'ADJUSTMENT'], description: 'Default ADJUSTMENT.' },
            reason:    { type: 'string', description: 'Motivo (ex: "Compra fornecedor X", "Ajuste inventario").' },
          },
          required: ['productId', 'quantity'],
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 📅 AGENDA / SCHEDULE — visao do que precisa ser entregue
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'get_schedule',
        description: 'Lista pedidos com data de entrega num intervalo. Use pra "o que entregar hoje/essa semana/proximos N dias".',
        inputSchema: {
          type: 'object',
          properties: {
            range: { type: 'string', enum: ['today', 'tomorrow', 'week', 'overdue', 'custom'], description: 'Default today.' },
            dateFrom: { type: 'string', description: 'YYYY-MM-DD (so pra range=custom).' },
            dateTo:   { type: 'string', description: 'YYYY-MM-DD.' },
            limit:    { type: 'number' },
          },
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 📋 LISTAGENS adicionais — produtos e fornecedores
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'list_products',
        description: 'Lista produtos com filtros (categoria, marca, etc). Diferente de search_products que retorna mais limitado.',
        inputSchema: {
          type: 'object',
          properties: {
            query:     { type: 'string', description: 'Substring no nome.' },
            typeId:    { type: 'number', description: 'Filtra por categoria.' },
            supplierId:{ type: 'number' },
            withStock: { type: 'boolean', description: 'Se true, so retorna com estoque > 0.' },
            limit:     { type: 'number', description: 'Default 30.' },
          },
        },
      },
      {
        name: 'list_suppliers',
        description: 'Lista fornecedores cadastrados. Use pra "quais fornecedores temos".',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Substring no nome.' },
            limit: { type: 'number' },
          },
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 🆕 CADASTROS — criar fornecedor e produto via chat
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'create_supplier',
        description: 'Cria novo fornecedor. Use pra "cadastra fornecedor X".',
        inputSchema: {
          type: 'object',
          properties: {
            name:     { type: 'string' },
            phone:    { type: 'string' },
            email:    { type: 'string' },
            category: { type: 'string', description: 'Ex: Papel, Tinta, Servicos.' },
            address:  { type: 'string' },
          },
          required: ['name'],
        },
      },
      {
        name: 'create_product',
        description: 'Cria novo produto no catalogo. Use pra "cadastra produto X com preco Y".',
        inputSchema: {
          type: 'object',
          properties: {
            name:        { type: 'string' },
            typeId:      { type: 'number', description: 'ID da categoria. Use search ou liste tipos antes.' },
            unitPrice:   { type: 'number' },
            unit:        { type: 'string', description: 'Default "un". Outros: m², kg, h.' },
            stock:       { type: 'number', description: 'Estoque inicial.' },
            minStock:    { type: 'number', description: 'Limite minimo pra alertar.' },
            description: { type: 'string' },
            supplierId:  { type: 'number' },
            brand:       { type: 'string' },
          },
          required: ['name', 'typeId', 'unitPrice'],
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 🔗 TOOLS COMBINADAS — fluxos comuns em 1 chamada (1 turno na IA)
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'send_estimate_via_whatsapp',
        description: 'Combina generate_estimate_pdf + send_whatsapp_message. Use pra "manda orcamento N pelo WhatsApp do cliente". Pega telefone do customer do orcamento automaticamente.',
        inputSchema: {
          type: 'object',
          properties: {
            estimateId: { type: 'number' },
            phone:      { type: 'string', description: 'Opcional — se nao passar, usa o telefone do cliente do orcamento.' },
            message:    { type: 'string', description: 'Mensagem custom. Default: "Segue orcamento: {url}".' },
          },
          required: ['estimateId'],
        },
      },
      {
        name: 'send_estimate_via_email',
        description: 'Combina generate_estimate_pdf + send_email. Use pra "manda orcamento N por email pro cliente".',
        inputSchema: {
          type: 'object',
          properties: {
            estimateId: { type: 'number' },
            to:         { type: 'string', description: 'Opcional — usa email do cliente se vazio.' },
            subject:    { type: 'string', description: 'Default: "Orcamento de {empresa}".' },
            message:    { type: 'string', description: 'Corpo extra antes do link. Opcional.' },
          },
          required: ['estimateId'],
        },
      },
      {
        name: 'send_payment_link',
        description: 'Gera PIX e envia pro cliente. Combina generate_payment + send_whatsapp_message OU send_email. Use pra "manda cobranca do pedido N".',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'number' },
            channel: { type: 'string', enum: ['whatsapp', 'email'], description: 'Default: whatsapp.' },
            method:  { type: 'string', enum: ['PIX', 'LINK'], description: 'Default: PIX.' },
          },
          required: ['orderId'],
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // 🧠 MEMÓRIA — IA registra preferências do operador entre sessões
      // ────────────────────────────────────────────────────────────────────

      {
        name: 'remember_preference',
        description: 'Salva uma preferencia do operador pra ela aparecer no prompt das proximas conversas. Use quando o user diz "lembra que eu prefiro X" ou "anota aqui que sempre faco Y".',
        inputSchema: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'Frase curta — ex: "Cliente X prefere PIX", "Sempre cobra 10% adiantado".' },
          },
          required: ['note'],
        },
      },
      {
        name: 'forget_preference',
        description: 'Remove uma preferencia salva. Use quando o user diz "esquece aquilo de X" ou "nao precisa mais lembrar Y".',
        inputSchema: {
          type: 'object',
          properties: {
            match: { type: 'string', description: 'Substring que identifica a nota a remover.' },
          },
          required: ['match'],
        },
      },
    ];
  }

  /**
   * Dispatch das tools — cada chave bate com `name` no toolsCatalog.
   * Retorna sempre no formato MCP `{ content: [{type:'text', text}] }` pra o
   * agente Gemini conseguir consumir uniformemente.
   *
   * `context` define o "modo" do caller:
   *   - 'whatsapp' (default) — aplica restrições do AiConfig (allowedProductIds,
   *     allowedEstimateTypes), pois o agente fala com cliente final.
   *   - 'erp' — sem restrições; o operador autenticado pode ver/criar tudo.
   *
   * O AiChatService passa 'erp' diretamente (sem HTTP). O endpoint /mcp/rpc
   * (consumido pelo ai-agent do WhatsApp) usa default 'whatsapp'.
   */
  async callTool(
    name: string,
    args: any,
    tenantId: number,
    context: 'whatsapp' | 'erp' = 'whatsapp',
    userId?: number | null,
    sessionId?: string | null,
  ) {
    const start = Date.now();
    let result: any;
    let success = true;
    let errorMsg: string | undefined;
    try {
      result = await this.dispatchTool(name, args, tenantId, context, userId);
      // Se o dispatcher devolveu wrap MCP com erro lá dentro, marca success=false
      const inner = result?.content?.[0]?.text;
      if (inner) {
        try {
          const parsed = JSON.parse(inner);
          if (parsed?.error) { success = false; errorMsg = parsed.error; }
        } catch { /* não-JSON é resposta válida */ }
      } else if (result?.error) {
        success = false; errorMsg = result.error;
      }
      return result;
    } catch (e: any) {
      success = false;
      errorMsg = e?.message || String(e);
      return (result = { error: errorMsg });
    } finally {
      void this.logToolCall({
        tenantId, userId, sessionId, channel: context, toolName: name, args,
        result, success, errorMsg, latencyMs: Date.now() - start,
      });
    }
  }

  /** Switch puro — não loga, só dispatcha. Wrapping de log fica no callTool. */
  private async dispatchTool(
    name: string,
    args: any,
    tenantId: number,
    context: 'whatsapp' | 'erp',
    userId?: number | null,
  ) {
    switch (name) {
        // Cliente
        case 'find_or_create_customer':   return this.wrap(await this.findOrCreateCustomer(args, tenantId));
        case 'get_customer_history':      return this.wrap(await this.getCustomerHistory(args, tenantId));
        // Catalogo
        case 'search_products':           return this.wrap(await this.searchProducts(args, tenantId, context));
        case 'quote_price':               return this.wrap(await this.quotePrice(args, tenantId));
        // Orcamentos
        case 'create_estimate':           return this.wrap(await this.createEstimate(args, tenantId, context));
        case 'send_estimate_link':        return this.wrap(await this.sendEstimateLink(args, tenantId));
        case 'list_customer_estimates':   return this.wrap(await this.listCustomerEstimates(args, tenantId));
        // Pedidos
        case 'convert_estimate_to_order': return this.wrap(await this.convertEstimateToOrder(args, tenantId));
        case 'get_order_status':          return this.wrap(await this.getOrderStatus(args, tenantId));
        case 'list_customer_orders':      return this.wrap(await this.listCustomerOrders(args, tenantId));
        // Pagamentos
        case 'generate_payment':          return this.wrap(await this.generatePayment(args));
        case 'check_payment_status':      return this.wrap(await this.checkPaymentStatus(args, tenantId));
        // Arquivos
        case 'upload_artwork':            return this.wrap(await this.uploadArtwork(args, tenantId));
        // Negocio
        case 'get_business_info':         return this.wrap(await this.getBusinessInfo(tenantId));
        // Escalacao
        case 'notify_operator':           return this.wrap(await this.notifyOperator(args, tenantId));

        // Tools modo ERP (operador)
        case 'list_orders':               return this.wrap(await this.listOrders(args, tenantId));
        case 'list_estimates':            return this.wrap(await this.listEstimates(args, tenantId));
        case 'search_customers':          return this.wrap(await this.searchCustomers(args, tenantId));
        case 'top_customers':             return this.wrap(await this.topCustomers(args, tenantId));
        case 'financial_summary':         return this.wrap(await this.financialSummary(args, tenantId));
        case 'overdue_payments':          return this.wrap(await this.overduePayments(args, tenantId));
        case 'low_stock_products':        return this.wrap(await this.lowStockProducts(args, tenantId));
        case 'dashboard_kpis':            return this.wrap(await this.dashboardKpis(tenantId));

        // Tools executoras (mudam estado) — userId real do operador pra audit log
        case 'update_order_status':       return this.wrap(await this.updateOrderStatus(args, tenantId, userId));
        case 'mark_receivable_paid':      return this.wrap(await this.markReceivablePaid(args, tenantId));
        case 'mark_payable_paid':         return this.wrap(await this.markPayablePaid(args, tenantId));
        case 'create_customer':           return this.wrap(await this.createCustomer(args, tenantId));
        case 'add_expense':               return this.wrap(await this.addExpense(args, tenantId));

        // Comunicação
        case 'send_whatsapp_message':     return this.wrap(await this.sendWhatsappMessage(args, tenantId));
        case 'send_email':                return this.wrap(await this.sendEmailTool(args, tenantId));
        // PDFs (devolvem URL pra download)
        case 'generate_estimate_pdf':     return this.wrap(await this.generateEstimatePdf(args, tenantId));
        case 'generate_order_receipt_pdf':return this.wrap(await this.generateOrderReceiptPdf(args, tenantId));
        // Financeiro (criar contas)
        case 'add_receivable':            return this.wrap(await this.addReceivable(args, tenantId));
        case 'add_payable':               return this.wrap(await this.addPayable(args, tenantId));
        // Estoque
        case 'stock_movement':            return this.wrap(await this.stockMovement(args, tenantId));
        // Agenda
        case 'get_schedule':              return this.wrap(await this.getSchedule(args, tenantId));
        // Listagens adicionais
        case 'list_products':             return this.wrap(await this.listProducts(args, tenantId));
        case 'list_suppliers':            return this.wrap(await this.listSuppliers(args, tenantId));
        // Cadastros
        case 'create_supplier':           return this.wrap(await this.createSupplier(args, tenantId));
        case 'create_product':            return this.wrap(await this.createProduct(args, tenantId));

        // Tools combinadas (chains comuns em 1 chamada)
        case 'send_estimate_via_whatsapp':return this.wrap(await this.sendEstimateViaWhatsapp(args, tenantId));
        case 'send_estimate_via_email':   return this.wrap(await this.sendEstimateViaEmail(args, tenantId));
        case 'send_payment_link':         return this.wrap(await this.sendPaymentLink(args, tenantId));

        // Memória do operador
        case 'remember_preference':       return this.wrap(await this.rememberPreference(args, tenantId, userId));
        case 'forget_preference':         return this.wrap(await this.forgetPreference(args, tenantId, userId));

        default:
          return { error: `Ferramenta ${name} nao encontrada` };
    }
  }

  /**
   * Persiste uma chamada de tool no AiToolCall. Fire-and-forget — falhas
   * aqui são logadas mas nunca interrompem a operação principal.
   *
   * Resultados grandes (>4kb stringificado) ficam truncados pra não
   * inflar o banco. Args raramente passam disso.
   */
  private async logToolCall(entry: {
    tenantId: number; userId?: number | null; sessionId?: string | null;
    channel: 'erp' | 'whatsapp'; toolName: string;
    args: any; result: any;
    success: boolean; errorMsg?: string;
    latencyMs: number;
  }) {
    try {
      // Extrai o payload "real" se vier no formato MCP { content: [{text: JSON}] }
      let resultJson: any = entry.result;
      if (resultJson?.content?.[0]?.text) {
        try { resultJson = JSON.parse(resultJson.content[0].text); }
        catch { /* mantém raw */ }
      }
      const truncated = this.truncateForJson(resultJson, 4000);
      const success = entry.success && !(typeof resultJson === 'object' && resultJson?.error);
      const errorMsg = entry.errorMsg || (typeof resultJson === 'object' ? resultJson?.error : undefined);

      await (this.prisma as any).aiToolCall.create({
        data: {
          tenantId:  entry.tenantId,
          userId:    entry.userId ?? null,
          sessionId: entry.sessionId ?? null,
          channel:   entry.channel,
          toolName:  entry.toolName,
          args:      this.truncateForJson(entry.args, 2000),
          result:    truncated,
          success,
          errorMsg:  errorMsg?.slice?.(0, 500) ?? null,
          latencyMs: entry.latencyMs,
        },
      });
    } catch (e: any) {
      this.logger.warn(`logToolCall falhou (ignorando): ${e.message}`);
    }
  }

  /** Trunca JSON pra ficar abaixo do tamanho — preserva tipos básicos. */
  private truncateForJson(obj: any, maxLen: number): any {
    try {
      const s = JSON.stringify(obj ?? null);
      if (s.length <= maxLen) return obj;
      return { _truncated: true, preview: s.slice(0, maxLen) };
    } catch {
      return null;
    }
  }

  /** Wraps payload no formato MCP standard. */
  private wrap(payload: any) {
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 👤 CLIENTE / IDENTIFICAÇÃO
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Identifica cliente pelo telefone (do WhatsApp). Cria se não existir.
   * Phone normalizado: só dígitos, sem máscara.
   */
  async findOrCreateCustomer(args: { phone: string; name?: string; email?: string }, tenantId: number) {
    const phone = String(args.phone || '').replace(/\D+/g, '');
    if (!phone) return { error: 'Telefone obrigatório.' };

    let customer = await (this.prisma as any).customer.findFirst({
      where: { tenantId, phone },
    });

    let isNew = false;
    if (!customer) {
      customer = await (this.prisma as any).customer.create({
        data: {
          tenantId,
          phone,
          name:  args.name  || `Cliente ${phone.slice(-4)}`,
          email: args.email || null,
        },
      });
      isNew = true;
    }
    return { customerId: customer.id, name: customer.name, phone: customer.phone, email: customer.email, isNew };
  }

  /** Histórico do cliente — últimos 5 orçamentos + 5 pedidos. */
  async getCustomerHistory(args: { phone: string }, tenantId: number) {
    const phone = String(args.phone || '').replace(/\D+/g, '');
    const customer = await (this.prisma as any).customer.findFirst({ where: { tenantId, phone } });
    if (!customer) return { error: 'Cliente não encontrado.' };

    const [estimates, orders] = await Promise.all([
      (this.prisma as any).estimate.findMany({
        where: { tenantId, customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, uuid: true, status: true, totalPrice: true, estimateType: true, createdAt: true },
      }),
      (this.prisma as any).order.findMany({
        where: { tenantId, customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, paymentStatus: true, amount: true, productDescription: true, createdAt: true },
      }),
    ]);
    return { customer: { id: customer.id, name: customer.name, phone: customer.phone }, estimates, orders };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📦 CATÁLOGO / PREÇOS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Busca produtos disponíveis. Aplica restrições do AiConfig:
   *   - allowedProductIds (mais granular ganha) ou
   *   - allowedProductTypes (fallback)
   * Filtros opcionais: query (substring nome) e category (typeId).
   */
  async searchProducts(
    args: { query?: string; category?: number; limit?: number },
    tenantId: number,
    context: 'whatsapp' | 'erp' = 'whatsapp',
  ) {
    const all = await this.productsService.findAllInternal(tenantId);

    let products: any[] = all;
    // Restricoes do AiConfig so se aplicam ao WhatsApp. Operador no chat ERP
    // ve catalogo completo.
    if (context === 'whatsapp') {
      const config = await this.getAiConfig(tenantId);
      if (config?.allowedProductIds?.length > 0) {
        const allowed = new Set<number>(config.allowedProductIds);
        products = products.filter((p: any) => allowed.has(p.id));
      } else if (config?.allowedProductTypes?.length > 0) {
        const allowed = new Set<number>(config.allowedProductTypes);
        products = products.filter((p: any) => allowed.has(p.typeId));
      }
    }

    if (args.category)              products = products.filter((p: any) => p.typeId === args.category);
    if (args.query) {
      const q = args.query.toLowerCase();
      products = products.filter((p: any) => p.name.toLowerCase().includes(q));
    }

    const limit = Math.min(50, Math.max(1, args.limit || 20));
    return products.slice(0, limit).map((p: any) => ({
      id:          p.id,
      name:        p.name,
      type:        p.productType?.name,
      unitPrice:   p.unitPrice,
      unit:        p.unit,
      description: p.description,
    }));
  }

  /** Calcula preço de N unidades de um produto. */
  async quotePrice(args: { productId: number; quantity: number }, tenantId: number) {
    const product = await (this.prisma as any).product.findFirst({
      where: { id: args.productId, tenantId },
    });
    if (!product) return { error: `Produto ${args.productId} não encontrado.` };
    const qty   = Math.max(1, +args.quantity || 1);
    const total = parseFloat((product.unitPrice * qty).toFixed(2));
    return {
      productId: product.id,
      name:      product.name,
      unitPrice: product.unitPrice,
      quantity:  qty,
      total,
      unit:      product.unit,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📝 ORÇAMENTOS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Cria orçamento estruturado. Valida estimateType contra allowedEstimateTypes
   * do AiConfig (se vazio, permite tudo).
   *
   * items: [{ productId, quantity, unitPrice? }] — se unitPrice omitido, usa o do produto.
   */
  async createEstimate(
    args: {
      customerId: number;
      items: Array<{ productId: number; quantity: number; unitPrice?: number }>;
      estimateType?: 'service' | 'plotter' | 'cutting' | 'embroidery';
      notes?: string;
    },
    tenantId: number,
    context: 'whatsapp' | 'erp' = 'whatsapp',
  ) {
    const estimateType = args.estimateType || 'service';

    // Restricao de tipos so se aplica ao WhatsApp (operador pode tudo).
    if (context === 'whatsapp') {
      const config = await this.getAiConfig(tenantId);
      if (config?.allowedEstimateTypes?.length > 0 && !config.allowedEstimateTypes.includes(estimateType)) {
        return {
          error: `Tipo de orcamento "${estimateType}" nao permitido pelo agente. Permitidos: ${config.allowedEstimateTypes.join(', ')}.`,
        };
      }
    }

    if (!args.items?.length) return { error: 'Pelo menos um item é obrigatório.' };

    // Resolve preços e calcula total
    const enrichedItems: any[] = [];
    let totalPrice = 0;
    for (const it of args.items) {
      const p = await (this.prisma as any).product.findFirst({
        where: { id: it.productId, tenantId },
      });
      if (!p) return { error: `Produto ${it.productId} não encontrado.` };
      const unitPrice = it.unitPrice ?? p.unitPrice;
      const qty = Math.max(1, +it.quantity || 1);
      const lineTotal = parseFloat((unitPrice * qty).toFixed(2));
      enrichedItems.push({
        productId: p.id, productName: p.name, quantity: qty, unitPrice, total: lineTotal,
      });
      totalPrice += lineTotal;
    }
    totalPrice = parseFloat(totalPrice.toFixed(2));

    const estimate = await this.estimatesService.create(
      {
        customerId:   args.customerId,
        totalPrice,
        estimateType,
        details:      { items: enrichedItems, notes: args.notes },
      } as any,
      tenantId,
    );
    return {
      estimateId: estimate.id,
      uuid:       estimate.uuid,
      totalPrice,
      itemCount:  enrichedItems.length,
      status:     estimate.status,
    };
  }

  /** Gera URL pública de aprovação. Cliente acessa, vê detalhes, aprova/rejeita. */
  async sendEstimateLink(args: { estimateId: number }, tenantId: number) {
    const estimate = await (this.prisma as any).estimate.findFirst({
      where: { id: args.estimateId, tenantId },
      select: { uuid: true, status: true },
    });
    if (!estimate) return { error: 'Orçamento não encontrado.' };

    // Marca como SENT pra o cliente saber que foi enviado
    if (estimate.status === 'DRAFT') {
      await this.estimatesService.markSent(args.estimateId, tenantId);
    }

    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    // Convenção do projeto: link público abre na SPA frontend, não no backend
    const baseUrl = apiUrl.replace(/\/api\/?$/, '').replace(/:\d+$/, '');
    const url = `${baseUrl}/p/estimate/${estimate.uuid}`;
    return { uuid: estimate.uuid, url, status: 'SENT' };
  }

  /** Lista orçamentos do cliente, com filtro opcional de status. */
  async listCustomerEstimates(
    args: { customerId: number; status?: string; limit?: number },
    tenantId: number,
  ) {
    const where: any = { tenantId, customerId: args.customerId };
    if (args.status) where.status = args.status;

    const limit = Math.min(20, Math.max(1, args.limit || 10));
    const estimates = await (this.prisma as any).estimate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, uuid: true, status: true, totalPrice: true,
        estimateType: true, validUntil: true, createdAt: true,
      },
    });
    return { count: estimates.length, estimates };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 🛒 PEDIDOS
  // ════════════════════════════════════════════════════════════════════════

  /** Aprova orçamento → vira pedido em produção. */
  async convertEstimateToOrder(args: { estimateId: number; deliveryDate?: string }, tenantId: number) {
    try {
      const order = await this.estimatesService.convertToOrder(
        args.estimateId,
        tenantId,
        { deliveryDate: args.deliveryDate ?? null },
      );
      return {
        orderId:      (order as any).id,
        status:       (order as any).status,
        amount:       (order as any).amount,
        deliveryDate: (order as any).deliveryDate,
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async getOrderStatus(args: { orderId: number }, tenantId: number) {
    try {
      const order: any = await this.ordersService.findOne(args.orderId, tenantId);
      if (!order) return { error: `Pedido ${args.orderId} não encontrado.` };
      return {
        id:                 order.id,
        status:             order.status,
        paymentStatus:      order.paymentStatus,
        amount:             order.amount,
        productDescription: order.productDescription,
        deliveryDate:       order.deliveryDate,
        createdAt:          order.createdAt,
      };
    } catch {
      return { error: `Pedido ${args.orderId} não encontrado.` };
    }
  }

  async listCustomerOrders(args: { customerId: number; limit?: number }, tenantId: number) {
    const limit = Math.min(20, Math.max(1, args.limit || 10));
    const orders = await (this.prisma as any).order.findMany({
      where: { tenantId, customerId: args.customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, status: true, paymentStatus: true, amount: true,
        productDescription: true, deliveryDate: true, createdAt: true,
      },
    });
    return { count: orders.length, orders };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 💰 PAGAMENTOS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Gera cobrança. Method='PIX' devolve QR+copia/cola. Method='LINK' devolve
   * URL Mercado Pago (cartão/boleto/PIX numa tela só).
   */
  async generatePayment(args: { orderId: number; method?: 'PIX' | 'LINK' }) {
    const method = args.method || 'PIX';
    return this.paymentsService.createPayment(args.orderId, method);
  }

  /** Confere status atual do pagamento — útil quando cliente diz "já paguei". */
  async checkPaymentStatus(args: { orderId: number }, tenantId: number) {
    try {
      const order: any = await this.ordersService.findOne(args.orderId, tenantId);
      if (!order) return { error: `Pedido ${args.orderId} não encontrado.` };

      // Pega última transação do pedido
      const tx = await (this.prisma as any).transaction.findFirst({
        where: { orderId: args.orderId },
        orderBy: { createdAt: 'desc' },
      });
      if (!tx) return { paymentStatus: order.paymentStatus, message: 'Sem cobrança gerada ainda.' };

      // Tenta atualizar status do gateway
      try { await this.paymentsService.checkPaymentStatus(tx.id); } catch { /* ignore */ }

      const updated = await (this.prisma as any).transaction.findUnique({ where: { id: tx.id } });
      return {
        orderId:       args.orderId,
        paymentStatus: updated?.status ?? order.paymentStatus,
        method:        updated?.method,
        amount:        updated?.amount,
        paidAt:        updated?.paidAt,
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📎 ARQUIVOS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Anexa arte. Polimórfica: target.estimateId OU target.orderId.
   * Cliente normalmente envia arte ANTES de virar pedido (no orçamento).
   */
  async uploadArtwork(
    args: {
      target: { estimateId?: number; orderId?: number };
      base64: string;
      filename: string;
      mimetype: string;
    },
    tenantId: number,
  ) {
    if (!args.target?.estimateId && !args.target?.orderId) {
      return { error: 'Informe estimateId OU orderId em target.' };
    }
    const buffer = Buffer.from(args.base64, 'base64');
    const file = { buffer, originalname: args.filename, mimetype: args.mimetype } as any;

    if (args.target.estimateId) {
      const att = await this.filesService.saveFileForEstimate(args.target.estimateId, file, tenantId);
      return { attachmentId: (att as any).id, target: 'estimate', estimateId: args.target.estimateId };
    }
    const att = await this.filesService.saveFile(args.target.orderId!, file, tenantId);
    return { attachmentId: (att as any).id, target: 'order', orderId: args.target.orderId };
  }

  // ════════════════════════════════════════════════════════════════════════
  // ℹ️ NEGÓCIO
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Dados da gráfica que o agente usa pra responder perguntas comuns.
   *
   * Tudo vem do banco — Settings + Tenant. Defaults aplicam quando o admin
   * não preencheu (paymentMethods tem default no schema, businessHours fica
   * null, deliveryDays default 5).
   */
  async getBusinessInfo(tenantId: number) {
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const tenant   = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, address: true, neighborhood: true, city: true, state: true, zipCode: true, ownerPhone: true, ownerEmail: true },
    });

    const fullAddress = [tenant?.address, tenant?.neighborhood, tenant?.city, tenant?.state, tenant?.zipCode]
      .filter(Boolean)
      .join(', ');

    return {
      name:           tenant?.name,
      address:        fullAddress || null,
      phone:          tenant?.ownerPhone || null,
      email:          tenant?.ownerEmail || null,
      businessHours:  settings?.businessHours || null,
      paymentMethods: settings?.paymentMethods?.length
        ? settings.paymentMethods
        : ['PIX', 'Cartão', 'Boleto', 'Dinheiro'], // fallback se ainda não foi configurado
      deliveryDays:   settings?.defaultDeliveryDays ?? 5,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 🚨 ESCALAÇÃO
  // ════════════════════════════════════════════════════════════════════════

  /** Pede atendimento humano — cria Notification no ERP. */
  async notifyOperator(args: { phone: string; reason: string; summary: string }, tenantId: number) {
    await this.notificationsService.create({
      tenantId,
      type:    'whatsapp_handoff',
      title:   `Atendimento WhatsApp — ${args.phone}`,
      message: `Motivo: ${args.reason}\n\n${args.summary}`,
    } as any);
    this.logger.log(`Operator handoff: tenant=${tenantId} phone=${args.phone} reason=${args.reason}`);
    return { ok: true, message: 'Um atendente foi notificado e vai te responder em breve.' };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 🏢 TOOLS DO MODO ERP — perguntas operacionais do operador
  // ════════════════════════════════════════════════════════════════════════

  /** Lista pedidos com filtros. Use no chat ERP pra "pedidos pendentes hoje". */
  async listOrders(
    args: {
      status?: string;
      paymentStatus?: string;
      customerId?: number;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
    tenantId: number,
  ) {
    const where: any = { tenantId };
    if (args.status)        where.status        = args.status;
    if (args.paymentStatus) where.paymentStatus = args.paymentStatus;
    if (args.customerId)    where.customerId    = args.customerId;
    if (args.dateFrom || args.dateTo) {
      where.createdAt = {};
      if (args.dateFrom) where.createdAt.gte = new Date(`${args.dateFrom}T00:00:00.000Z`);
      if (args.dateTo)   where.createdAt.lte = new Date(`${args.dateTo}T23:59:59.999Z`);
    }
    const limit = Math.min(100, Math.max(1, args.limit || 20));
    const orders = await (this.prisma as any).order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, status: true, paymentStatus: true, amount: true,
        productDescription: true, deliveryDate: true, createdAt: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    const total = orders.reduce((s: number, o: any) => s + (o.amount || 0), 0);
    return { count: orders.length, totalAmount: parseFloat(total.toFixed(2)), orders };
  }

  /** Lista orcamentos com filtros. */
  async listEstimates(
    args: {
      status?: string;
      estimateType?: string;
      customerId?: number;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
    tenantId: number,
  ) {
    const where: any = { tenantId };
    if (args.status)       where.status       = args.status;
    if (args.estimateType) where.estimateType = args.estimateType;
    if (args.customerId)   where.customerId   = args.customerId;
    if (args.dateFrom || args.dateTo) {
      where.createdAt = {};
      if (args.dateFrom) where.createdAt.gte = new Date(`${args.dateFrom}T00:00:00.000Z`);
      if (args.dateTo)   where.createdAt.lte = new Date(`${args.dateTo}T23:59:59.999Z`);
    }
    const limit = Math.min(100, Math.max(1, args.limit || 20));
    const estimates = await (this.prisma as any).estimate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, uuid: true, status: true, totalPrice: true,
        estimateType: true, validUntil: true, createdAt: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    return { count: estimates.length, estimates };
  }

  /** Busca clientes por nome/email/telefone (sem auto-criar). */
  async searchCustomers(args: { query: string; limit?: number }, tenantId: number) {
    const q = (args.query || '').trim();
    if (!q) return { error: 'Query vazia.' };
    const limit = Math.min(50, Math.max(1, args.limit || 15));
    const digits = q.replace(/\D+/g, '');
    const or: any[] = [
      { name:  { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
    if (digits) or.push({ phone: { contains: digits } });

    const customers = await (this.prisma as any).customer.findMany({
      where:   { tenantId, OR: or },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  { id: true, name: true, phone: true, email: true, createdAt: true },
    });
    return { count: customers.length, customers };
  }

  /** Top N clientes por receita num periodo (soma de pedidos). */
  async topCustomers(args: { limit?: number; dateFrom?: string; dateTo?: string }, tenantId: number) {
    const limit = Math.min(50, Math.max(1, args.limit || 10));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFrom = args.dateFrom ? new Date(`${args.dateFrom}T00:00:00.000Z`) : monthStart;
    const dateTo   = args.dateTo   ? new Date(`${args.dateTo}T23:59:59.999Z`)   : now;

    // Agrega via groupBy
    const groups = await (this.prisma as any).order.groupBy({
      by: ['customerId'],
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _sum:   { amount: true },
      _count: { _all:   true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    // Resolve nomes
    const ids = groups.map((g: any) => g.customerId).filter(Boolean);
    const customers = await (this.prisma as any).customer.findMany({
      where:  { id: { in: ids } },
      select: { id: true, name: true, phone: true },
    });
    const byId = new Map<number, any>(customers.map((c: any) => [c.id, c]));

    const top = groups.map((g: any) => ({
      customerId:  g.customerId,
      name:        byId.get(g.customerId)?.name  || `Cliente ${g.customerId}`,
      phone:       byId.get(g.customerId)?.phone || null,
      orderCount:  g._count._all,
      totalAmount: parseFloat((g._sum.amount || 0).toFixed(2)),
    }));
    return {
      period: { from: dateFrom.toISOString().slice(0, 10), to: dateTo.toISOString().slice(0, 10) },
      top,
    };
  }

  /** Resumo financeiro: receita (Invoice paid + Order paid) vs despesas (Bill paid + Expense). */
  async financialSummary(args: { dateFrom?: string; dateTo?: string }, tenantId: number) {
    const now = new Date();
    const defaultFrom = new Date(now); defaultFrom.setDate(now.getDate() - 30);
    const dateFrom = args.dateFrom ? new Date(`${args.dateFrom}T00:00:00.000Z`) : defaultFrom;
    const dateTo   = args.dateTo   ? new Date(`${args.dateTo}T23:59:59.999Z`)   : now;

    // Receita: Invoice (recebiveis) PAID + Transaction PAID — usa o que existir
    const [invoicesPaid, expenses, billsPaid] = await Promise.all([
      (this.prisma as any).invoice.aggregate({
        where: { tenantId, status: 'PAID', paidAt: { gte: dateFrom, lte: dateTo } },
        _sum:  { amount: true },
        _count: { _all: true },
      }),
      (this.prisma as any).expense.aggregate({
        where: { tenantId, date: { gte: dateFrom, lte: dateTo } },
        _sum:  { amount: true },
        _count: { _all: true },
      }),
      (this.prisma as any).bill.aggregate({
        where: { tenantId, status: 'PAID', paidAt: { gte: dateFrom, lte: dateTo } },
        _sum:  { amount: true },
        _count: { _all: true },
      }),
    ]);

    const revenue   = parseFloat((invoicesPaid._sum.amount || 0).toFixed(2));
    const expensesT = parseFloat(((expenses._sum.amount || 0) + (billsPaid._sum.amount || 0)).toFixed(2));
    const balance   = parseFloat((revenue - expensesT).toFixed(2));

    return {
      period: { from: dateFrom.toISOString().slice(0, 10), to: dateTo.toISOString().slice(0, 10) },
      revenue:  { total: revenue,   count: invoicesPaid._count._all },
      expenses: { total: expensesT, count: expenses._count._all + billsPaid._count._all,
                  breakdown: {
                    expenses: parseFloat((expenses._sum.amount || 0).toFixed(2)),
                    bills:    parseFloat((billsPaid._sum.amount || 0).toFixed(2)),
                  } },
      balance,
    };
  }

  /** Contas vencidas — recebiveis (Invoice) e pagaveis (Bill). */
  async overduePayments(args: { kind?: 'receivables' | 'payables' | 'both'; limit?: number }, tenantId: number) {
    const kind  = args.kind || 'both';
    const limit = Math.min(100, Math.max(1, args.limit || 20));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: any = {};
    if (kind === 'receivables' || kind === 'both') {
      result.receivables = await (this.prisma as any).invoice.findMany({
        where: {
          tenantId,
          paidAt: null,
          dueDate: { lt: today },
          status: { not: 'CANCELLED' },
        },
        orderBy: { dueDate: 'asc' },
        take: limit,
        select: {
          id: true, description: true, amount: true, dueDate: true, status: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      });
      result.totalReceivables = parseFloat(
        result.receivables.reduce((s: number, r: any) => s + (r.amount || 0), 0).toFixed(2),
      );
    }
    if (kind === 'payables' || kind === 'both') {
      result.payables = await (this.prisma as any).bill.findMany({
        where: {
          tenantId,
          paidAt: null,
          dueDate: { lt: today },
          status: { not: 'CANCELLED' },
        },
        orderBy: { dueDate: 'asc' },
        take: limit,
        select: {
          id: true, description: true, amount: true, dueDate: true, status: true,
          supplier: { select: { id: true, name: true } },
        },
      });
      result.totalPayables = parseFloat(
        result.payables.reduce((s: number, b: any) => s + (b.amount || 0), 0).toFixed(2),
      );
    }
    return result;
  }

  /** Produtos com estoque <= minStock (ou <= threshold customizado). */
  async lowStockProducts(args: { threshold?: number; limit?: number }, tenantId: number) {
    const limit = Math.min(100, Math.max(1, args.limit || 30));
    // Pega tudo e filtra em memoria — $expr/raw seria mais eficiente, mas
    // o catalogo costuma ser pequeno (<1000 produtos por tenant).
    const all = await (this.prisma as any).product.findMany({
      where:  { tenantId },
      select: {
        id: true, name: true, unit: true, stock: true, minStock: true,
        productType: { select: { id: true, name: true } },
      },
    });
    const t = args.threshold;
    const filtered = all.filter((p: any) => {
      if (t != null) return (p.stock ?? 0) <= t;
      return (p.minStock ?? 0) > 0 && (p.stock ?? 0) <= p.minStock;
    });
    filtered.sort((a: any, b: any) => (a.stock - b.stock) || a.name.localeCompare(b.name));
    return { count: filtered.length, products: filtered.slice(0, limit) };
  }

  /** KPIs operacionais do dia/mes — visao instantanea pro chat ERP. */
  async dashboardKpis(tenantId: number) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      ordersToday, ordersInProduction, ordersPending,
      estimatesPending, revenueMonth, overdueCount,
    ] = await Promise.all([
      (this.prisma as any).order.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
      (this.prisma as any).order.count({ where: { tenantId, status: 'PRODUCTION' } }),
      (this.prisma as any).order.count({ where: { tenantId, status: 'PENDING' } }),
      (this.prisma as any).estimate.count({ where: { tenantId, status: { in: ['DRAFT', 'SENT'] } } }),
      (this.prisma as any).invoice.aggregate({
        where: { tenantId, status: 'PAID', paidAt: { gte: monthStart } },
        _sum:  { amount: true },
      }),
      (this.prisma as any).invoice.count({
        where: { tenantId, paidAt: null, dueDate: { lt: todayStart }, status: { not: 'CANCELLED' } },
      }),
    ]);

    return {
      today: { ordersCreated: ordersToday },
      production: { inProduction: ordersInProduction, pending: ordersPending },
      estimates:  { pending: estimatesPending },
      finance: {
        revenueThisMonth: parseFloat((revenueMonth._sum.amount || 0).toFixed(2)),
        overdueReceivables: overdueCount,
      },
      generatedAt: now.toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 🔧 TOOLS EXECUTORAS — mudam estado no ERP
  // Cada uma reusa o service correspondente pra herdar validações e regras
  // de negócio que já existem (audit log, eventos WS, etc).
  // ════════════════════════════════════════════════════════════════════════

  /** Avança/muda status de produção de um pedido. userId vai pro audit log. */
  async updateOrderStatus(args: { orderId: number; status: string }, tenantId: number, userId?: number | null) {
    const valid = ['PENDING', 'PRODUCTION', 'FINISHED', 'DELIVERED'];
    if (!valid.includes(args.status)) {
      return { error: `Status inválido. Use: ${valid.join(', ')}.` };
    }
    try {
      const updated: any = await this.ordersService.update(
        args.orderId,
        { status: args.status } as any,
        tenantId,
        userId,
      );
      return {
        ok:        true,
        orderId:   updated.id,
        status:    updated.status,
        message:   `Pedido #${updated.id} atualizado para ${updated.status}.`,
      };
    } catch (e: any) {
      return { error: e.message || `Falha ao atualizar pedido ${args.orderId}.` };
    }
  }

  /** Marca recebível (Invoice) como pago. */
  async markReceivablePaid(
    args: { receivableId: number; paidAmount: number; paidAt?: string },
    tenantId: number,
  ) {
    try {
      const result: any = await this.receivablesService.markAsPaid(
        args.receivableId,
        { paidAmount: args.paidAmount, paidAt: args.paidAt } as any,
        tenantId,
      );
      return {
        ok:           true,
        receivableId: result.id,
        status:       result.status,
        paidAmount:   result.paidAmount,
        paidAt:       result.paidAt,
        message:      `Recebível #${result.id} marcado como pago (R$ ${args.paidAmount.toFixed(2)}).`,
      };
    } catch (e: any) {
      return { error: e.message || `Falha ao marcar recebível ${args.receivableId} como pago.` };
    }
  }

  /** Marca pagável (Bill) como pago. */
  async markPayablePaid(
    args: { payableId: number; paidAmount: number; paidAt?: string },
    tenantId: number,
  ) {
    try {
      const result: any = await this.payablesService.markAsPaid(
        args.payableId,
        { paidAmount: args.paidAmount, paidAt: args.paidAt } as any,
        tenantId,
      );
      return {
        ok:         true,
        payableId:  result.id,
        status:     result.status,
        paidAmount: result.paidAmount,
        paidAt:     result.paidAt,
        message:    `Conta #${result.id} marcada como paga (R$ ${args.paidAmount.toFixed(2)}).`,
      };
    } catch (e: any) {
      return { error: e.message || `Falha ao marcar conta ${args.payableId} como paga.` };
    }
  }

  /**
   * Cria cliente novo. Diferente de findOrCreateCustomer (esse é do fluxo
   * WhatsApp, busca por phone). Aqui o operador está cadastrando pelo nome.
   */
  async createCustomer(
    args: { name: string; phone?: string; email?: string; cpfCnpj?: string; address?: string; notes?: string },
    tenantId: number,
  ) {
    if (!args.name?.trim()) return { error: 'Nome obrigatório.' };
    try {
      const phone = args.phone ? String(args.phone).replace(/\D+/g, '') : undefined;
      const customer: any = await this.customersService.create(
        {
          name:    args.name.trim(),
          phone:   phone || undefined,
          email:   args.email || undefined,
          cpfCnpj: args.cpfCnpj || undefined,
          address: args.address || undefined,
          notes:   args.notes || undefined,
        } as any,
        tenantId,
      );
      return {
        ok:         true,
        customerId: customer.id,
        name:       customer.name,
        phone:      customer.phone,
        message:    `Cliente "${customer.name}" criado com ID ${customer.id}.`,
      };
    } catch (e: any) {
      return { error: e.message || 'Falha ao criar cliente.' };
    }
  }

  /** Lança uma despesa (sai do caixa). */
  async addExpense(
    args: { description: string; amount: number; category: string; date?: string; supplierId?: number },
    tenantId: number,
  ) {
    if (!args.description?.trim()) return { error: 'Descrição obrigatória.' };
    if (!(args.amount > 0)) return { error: 'Valor deve ser maior que zero.' };
    if (!args.category?.trim()) return { error: 'Categoria obrigatória.' };
    try {
      const expense: any = await this.expensesService.create(
        {
          description: args.description.trim(),
          amount:      args.amount,
          category:    args.category.trim(),
          date:        args.date,
          supplierId:  args.supplierId,
        } as any,
        tenantId,
      );
      return {
        ok:        true,
        expenseId: expense.id,
        amount:    expense.amount,
        category:  expense.category,
        message:   `Despesa "${expense.description}" registrada (R$ ${expense.amount.toFixed(2)}).`,
      };
    } catch (e: any) {
      return { error: e.message || 'Falha ao lançar despesa.' };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📨 COMUNICAÇÃO — disparar WhatsApp/email no mundo real via chat
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Envia WhatsApp via Evolution API. Usa as credenciais já configuradas
   * no AiConfig (mesmas usadas pelo agente do canal WhatsApp).
   *
   * Auto-normaliza o telefone pro formato internacional que a Evolution exige:
   *   - 10 dígitos (DDD + fixo 8 dígitos)     → prefixa 55
   *   - 11 dígitos (DDD + celular 9 dígitos)  → prefixa 55
   *   - 12-13 dígitos (já tem código país)    → usa como está
   *   - Outros formatos                        → tenta como está, deixa Evolution validar
   */
  async sendWhatsappMessage(args: { phone: string; message: string }, tenantId: number) {
    const raw = String(args.phone || '').replace(/\D+/g, '');
    if (!raw) return { error: 'Telefone obrigatório.' };
    if (!args.message?.trim()) return { error: 'Mensagem vazia.' };

    const phone = this.normalizeBrazilianPhone(raw);

    const cfg = await this.getAiConfig(tenantId);
    if (!cfg?.evolutionUrl || !cfg?.evolutionKey || !cfg?.evolutionInstance) {
      return { error: 'WhatsApp (Evolution) não configurado. Vá em IA → WhatsApp.' };
    }

    try {
      const url = `${cfg.evolutionUrl.replace(/\/$/, '')}/message/sendText/${cfg.evolutionInstance}`;
      const r = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.evolutionKey },
        body: JSON.stringify({
          number:      phone,
          text:        args.message.trim(),
          delay:       1200,
          linkPreview: false,
        }),
      });
      if (!r.ok) {
        const err = await r.text().catch(() => '');
        return { error: `Evolution rejeitou (${r.status}): ${err.slice(0, 200)}` };
      }
      return { ok: true, phone, message: `WhatsApp enviado pra ${phone}.` };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao enviar WhatsApp.' };
    }
  }

  /**
   * Normaliza telefone brasileiro pro formato esperado pela Evolution API
   * (E.164 sem o "+"). Heurística pelo tamanho:
   *   10 ou 11 dígitos → DDD + número (sem país) → prefixa 55
   *   12 ou 13 dígitos → já tem 55 ou outro DDI → usa como está
   *   outros tamanhos  → tenta como está (pode ser número internacional não-BR)
   */
  private normalizeBrazilianPhone(digits: string): string {
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  }

  /** Envia email via SMTP do tenant (Settings.smtp*). */
  async sendEmailTool(args: { to: string; subject: string; body: string }, tenantId: number) {
    if (!args.to?.trim()) return { error: 'Destinatário obrigatório.' };
    if (!args.subject?.trim()) return { error: 'Assunto obrigatório.' };
    if (!args.body?.trim()) return { error: 'Corpo do email vazio.' };

    try {
      const ok = await this.messagingService.sendEmail(
        args.to.trim(), args.subject.trim(), args.body, tenantId,
      );
      if (!ok) return { error: 'SMTP não configurado ou falha no envio. Verifique Configurações.' };
      return { ok: true, to: args.to, message: `Email enviado pra ${args.to}.` };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao enviar email.' };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📄 PDFs — devolvem URL pública pra IA mandar pro user
  // ════════════════════════════════════════════════════════════════════════

  /** Reusa send_estimate_link — gera URL pública de aprovação do orçamento. */
  async generateEstimatePdf(args: { estimateId: number }, tenantId: number) {
    return this.sendEstimateLink(args, tenantId);
  }

  /**
   * Devolve URL pra baixar PDF do recibo (frontend chama /api/orders/:id/receipt).
   * O download exige JWT, então usa querystring `?token=` (padrão do projeto).
   */
  async generateOrderReceiptPdf(args: { orderId: number }, tenantId: number) {
    try {
      const order: any = await this.ordersService.findOne(args.orderId, tenantId);
      if (!order) return { error: `Pedido ${args.orderId} não encontrado.` };
      const apiUrl = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
      // O operador no chat ERP já está logado — frontend resolve o token na hora.
      // Aqui devolvemos a URL canônica; quem renderiza injeta o token.
      const url = `${apiUrl}/api/orders/${args.orderId}/receipt`;
      return {
        ok:        true,
        orderId:   args.orderId,
        url,
        hint:      'Abra essa URL com o JWT (?token=...) ou clique no link gerado pelo widget.',
      };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao gerar URL do recibo.' };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 💸 FINANCEIRO — criar receivables/payables
  // ════════════════════════════════════════════════════════════════════════

  async addReceivable(
    args: { customerId: number; description: string; amount: number; dueDate: string; orderId?: number; notes?: string },
    tenantId: number,
  ) {
    if (!args.customerId) return { error: 'customerId obrigatório.' };
    if (!args.description?.trim()) return { error: 'Descrição obrigatória.' };
    if (!(args.amount > 0)) return { error: 'Valor deve ser maior que zero.' };
    if (!args.dueDate) return { error: 'dueDate (YYYY-MM-DD) obrigatório.' };

    try {
      const inv: any = await this.receivablesService.create(
        {
          customerId:  args.customerId,
          description: args.description.trim(),
          amount:      args.amount,
          dueDate:     args.dueDate,
          orderId:     args.orderId,
          notes:       args.notes,
        } as any,
        tenantId,
      );
      return {
        ok:           true,
        receivableId: inv.id,
        amount:       inv.amount,
        dueDate:      inv.dueDate,
        message:      `Recebível #${inv.id} criado (R$ ${inv.amount.toFixed(2)} venc. ${args.dueDate}).`,
      };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao criar recebível.' };
    }
  }

  async addPayable(
    args: { description: string; amount: number; dueDate: string; supplierId?: number; notes?: string },
    tenantId: number,
  ) {
    if (!args.description?.trim()) return { error: 'Descrição obrigatória.' };
    if (!(args.amount > 0)) return { error: 'Valor deve ser maior que zero.' };
    if (!args.dueDate) return { error: 'dueDate (YYYY-MM-DD) obrigatório.' };

    try {
      const bill: any = await this.payablesService.create(
        {
          description: args.description.trim(),
          amount:      args.amount,
          dueDate:     args.dueDate,
          supplierId:  args.supplierId,
          notes:       args.notes,
        } as any,
        tenantId,
      );
      return {
        ok:        true,
        payableId: bill.id,
        amount:    bill.amount,
        dueDate:   bill.dueDate,
        message:   `Conta a pagar #${bill.id} criada (R$ ${bill.amount.toFixed(2)} venc. ${args.dueDate}).`,
      };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao criar conta a pagar.' };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📦 ESTOQUE — entrada/saída/ajuste
  // ════════════════════════════════════════════════════════════════════════

  async stockMovement(
    args: { productId: number; quantity: number; type?: 'PURCHASE' | 'SALE' | 'ADJUSTMENT'; reason?: string },
    tenantId: number,
  ) {
    const type = args.type || 'ADJUSTMENT';
    if (!args.productId) return { error: 'productId obrigatório.' };
    if (typeof args.quantity !== 'number' || args.quantity === 0) {
      return { error: 'quantity deve ser número diferente de zero.' };
    }
    try {
      // updateStock aplica ao stock atual; sinal define o lado.
      // PURCHASE/SALE espelham o convencional (entrada positiva, saída negativa
      // — mas aceita números negativos pra inverter).
      const product: any = await (this.prisma as any).product.findFirst({
        where: { id: args.productId, tenantId },
      });
      if (!product) return { error: `Produto ${args.productId} não encontrado.` };
      const updated = await this.productsService.updateStock(
        args.productId,
        args.quantity,
        type,
        tenantId,
        args.reason,
      );
      return {
        ok:        true,
        productId: args.productId,
        productName: product.name,
        delta:     args.quantity,
        type,
        newStock:  (updated as any)?.stock,
        message:   `Movimentação ${type} de ${args.quantity} ${product.unit} em "${product.name}". Estoque atual: ${(updated as any)?.stock}.`,
      };
    } catch (e: any) {
      return { error: e?.message || 'Falha na movimentação.' };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📅 AGENDA / SCHEDULE
  // ════════════════════════════════════════════════════════════════════════

  async getSchedule(
    args: { range?: 'today' | 'tomorrow' | 'week' | 'overdue' | 'custom'; dateFrom?: string; dateTo?: string; limit?: number },
    tenantId: number,
  ) {
    const range = args.range || 'today';
    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const endOfDay   = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

    let from: Date, to: Date;
    switch (range) {
      case 'today':
        from = startOfDay(now); to = endOfDay(now); break;
      case 'tomorrow': {
        const t = new Date(now); t.setDate(t.getDate() + 1);
        from = startOfDay(t); to = endOfDay(t); break;
      }
      case 'week': {
        from = startOfDay(now);
        const end = new Date(now); end.setDate(end.getDate() + 7);
        to = endOfDay(end); break;
      }
      case 'overdue': {
        // Atrasados: deliveryDate < hoje E status != DELIVERED
        from = new Date(2000, 0, 1);
        to = startOfDay(now);
        break;
      }
      case 'custom':
      default:
        from = args.dateFrom ? new Date(`${args.dateFrom}T00:00:00.000Z`) : startOfDay(now);
        to   = args.dateTo   ? new Date(`${args.dateTo}T23:59:59.999Z`)   : endOfDay(now);
    }

    const where: any = { tenantId, deliveryDate: { gte: from, lte: to } };
    if (range === 'overdue') where.status = { notIn: ['DELIVERED', 'COMPLETED'] };

    const orders = await (this.prisma as any).order.findMany({
      where,
      orderBy: { deliveryDate: 'asc' },
      take: Math.min(100, Math.max(1, args.limit || 30)),
      select: {
        id: true, status: true, paymentStatus: true, amount: true,
        productDescription: true, deliveryDate: true, createdAt: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    return {
      range,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      count:  orders.length,
      orders,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📋 LISTAGENS adicionais
  // ════════════════════════════════════════════════════════════════════════

  async listProducts(
    args: { query?: string; typeId?: number; supplierId?: number; withStock?: boolean; limit?: number },
    tenantId: number,
  ) {
    const limit = Math.min(100, Math.max(1, args.limit || 30));
    const where: any = { tenantId };
    if (args.typeId)     where.typeId     = args.typeId;
    if (args.supplierId) where.supplierId = args.supplierId;
    if (args.withStock)  where.stock      = { gt: 0 };
    if (args.query) {
      where.name = { contains: args.query, mode: 'insensitive' };
    }
    const products = await (this.prisma as any).product.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        id: true, name: true, unit: true, unitPrice: true,
        stock: true, minStock: true, brand: true, description: true,
        productType: { select: { id: true, name: true } },
        supplier:    { select: { id: true, name: true } },
      },
    });
    return { count: products.length, products };
  }

  async listSuppliers(args: { query?: string; limit?: number }, tenantId: number) {
    const limit = Math.min(100, Math.max(1, args.limit || 30));
    const where: any = { tenantId };
    if (args.query?.trim()) {
      where.name = { contains: args.query.trim(), mode: 'insensitive' };
    }
    const suppliers = await (this.prisma as any).supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        id: true, name: true, phone: true, email: true,
        category: true, address: true, createdAt: true,
      },
    });
    return { count: suppliers.length, suppliers };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 🆕 CADASTROS — fornecedor e produto
  // ════════════════════════════════════════════════════════════════════════

  async createSupplier(
    args: { name: string; phone?: string; email?: string; category?: string; address?: string },
    tenantId: number,
  ) {
    if (!args.name?.trim()) return { error: 'Nome obrigatório.' };
    try {
      const sup: any = await this.suppliersService.create(
        {
          name:     args.name.trim(),
          phone:    args.phone || undefined,
          email:    args.email || undefined,
          category: args.category || undefined,
          address:  args.address || undefined,
        } as any,
        tenantId,
      );
      return {
        ok:         true,
        supplierId: sup.id,
        name:       sup.name,
        message:    `Fornecedor "${sup.name}" criado com ID ${sup.id}.`,
      };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao criar fornecedor.' };
    }
  }

  async createProduct(
    args: {
      name: string; typeId: number; unitPrice: number;
      unit?: string; stock?: number; minStock?: number;
      description?: string; supplierId?: number; brand?: string;
    },
    tenantId: number,
  ) {
    if (!args.name?.trim()) return { error: 'Nome obrigatório.' };
    if (!args.typeId)       return { error: 'typeId (categoria) obrigatório. Use search/listagem antes.' };
    if (!(args.unitPrice >= 0)) return { error: 'unitPrice deve ser >= 0.' };
    try {
      const p: any = await this.productsService.create(
        {
          name:        args.name.trim(),
          typeId:      args.typeId,
          unitPrice:   args.unitPrice,
          unit:        args.unit       || 'un',
          stock:       args.stock      ?? 0,
          minStock:    args.minStock   ?? 0,
          description: args.description,
          supplierId:  args.supplierId,
          brand:       args.brand,
        } as any,
        tenantId,
      );
      return {
        ok:        true,
        productId: p.id,
        name:      p.name,
        unitPrice: p.unitPrice,
        message:   `Produto "${p.name}" criado (R$ ${p.unitPrice.toFixed(2)}/${p.unit}).`,
      };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao criar produto.' };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 🔗 TOOLS COMBINADAS — fluxos comuns em 1 chamada
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Gera URL pública do orçamento + manda WhatsApp pro cliente em 1 turno.
   * Pega telefone do customer do orçamento se phone não vier.
   */
  async sendEstimateViaWhatsapp(
    args: { estimateId: number; phone?: string; message?: string },
    tenantId: number,
  ) {
    const estimate: any = await (this.prisma as any).estimate.findFirst({
      where:   { id: args.estimateId, tenantId },
      include: { customer: true },
    });
    if (!estimate) return { error: `Orçamento ${args.estimateId} não encontrado.` };

    const phone = args.phone?.replace(/\D+/g, '') || estimate.customer?.phone?.replace(/\D+/g, '');
    if (!phone) return { error: 'Cliente do orçamento não tem telefone cadastrado e nenhum phone foi passado.' };

    const linkResult: any = await this.sendEstimateLink({ estimateId: args.estimateId }, tenantId);
    if (linkResult?.error) return linkResult;

    const customer = estimate.customer?.name || 'cliente';
    const defaultMsg = `Olá ${customer}! Segue o orçamento solicitado: ${linkResult.url}\n\nQualquer dúvida, é só responder por aqui.`;
    const message = args.message
      ? `${args.message}\n\n${linkResult.url}`
      : defaultMsg;

    const sendResult: any = await this.sendWhatsappMessage({ phone, message }, tenantId);
    if (sendResult?.error) return sendResult;

    return {
      ok:         true,
      estimateId: args.estimateId,
      url:        linkResult.url,
      phone,
      message:    `Orçamento #${args.estimateId} enviado pra ${phone} via WhatsApp.`,
    };
  }

  /** Combina generate_estimate_pdf + send_email. */
  async sendEstimateViaEmail(
    args: { estimateId: number; to?: string; subject?: string; message?: string },
    tenantId: number,
  ) {
    const estimate: any = await (this.prisma as any).estimate.findFirst({
      where:   { id: args.estimateId, tenantId },
      include: { customer: true },
    });
    if (!estimate) return { error: `Orçamento ${args.estimateId} não encontrado.` };

    const to = args.to || estimate.customer?.email;
    if (!to) return { error: 'Cliente do orçamento não tem email cadastrado e nenhum to foi passado.' };

    const linkResult: any = await this.sendEstimateLink({ estimateId: args.estimateId }, tenantId);
    if (linkResult?.error) return linkResult;

    const tenant: any = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId }, select: { name: true },
    });
    const businessName = tenant?.name || 'GestorPrint';
    const customer = estimate.customer?.name || 'cliente';
    const subject = args.subject || `Orçamento — ${businessName}`;
    const intro = args.message ? `<p>${args.message}</p>` : '';
    const body = `
      <p>Olá ${customer},</p>
      ${intro}
      <p>Segue o orçamento que você solicitou:</p>
      <p><a href="${linkResult.url}" style="display:inline-block;padding:12px 24px;background:#1D9E75;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Ver orçamento</a></p>
      <p>Ou copie o link: ${linkResult.url}</p>
      <p>Qualquer dúvida, é só responder este email.</p>
      <p>— ${businessName}</p>
    `;

    const sendResult: any = await this.sendEmailTool({ to, subject, body }, tenantId);
    if (sendResult?.error) return sendResult;

    return {
      ok:         true,
      estimateId: args.estimateId,
      url:        linkResult.url,
      to,
      message:    `Orçamento #${args.estimateId} enviado pra ${to} por email.`,
    };
  }

  /** Gera cobrança PIX/link e manda pro cliente via WhatsApp ou email. */
  async sendPaymentLink(
    args: { orderId: number; channel?: 'whatsapp' | 'email'; method?: 'PIX' | 'LINK' },
    tenantId: number,
  ) {
    const channel = args.channel || 'whatsapp';
    const order: any = await (this.prisma as any).order.findFirst({
      where:   { id: args.orderId, tenantId },
      include: { customer: true },
    });
    if (!order) return { error: `Pedido ${args.orderId} não encontrado.` };

    const payment: any = await this.generatePayment({ orderId: args.orderId, method: args.method });
    if (payment?.error) return payment;

    // Extrai URL/PIX da resposta — formato varia por método/gateway
    const linkText = payment.paymentUrl || payment.qrCode || payment.url || JSON.stringify(payment).slice(0, 200);

    if (channel === 'whatsapp') {
      const phone = order.customer?.phone?.replace(/\D+/g, '');
      if (!phone) return { error: 'Cliente sem telefone cadastrado.' };
      const customer = order.customer?.name || 'cliente';
      const value = (order.amount || 0).toFixed(2).replace('.', ',');
      const text = `Olá ${customer}! Cobrança do pedido #${order.id} (R$ ${value}):\n\n${linkText}`;
      const r: any = await this.sendWhatsappMessage({ phone, message: text }, tenantId);
      if (r?.error) return r;
      return { ok: true, channel, orderId: order.id, message: `Cobrança enviada pra ${phone} via WhatsApp.` };
    } else {
      const to = order.customer?.email;
      if (!to) return { error: 'Cliente sem email cadastrado.' };
      const customer = order.customer?.name || 'cliente';
      const value = (order.amount || 0).toFixed(2).replace('.', ',');
      const subject = `Cobrança — Pedido #${order.id}`;
      const body = `<p>Olá ${customer},</p>
        <p>Segue a cobrança do pedido <strong>#${order.id}</strong> no valor de <strong>R$ ${value}</strong>:</p>
        <p>${linkText}</p>
        <p>Após o pagamento, atualizaremos o status do pedido automaticamente.</p>`;
      const r: any = await this.sendEmailTool({ to, subject, body }, tenantId);
      if (r?.error) return r;
      return { ok: true, channel, orderId: order.id, message: `Cobrança enviada pra ${to} por email.` };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 🧠 MEMÓRIA do operador — persiste preferências entre sessões
  // ════════════════════════════════════════════════════════════════════════

  /** Lê a memória atual do user (string livre — markdown editável). */
  async getUserMemory(tenantId: number, userId: number): Promise<string> {
    if (!userId) return '';
    try {
      const m: any = await (this.prisma as any).aiUserMemory.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      });
      return m?.content || '';
    } catch (e: any) {
      this.logger.warn(`getUserMemory falhou: ${e.message}`);
      return '';
    }
  }

  /** Setter total — usado pela UI (admin edita a mão). */
  async setUserMemory(tenantId: number, userId: number, content: string) {
    return (this.prisma as any).aiUserMemory.upsert({
      where:  { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, content },
      update: { content },
    });
  }

  /**
   * Tool — appenda uma nova preferência (1 bullet) à memória atual.
   * Reusada quando o user diz "lembra que..." e a IA decide salvar.
   */
  async rememberPreference(args: { note: string }, tenantId: number, userId?: number | null) {
    if (!userId) return { error: 'Sessão sem userId — não dá pra salvar memória.' };
    const note = args.note?.trim();
    if (!note) return { error: 'note vazia.' };

    const current = await this.getUserMemory(tenantId, userId);
    // Evita duplicar — se já tem essa nota literal, ignora
    const lines = current.split('\n').map(l => l.trim());
    const newBullet = `- ${note}`;
    if (lines.includes(newBullet)) {
      return { ok: true, message: 'Já estava anotado.', memorySize: lines.length };
    }
    const updated = current ? `${current}\n${newBullet}` : newBullet;
    await this.setUserMemory(tenantId, userId, updated);
    return {
      ok: true,
      message: `Anotado: "${note}". Vou lembrar disso nas próximas conversas.`,
      memorySize: lines.length + 1,
    };
  }

  /** Tool — remove qualquer linha da memória que contenha o `match`. */
  async forgetPreference(args: { match: string }, tenantId: number, userId?: number | null) {
    if (!userId) return { error: 'Sessão sem userId.' };
    const match = args.match?.trim().toLowerCase();
    if (!match) return { error: 'match vazio.' };

    const current = await this.getUserMemory(tenantId, userId);
    const lines = current.split('\n');
    const kept = lines.filter(l => !l.toLowerCase().includes(match));
    if (kept.length === lines.length) {
      return { ok: true, message: 'Nada na memória bate com isso.', removed: 0 };
    }
    await this.setUserMemory(tenantId, userId, kept.join('\n'));
    return {
      ok: true,
      message: `Esqueci ${lines.length - kept.length} entrada(s) que continham "${args.match}".`,
      removed: lines.length - kept.length,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // ⚙️ AiConfig (CRUD da UI) — credenciais encriptadas em repouso
  // ════════════════════════════════════════════════════════════════════════

  async getAiConfig(tenantId = 1): Promise<any> {
    const cfg = await (this.prisma as any).aiConfig.findUnique({ where: { tenantId } });
    if (!cfg) return cfg;
    const decrypted = this.decryptCredentials(cfg);
    // Injeta variáveis no agentPrompt antes de devolver — ambos os agentes
    // (WhatsApp + ChatERP) recebem o prompt já expandido.
    if (decrypted.agentPrompt) {
      decrypted.agentPrompt = await this.expandPromptVariables(decrypted.agentPrompt, tenantId);
    }
    return decrypted;
  }

  /**
   * Substitui variáveis tipo {{businessName}}, {{address}}, {{paymentMethods}}
   * no agentPrompt usando dados de Tenant + Settings. Permite que o admin
   * escreva um prompt curto e a IA receba contexto completo da gráfica sem
   * precisar duplicar dados.
   *
   * Variáveis disponíveis (deixe documentadas no AiView pro user saber):
   *   {{businessName}}    — nome do tenant
   *   {{address}}         — endereço completo
   *   {{phone}}           — telefone do dono
   *   {{email}}           — email do dono
   *   {{businessHours}}   — horário (Settings.businessHours)
   *   {{paymentMethods}}  — formas de pagamento aceitas
   *   {{deliveryDays}}    — prazo padrão de entrega
   */
  private async expandPromptVariables(prompt: string, tenantId: number): Promise<string> {
    if (!prompt.includes('{{')) return prompt; // fast path

    const info = await this.getBusinessInfo(tenantId);
    const vars: Record<string, string> = {
      businessName:    info.name || '',
      address:         info.address || '',
      phone:           info.phone || '',
      email:           info.email || '',
      businessHours:   info.businessHours || '',
      paymentMethods:  (info.paymentMethods || []).join(', '),
      deliveryDays:    String(info.deliveryDays || ''),
    };
    return prompt.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? `{{${key}}}`);
  }

  async getTenantByEvolutionInstance(instance: string): Promise<{ tenantId: number; tenantName: string } | null> {
    if (!instance) return null;
    const cfg = await (this.prisma as any).aiConfig.findFirst({
      where:  { evolutionInstance: instance },
      select: { tenantId: true, tenant: { select: { name: true } } },
    });
    if (!cfg) return null;
    return { tenantId: cfg.tenantId, tenantName: cfg.tenant?.name || '' };
  }

  async updateAiConfig(data: any, tenantId = 1) {
    const encrypted = this.encryptCredentials(data);
    const saved = await (this.prisma as any).aiConfig.upsert({
      where:  { tenantId },
      update: encrypted,
      create: { tenantId, ...encrypted },
    });
    return this.decryptCredentials(saved);
  }

  private encryptCredentials<T extends Record<string, any>>(data: T): T {
    const out: any = { ...data };
    for (const f of this.ENCRYPTED_FIELDS) {
      if (f in out) out[f] = this.cryptor.encrypt(out[f]);
    }
    return out;
  }

  private decryptCredentials<T extends Record<string, any>>(data: T): T {
    const out: any = { ...data };
    for (const f of this.ENCRYPTED_FIELDS) {
      if (f in out) out[f] = this.cryptor.decrypt(out[f]);
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 📡 Evolution API (proxy de instância — usado pela UI)
  // ════════════════════════════════════════════════════════════════════════

  private async evolutionFetch(
    tenantId: number,
    path: string,
    init?: RequestInit,
  ): Promise<{ ok: boolean; status: number; data: any }> {
    const cfg = await this.getAiConfig(tenantId);
    const baseUrl  = (cfg?.evolutionUrl || '').replace(/\/$/, '');
    const apiKey   = cfg?.evolutionKey || '';
    const instance = cfg?.evolutionInstance || '';

    if (!baseUrl || !apiKey || !instance) {
      return { ok: false, status: 400, data: { error: 'Configure URL, API Key e instancia antes de conectar.' } };
    }

    try {
      const url = `${baseUrl}${path.replace('{instance}', encodeURIComponent(instance))}`;
      const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', apikey: apiKey, ...(init?.headers as any) },
      });
      const text = await res.text();
      let data: any;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      return { ok: res.ok, status: res.status, data };
    } catch (e: any) {
      return { ok: false, status: 0, data: { error: e.message || 'Falha de conexao com Evolution.' } };
    }
  }

  async getEvolutionStatus(tenantId: number) {
    const cfg = await this.getAiConfig(tenantId);
    if (!cfg?.evolutionUrl || !cfg?.evolutionKey || !cfg?.evolutionInstance) {
      return { state: 'unconfigured', configured: false };
    }
    const res = await this.evolutionFetch(tenantId, `/instance/connectionState/{instance}`);
    if (!res.ok) {
      if (res.status === 404) return { state: 'not_created', configured: true };
      return { state: 'error', configured: true, error: res.data?.error || res.data?.message };
    }
    const rawState = res.data?.instance?.state ?? res.data?.state ?? res.data?.connectionStatus ?? 'unknown';
    return { state: rawState, configured: true };
  }

  /**
   * URL padrão do webhook quando o cliente não setou uma custom — usa o
   * API_URL do .env. Em dev, o admin pode editar pra apontar pra ngrok/etc.
   */
  private defaultWebhookUrl(): string {
    const api = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
    // Se API_URL já termina com /api, não duplica
    return api.endsWith('/api')
      ? `${api}/whatsapp/webhook`
      : `${api}/api/whatsapp/webhook`;
  }

  /**
   * Lê configuração atual do webhook na Evolution API. Útil pra UI mostrar
   * o que tá configurado lá vs o que o admin tem no banco.
   */
  async getEvolutionWebhook(tenantId: number) {
    const cfg = await this.getAiConfig(tenantId);
    const localUrl = cfg?.webhookUrl?.trim() || this.defaultWebhookUrl();
    const res = await this.evolutionFetch(tenantId, `/webhook/find/{instance}`);
    if (!res.ok) {
      // 404 = webhook nunca configurado nessa instância (não é erro real)
      if (res.status === 404) return { configured: false, localUrl, remoteUrl: null, enabled: false };
      return { configured: false, localUrl, error: res.data?.message || res.data?.error };
    }
    // Evolution v2 retorna { url, enabled, events, ... } direto.
    // Evolution v1 retorna { webhook: { url, enabled, events, ... } }.
    const w = res.data?.webhook ?? res.data ?? {};
    return {
      configured: true,
      localUrl,
      remoteUrl: w.url || null,
      enabled:   !!w.enabled,
      events:    w.events || [],
    };
  }

  /**
   * Configura o webhook na Evolution. Se url não vier no args, usa o do
   * AiConfig.webhookUrl, senão o default (API_URL + /api/whatsapp/webhook).
   *
   * Eventos default: só MESSAGES_UPSERT (que é o único que o nosso webhook
   * processa). Pode receber events custom no args se quiser ampliar.
   */
  async setEvolutionWebhook(args: { url?: string; events?: string[] }, tenantId: number) {
    const cfg = await this.getAiConfig(tenantId);
    const url = args.url?.trim() || cfg?.webhookUrl?.trim() || this.defaultWebhookUrl();
    // Prioridade: args.events > cfg.webhookEvents > fallback ['MESSAGES_UPSERT']
    const events = (args.events?.length
      ? args.events
      : (cfg?.webhookEvents?.length ? cfg.webhookEvents : ['MESSAGES_UPSERT']));

    // Persiste url + events no AiConfig pra próxima vez vir preenchido
    try {
      await this.updateAiConfig({ webhookUrl: url, webhookEvents: events }, tenantId);
    } catch { /* não bloqueia o set principal */ }

    // Evolution v2 espera body aninhado em "webhook"
    const body = JSON.stringify({
      webhook: {
        enabled:   true,
        url,
        events,
        byEvents:  false,
        base64:    false,
      },
    });
    const res = await this.evolutionFetch(tenantId, `/webhook/set/{instance}`, {
      method: 'POST',
      body,
    });
    if (!res.ok) {
      return { ok: false, error: res.data?.message || res.data?.error || `Evolution rejeitou (${res.status}).` };
    }
    return { ok: true, url, events, message: `Webhook configurado pra ${url} com ${events.length} evento(s).` };
  }


  async ensureEvolutionInstance(tenantId: number) {
    const cfg = await this.getAiConfig(tenantId);
    const status = await this.getEvolutionStatus(tenantId);
    if (status.state === 'unconfigured') return status;
    if (status.state !== 'not_created') return { ok: true, state: status.state };

    const created = await this.evolutionFetch(tenantId, `/instance/create`, {
      method: 'POST',
      body:   JSON.stringify({ instanceName: cfg?.evolutionInstance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    });
    if (!created.ok) return { ok: false, error: created.data?.message || created.data?.error };
    return { ok: true, created: true };
  }

  async connectEvolution(tenantId: number) {
    const ensure = await this.ensureEvolutionInstance(tenantId);
    if ((ensure as any).ok === false) return ensure;

    const res = await this.evolutionFetch(tenantId, `/instance/connect/{instance}`);
    if (!res.ok) return { ok: false, error: res.data?.message || res.data?.error };

    const d = res.data || {};
    const base64      = d.base64 || d.qrcode?.base64 || d.qrcode || null;
    const code        = d.code || d.qrcode?.code || null;
    const pairingCode = d.pairingCode || d.qrcode?.pairingCode || null;

    return {
      ok: true,
      base64: base64 && !String(base64).startsWith('data:') ? `data:image/png;base64,${base64}` : base64,
      code, pairingCode,
    };
  }

  async logoutEvolution(tenantId: number) {
    const res = await this.evolutionFetch(tenantId, `/instance/logout/{instance}`, { method: 'DELETE' });
    return res.ok ? { ok: true } : { ok: false, error: res.data?.message || res.data?.error };
  }

  async restartEvolution(tenantId: number) {
    const res = await this.evolutionFetch(tenantId, `/instance/restart/{instance}`, { method: 'POST' });
    return res.ok ? { ok: true } : { ok: false, error: res.data?.message || res.data?.error };
  }
}
