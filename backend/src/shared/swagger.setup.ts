/**
 * Configuração centralizada do Swagger/OpenAPI.
 *
 * Política de exposição:
 *   • Dev / staging  → exposto em /api/docs sem auth
 *   • Produção       → exposto SOMENTE se SWAGGER_ENABLED=true
 *                      e protegido por basic auth (SWAGGER_USER + SWAGGER_PASS)
 *
 * Em produção, o catálogo de endpoints é informação sensível — ajuda atacantes
 * a mapear a superfície da API. Por isso o gating + basic auth.
 */
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';

export interface SwaggerSetupOptions {
  isProd: boolean;
  /** Caminho onde o Swagger UI fica disponível (default: 'api/docs') */
  path?: string;
}

/**
 * Configura Swagger se as condições de exposição forem atendidas. Retorna
 * `{ enabled, url }` pra logging do bootstrap.
 */
export function setupSwagger(
  app: INestApplication,
  opts: SwaggerSetupOptions,
): { enabled: boolean; url: string | null; protected: boolean } {
  const enabled = !opts.isProd || process.env.SWAGGER_ENABLED === 'true';
  if (!enabled) {
    return { enabled: false, url: null, protected: false };
  }

  const path = opts.path ?? 'api/docs';

  // Em produção, exigir basic auth pra acessar o Swagger UI.
  // SWAGGER_USER + SWAGGER_PASS no .env. Se faltar, gera credenciais
  // aleatórias por boot e loga uma vez no console (operador anota).
  let needsAuth = false;
  let user = process.env.SWAGGER_USER;
  let pass = process.env.SWAGGER_PASS;
  if (opts.isProd) {
    needsAuth = true;
    if (!user || !pass) {
      user = 'gpadmin';
      pass = generateRandomPassword(24);
      // eslint-disable-next-line no-console
      console.warn(
        `[Swagger] SWAGGER_USER/SWAGGER_PASS não configurados — gerei credenciais ` +
        `pra esta sessão. Anote agora: ${user} / ${pass}`,
      );
    }
    app.use(`/${path}`, basicAuthMiddleware(user!, pass!));
    app.use(`/${path}-json`, basicAuthMiddleware(user!, pass!));
  }

  const config = new DocumentBuilder()
    .setTitle('GestorPrint API')
    .setDescription([
      'API REST do GestorPrint — SaaS multi-tenant de ERP para gráficas.',
      '',
      '**Autenticação**: a maioria dos endpoints exige `Authorization: Bearer <jwt>`.',
      'Pegue o token via `POST /api/auth/login` (email + senha).',
      '',
      '**Tenants**: cada request opera no contexto do tenant codificado no JWT.',
      'Endpoints `/api/tenants/*` e `/api/admin/*` são exclusivos do super admin.',
      '',
      '**Webhooks públicos**:',
      '  - `POST /api/billing/webhooks` — Asaas (header `asaas-access-token`)',
      '  - `POST /api/payments/webhook` — Mercado Pago (HMAC SHA-256)',
      '  - `POST /api/whatsapp/webhook` — Evolution API',
    ].join('\n'))
    .setVersion(process.env.npm_package_version ?? '1.0.0')
    .setContact('GestorPrint', 'https://gestorprint.com.br', 'suporte@gestorprint.com.br')
    .setLicense('Proprietary', '')
    .addServer(opts.isProd ? (process.env.API_URL || '/') : 'http://localhost:3000', opts.isProd ? 'Produção' : 'Local')
    .addBearerAuth(
      {
        type:        'http',
        scheme:      'bearer',
        bearerFormat: 'JWT',
        description: 'JWT obtido via POST /api/auth/login',
      },
      'JWT',
    )
    // Tags organizam endpoints na UI
    .addTag('auth',           'Login, registro, JWT')
    .addTag('orders',         'Pedidos de produção')
    .addTag('estimates',      'Orçamentos (service / plotter / cutting / embroidery)')
    .addTag('customers',      'Clientes')
    .addTag('products',       'Catálogo de produtos e estoque')
    .addTag('payments',       'Transações e PIX (Mercado Pago)')
    .addTag('expenses',       'Despesas operacionais')
    .addTag('receivables',    'Contas a receber')
    .addTag('payables',       'Contas a pagar')
    .addTag('reports',        'Relatórios e exports XLSX')
    .addTag('files',          'Upload e serving de anexos')
    .addTag('settings',       'Configurações do tenant')
    .addTag('users',          'Usuários do tenant')
    .addTag('suppliers',      'Fornecedores')
    .addTag('product-types',  'Categorias de produto')
    .addTag('notifications',  'Notificações in-app')
    .addTag('audit',          'Audit log')
    .addTag('messaging',      'Email/SMTP outbound')
    .addTag('mcp',            'IA: configuração + Evolution API')
    .addTag('ai-chat',        'IA: chat ERP (admin only)')
    .addTag('whatsapp',       'WhatsApp webhooks')
    .addTag('ecommerce',      'Storefront público + admin do ecommerce')
    .addTag('billing',        'Assinaturas SaaS (Asaas) — super admin')
    .addTag('tenants',        'Gerenciamento de tenants — super admin')
    .addTag('plans',          'PlanConfig — super admin')
    .addTag('platform-settings', 'Configurações da plataforma — super admin')
    .addTag('logs',           'Logs do sistema — super admin')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  SwaggerModule.setup(path, app, document, {
    customSiteTitle: 'GestorPrint API · Docs',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { color: #0f172a; }
    `,
    swaggerOptions: {
      persistAuthorization: true,         // mantém o JWT entre F5
      docExpansion:         'none',       // tags colapsadas por default
      filter:               true,         // search bar
      displayRequestDuration: true,
      tagsSorter:           'alpha',
      operationsSorter:     'alpha',
    },
  });

  return {
    enabled:    true,
    url:        `/${path}`,
    protected:  needsAuth,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function basicAuthMiddleware(expectedUser: string, expectedPass: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="GestorPrint API Docs"');
      return res.status(401).send('Autenticação obrigatória');
    }
    const decoded = Buffer.from(header.slice(6), 'base64').toString();
    const [user, ...passParts] = decoded.split(':');
    const pass = passParts.join(':');
    if (
      !timingSafeEqual(user, expectedUser) ||
      !timingSafeEqual(pass, expectedPass)
    ) {
      res.setHeader('WWW-Authenticate', 'Basic realm="GestorPrint API Docs"');
      return res.status(401).send('Credenciais inválidas');
    }
    next();
  };
}

/** Comparação resistente a timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function generateRandomPassword(len: number): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
