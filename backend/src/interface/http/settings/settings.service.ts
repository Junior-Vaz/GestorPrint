import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Lista de campos sensíveis em Settings. NUNCA loga valor real no audit —
 * só registra que mudou. Sem isso, o AuditLog viraria um vazamento de
 * credenciais (mpAccessToken, evolutionKey, geminiKey, etc).
 */
const SENSITIVE_FIELDS = new Set([
  'mpAccessToken', 'mpPublicKey', 'mpWebhookSecret',
  'meAccessToken',
  'asaasApiKey', 'asaasWebhookToken',
  'smtpPass',
]);

function sanitize(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const out: any = {};
  for (const k of Object.keys(data)) {
    out[k] = SENSITIVE_FIELDS.has(k) ? '***masked***' : data[k];
  }
  return out;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getTenantUuid(tenantId: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { uuid: true },
    });
    return tenant?.uuid ?? '';
  }

  async getSettings(tenantId = 1) {
    // NestJS serializa `null` como body VAZIO (não "null"), o que faz o frontend
    // estourar com "Unexpected end of JSON input" no `res.json()`. Devolve um
    // objeto vazio quando não existe registro pra esse tenant — mantém contrato
    // estável: frontend sempre recebe JSON válido.
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    return settings ?? {};
  }

  /**
   * Subconjunto "público" das settings — campos que QUALQUER user autenticado
   * do tenant pode ver (sem precisar de `settings:view`). Usado pelo Kanban
   * (PRODUCTION operator), header global, mensagens automáticas de WhatsApp,
   * etc. NÃO inclui credenciais nem configs sensíveis.
   */
  async getPublicSettings(tenantId = 1) {
    const s = await (this.prisma as any).settings.findUnique({
      where: { tenantId },
      select: {
        companyName:    true,
        logoUrl:        true,
        phone:          true,
        cnpj:           true,
        businessHours:  true,
      },
    });
    return s ?? {};
  }

  async updateSettings(data: any, tenantId = 1) {
    const result = await (this.prisma as any).settings.upsert({
      where: { tenantId },
      create: { ...data, tenantId },
      update: data,
    });
    await this.audit.logAction(
      null,
      'UPDATE',
      'Settings',
      tenantId,
      { changedFields: Object.keys(data || {}), values: sanitize(data) },
      tenantId,
    );
    return result;
  }

  /** Merge incremental do pricingConfig — preserva chaves não enviadas. */
  async updatePricingConfig(patch: any, tenantId = 1) {
    const current = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const existing = (current?.pricingConfig as any) || {};
    const merged = deepMerge(existing, patch || {});
    const result = await (this.prisma as any).settings.upsert({
      where: { tenantId },
      create: { tenantId, pricingConfig: merged },
      update: { pricingConfig: merged },
    });
    await this.audit.logAction(
      null,
      'UPDATE',
      'Settings.pricingConfig',
      tenantId,
      { patchedKeys: Object.keys(patch || {}) },
      tenantId,
    );
    return result;
  }
}

function deepMerge(target: any, source: any): any {
  if (typeof source !== 'object' || source === null) return source;
  const out: any = { ...(target || {}) };
  for (const k of Object.keys(source)) {
    const sv = source[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      out[k] = deepMerge(out[k] || {}, sv);
    } else {
      out[k] = sv;
    }
  }
  return out;
}
