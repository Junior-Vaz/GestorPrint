import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

const logger = new Logger('MpWebhookValidator');

/**
 * Valida a assinatura de um webhook do Mercado Pago (v2).
 *
 * Formato do header `x-signature`: `ts=<timestamp>,v1=<hash>`
 * Manifest a ser assinado: `id:<dataId>;request-id:<xRequestId>;ts:<ts>;`
 * Algoritmo: HMAC-SHA256(secret, manifest) em hex.
 *
 * Comportamento:
 * - Sem secret configurado → retorna `true` mas loga warning (modo dev/permissivo)
 * - Headers ausentes → retorna `false` (rejeita)
 * - Hash diferente → retorna `false` (rejeita, possível ataque)
 *
 * @param prisma instância do Prisma pra carregar settings
 * @param tenantId tenant do webhook (default 1; ajustar quando subdomain multi-tenant)
 * @param headers headers HTTP da requisição
 * @param dataId ID do recurso (vem do body: data.id)
 */
export async function validateMpWebhookSignature(
  prisma: PrismaService,
  tenantId: number,
  headers: Record<string, string | string[] | undefined>,
  dataId: string,
): Promise<boolean> {
  const settings = await (prisma as any).settings.findUnique({ where: { tenantId } });
  const secret: string | undefined = settings?.mpWebhookSecret;

  // Sem secret configurado: aceita (modo permissivo pra dev). Loga warning pra deixar claro.
  if (!secret) {
    logger.warn(`Webhook MP sem secret configurado pra tenant ${tenantId}. Recomenda-se configurar em Configurações pra ambiente de produção.`);
    return true;
  }

  const sigHeader = String(headers['x-signature'] || '');
  const reqId     = String(headers['x-request-id'] || '');

  if (!sigHeader || !reqId) {
    logger.warn(`Webhook MP rejeitado: headers x-signature/x-request-id ausentes`);
    return false;
  }

  // Parse "ts=...,v1=..."
  const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split('=').map(s => s?.trim());
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) {
    logger.warn(`Webhook MP rejeitado: x-signature mal formado (${sigHeader})`);
    return false;
  }

  // Manifest exatamente conforme docs MP: id:<dataId>;request-id:<xRequestId>;ts:<ts>;
  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Comparação constante (timing-safe) pra evitar timing attacks
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    ok = false;
  }

  if (!ok) {
    logger.warn(`Webhook MP rejeitado: assinatura inválida (esperado=${expected.substring(0, 12)}..., recebido=${v1.substring(0, 12)}...)`);
  }
  return ok;
}
