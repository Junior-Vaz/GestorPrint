import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import { LogsService } from './interface/http/logs/logs.service';
import { LogsGateway } from './interface/websocket/logs.gateway';
import { setupSwagger } from './shared/swagger.setup';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Wire custom logger
  const logsService = app.get(LogsService);
  const logsGateway = app.get(LogsGateway);
  logsService.setGateway(logsGateway);
  app.useLogger(logsService);

  // Body parser — limite default do Express é 100KB, pequeno demais pra
  // payloads que carregam imagens em base64 (avatar de usuário/cliente,
  // logo de loja, anexos inline). Aumentado pra 10MB cobre fotos de
  // celular típicas (~3-5MB) com folga. Uploads de arquivos grandes
  // (>10MB) devem usar multipart via @nestjs/platform-express, não JSON.
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // ── Security headers (helmet) ────────────────────────────────────────────
  // CSP desabilitado: a SPA da loja carrega SDK do Mercado Pago (sdk.mercadopago.com),
  // imagens de mapas e CDNs externas (Unsplash, Wikimedia). Configurar CSP white-listing
  // todos esses domínios é frágil — preferimos os outros headers (X-Frame, HSTS, etc.).
  // Em produção, considere reativar com diretivas explícitas.
  // crossOriginResourcePolicy: 'cross-origin' — permite imagens/etiquetas serem carregadas
  // pela SPA hospedada em outro domínio.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts:
        process.env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
    }),
  );

  // HTTPS forçado em produção (atrás de reverse proxy que seta x-forwarded-proto).
  // O reverse proxy (nginx/cloudflare) deve lidar com o redirect 301 — esse middleware
  // serve como proteção em camada se a configuração do proxy falhar.
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS !== 'false') {
    app.use((req: any, res: any, next: any) => {
      const proto = req.headers['x-forwarded-proto'];
      if (proto && proto !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }

  // Global prefix /api — porém algumas rotas SEO (sitemap.xml, robots.txt) precisam
  // ficar na raiz, porque é onde Google e crawlers procuram por padrão.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'sitemap.xml', method: RequestMethod.GET },
      { path: 'robots.txt',  method: RequestMethod.GET },
    ],
  });

  // CORS: em produção EXIGE ALLOWED_ORIGINS configurada — sem ela, app não sobe.
  // Em dev aceita qualquer origem pra facilitar ngrok, IP local, etc.
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !process.env.ALLOWED_ORIGINS) {
    // eslint-disable-next-line no-console
    console.error(
      '[FATAL] ALLOWED_ORIGINS obrigatória em produção (lista CSV de origens). ' +
      'Ex: ALLOWED_ORIGINS=https://app.gestorprint.com,https://admin.gestorprint.com',
    );
    throw new Error('ALLOWED_ORIGINS não configurada em produção');
  }
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : true;
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // exceptionFactory captura os erros de validação ANTES de virar o 400
      // genérico — assim o console do backend mostra exatamente qual campo
      // falhou em qual constraint, em vez de só "Bad Request".
      exceptionFactory: (errors) => {
        const formatted = errors.map(e => ({
          property: e.property,
          value: e.value,
          constraints: e.constraints,
        }));
        // eslint-disable-next-line no-console
        console.warn('[ValidationPipe] Falha:', JSON.stringify(formatted, null, 2));
        const { BadRequestException } = require('@nestjs/common');
        return new BadRequestException({
          message: 'Validação falhou',
          errors: formatted,
        });
      },
    }),
  );

  // Swagger — gating + basic auth em produção. Detalhes em swagger.setup.ts.
  const swagger = setupSwagger(app, { isProd });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const log = new Logger('Bootstrap');
  log.log(`API em http://localhost:${port}/api`);
  if (swagger.enabled) {
    log.log(
      `Swagger em http://localhost:${port}${swagger.url}` +
      (swagger.protected ? ' (basic auth)' : ''),
    );
  } else {
    log.log('Swagger desabilitado (produção sem SWAGGER_ENABLED=true)');
  }
}
bootstrap();
