import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../infrastructure/persistence/prisma/prisma.service';

/**
 * Catálogo tipado de chaves. Mantém type-safety nos consumidores e
 * documenta o universo de configs editáveis pelo super admin.
 *
 * Setado como `isSecret` → mascarado nas respostas de leitura via API.
 * O resto continua exposto pra exibição no painel.
 */
export const PLATFORM_SETTING_KEYS = {
  // ── Asaas (gateway de cobrança SaaS) ─────────────────────────────
  asaasApiKey:        { secret: true,  envFallback: 'ASAAS_API_KEY' },
  asaasEnv:           { secret: false, envFallback: 'ASAAS_ENV' }, // sandbox|production
  asaasWebhookToken:  { secret: true,  envFallback: 'ASAAS_WEBHOOK_TOKEN' },
  // Dias de tolerância antes de suspender por PAYMENT_OVERDUE (default 3)
  asaasGracePeriodDays: { secret: false, envFallback: 'ASAAS_GRACE_PERIOD_DAYS' },
  // ── SMTP (emails da plataforma — trial vencendo, fatura, etc.) ───
  smtpHost:           { secret: false, envFallback: 'SMTP_HOST' },
  smtpPort:           { secret: false, envFallback: 'SMTP_PORT' },
  smtpUser:           { secret: false, envFallback: 'SMTP_USER' },
  smtpPass:           { secret: true,  envFallback: 'SMTP_PASS' },
  smtpFrom:           { secret: false, envFallback: 'SMTP_FROM' },
  // ── URLs ─────────────────────────────────────────────────────────
  apiUrl:             { secret: false, envFallback: 'API_URL' },
} as const;

export type PlatformSettingKey = keyof typeof PLATFORM_SETTING_KEYS;

/**
 * Service de leitura/escrita de configurações da plataforma.
 *
 * - Cache em memória (TTL 30s) pra evitar bater no DB toda request
 * - Fallback automático em env var se a key não existir no DB (retrocompat
 *   pra ambientes que ainda configuram via .env, e pra dev/CI)
 * - Mascaramento de secrets em `getMaskedAll()` (consumido pela API admin)
 */
@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private cache: Map<string, string> | null = null;
  private cacheLoadedAt = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  // ── Leitura com fallback ────────────────────────────────────────────────
  async get(key: PlatformSettingKey): Promise<string> {
    await this.ensureCacheLoaded();
    const fromDb = this.cache?.get(key);
    if (fromDb !== undefined && fromDb !== '') return fromDb;
    const envName = PLATFORM_SETTING_KEYS[key].envFallback;
    return process.env[envName] || '';
  }

  /** Versão number — útil pra portas */
  async getNumber(key: PlatformSettingKey, defaultValue = 0): Promise<number> {
    const v = await this.get(key);
    if (!v) return defaultValue;
    const n = Number(v);
    return Number.isFinite(n) ? n : defaultValue;
  }

  /** Retorna todas as configs (com secrets mascarados) — pra UI do admin */
  async getMaskedAll(): Promise<Record<string, { value: string; isSecret: boolean; fromEnv: boolean }>> {
    await this.ensureCacheLoaded();
    const out: Record<string, { value: string; isSecret: boolean; fromEnv: boolean }> = {};
    for (const [key, meta] of Object.entries(PLATFORM_SETTING_KEYS)) {
      const fromDb = this.cache?.get(key);
      const fromEnv = !fromDb && !!process.env[meta.envFallback];
      const raw = fromDb || process.env[meta.envFallback] || '';
      out[key] = {
        value: meta.secret ? this.mask(raw) : raw,
        isSecret: meta.secret,
        fromEnv,
      };
    }
    return out;
  }

  // ── Escrita ─────────────────────────────────────────────────────────────
  async set(key: PlatformSettingKey, value: string, updatedBy?: number): Promise<void> {
    if (!(key in PLATFORM_SETTING_KEYS)) {
      throw new Error(`Chave de configuração desconhecida: ${key}`);
    }
    const isSecret = PLATFORM_SETTING_KEYS[key].secret;
    await (this.prisma as any).platformSetting.upsert({
      where:  { key },
      create: { key, value, isSecret, updatedBy: updatedBy || null },
      update: { value, isSecret, updatedBy: updatedBy || null },
    });
    this.invalidateCache();
  }

  /** Remove uma chave específica do DB (volta a usar o env fallback) */
  async unset(key: PlatformSettingKey): Promise<void> {
    await (this.prisma as any).platformSetting.deleteMany({ where: { key } });
    this.invalidateCache();
  }

  /** Atualiza várias chaves em uma única transação */
  async setMany(values: Partial<Record<PlatformSettingKey, string>>, updatedBy?: number): Promise<void> {
    const ops: any[] = [];
    for (const [k, v] of Object.entries(values)) {
      if (!(k in PLATFORM_SETTING_KEYS)) continue;
      const key = k as PlatformSettingKey;
      const isSecret = PLATFORM_SETTING_KEYS[key].secret;

      // Valor vazio → remove (volta pro env fallback)
      if (v === '' || v == null) {
        ops.push((this.prisma as any).platformSetting.deleteMany({ where: { key } }));
      } else {
        ops.push((this.prisma as any).platformSetting.upsert({
          where:  { key },
          create: { key, value: v, isSecret, updatedBy: updatedBy || null },
          update: { value: v, isSecret, updatedBy: updatedBy || null },
        }));
      }
    }
    await (this.prisma as any).$transaction(ops);
    this.invalidateCache();
  }

  // ── Cache ───────────────────────────────────────────────────────────────
  private async ensureCacheLoaded() {
    const now = Date.now();
    if (this.cache && now - this.cacheLoadedAt < this.CACHE_TTL_MS) return;
    try {
      const rows = await (this.prisma as any).platformSetting.findMany();
      const map = new Map<string, string>();
      for (const r of rows) map.set(r.key, r.value);
      this.cache = map;
      this.cacheLoadedAt = now;
    } catch (e: any) {
      // Se a tabela ainda não existe (migration não rodou), opera só com env vars
      this.logger.warn(`PlatformSetting indisponível, usando só env vars: ${e.message}`);
      this.cache = new Map();
      this.cacheLoadedAt = now;
    }
  }

  private invalidateCache() {
    this.cache = null;
    this.cacheLoadedAt = 0;
  }

  /** Mascaramento ****1234 — mostra os 4 últimos caracteres */
  private mask(v: string): string {
    if (!v) return '';
    if (v.length <= 4) return '****';
    return '*'.repeat(Math.max(4, v.length - 4)) + v.slice(-4);
  }
}
