import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Serviço utilitário pra dados auxiliares do Melhor Envios — saldo, histórico,
 * info da conta — separado do `LabelService` (que cuida de emissão de etiqueta).
 *
 * Tudo cacheado em memória curto prazo: ME tem rate limit por minuto e a UI
 * pode chamar saldo várias vezes (refresh automático no Kanban + dashboard).
 */
export interface MeBalance {
  balance:    number;        // saldo em R$ (ME devolve número)
  configured: boolean;       // tenant tem token cadastrado?
  available:  boolean;       // chamada ao ME funcionou?
  error?:     string;        // mensagem amigável quando available=false
  fetchedAt:  string;        // ISO — pra UI mostrar "atualizado há Xs"
  environment: 'sandbox' | 'production';
}

interface CacheEntry {
  ts:   number;
  data: MeBalance;
}

@Injectable()
export class MelhorEnviosService {
  private readonly logger = new Logger(MelhorEnviosService.name);
  private readonly cache = new Map<number, CacheEntry>();
  private readonly CACHE_TTL_MS = 60 * 1000;   // 60s — equilibra "atualizado" com rate limit do ME

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consulta saldo do ME pro tenant. Resposta sempre estruturada — não lança,
   * pra UI poder render quando ME tá fora ou sem token (mostra placeholder).
   */
  async getBalance(tenantId: number, force = false): Promise<MeBalance> {
    const now = Date.now();
    if (!force) {
      const cached = this.cache.get(tenantId);
      if (cached && now - cached.ts < this.CACHE_TTL_MS) return cached.data;
    }

    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const token = settings?.meAccessToken;
    const env: 'sandbox' | 'production' = settings?.meEnvironment === 'production' ? 'production' : 'sandbox';

    const base: MeBalance = {
      balance:    0,
      configured: !!token,
      available:  false,
      fetchedAt:  new Date(now).toISOString(),
      environment: env,
    };

    if (!token) {
      const result = { ...base, error: 'Token Melhor Envios não configurado' };
      this.cache.set(tenantId, { ts: now, data: result });
      return result;
    }

    const baseUrl = env === 'production'
      ? 'https://melhorenvio.com.br'
      : 'https://sandbox.melhorenvio.com.br';

    try {
      const res = await fetch(`${baseUrl}/api/v2/me/balance`, {
        method: 'GET',
        headers: {
          'Accept':         'application/json',
          'Authorization':  `Bearer ${token}`,
          'User-Agent':     'GestorPrint Ecommerce (admin@gestorprint.com.br)',
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`[balance] ME ${res.status}: ${body.slice(0, 200)}`);
        const reason = res.status === 401 || res.status === 403
          ? 'Token expirado ou inválido'
          : `Erro do Melhor Envios (HTTP ${res.status})`;
        const result = { ...base, error: reason };
        this.cache.set(tenantId, { ts: now, data: result });
        return result;
      }
      const data = await res.json();
      // ME devolve { balance: <number>, currency: "BRL" }
      const balance = Number(data?.balance ?? 0);
      const result: MeBalance = { ...base, balance, available: true };
      this.cache.set(tenantId, { ts: now, data: result });
      return result;
    } catch (e: any) {
      this.logger.warn(`[balance] Falha consultando ME: ${e?.message}`);
      const result = { ...base, error: 'Não foi possível consultar o Melhor Envios agora' };
      this.cache.set(tenantId, { ts: now, data: result });
      return result;
    }
  }

  /** Invalida cache do tenant — usado depois de operações que mudam saldo
   *  (compra de etiqueta, recarga manual confirmada pelo admin). */
  invalidate(tenantId: number) {
    this.cache.delete(tenantId);
  }

  /**
   * Parser do erro 422 do ME quando saldo é insuficiente.
   * Exemplo da mensagem: "Seu saldo de R$ 0.00 é insuficiente para o pagamento
   * com a carteira no valor de R$ 12.68"
   * Retorna { current, required, missing } em reais — undefined se não conseguir parsear.
   */
  static parseInsufficientBalance(message: string): { current: number; required: number; missing: number } | undefined {
    if (!message) return undefined;
    const m = message.match(/R\$\s*([\d.,]+).+?R\$\s*([\d.,]+)/i);
    if (!m) return undefined;
    const parseBr = (s: string) => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
    const current  = parseBr(m[1]);
    const required = parseBr(m[2]);
    return { current, required, missing: Math.max(0, required - current) };
  }

  /** URL pra abrir a Melhor Carteira (recarga + extrato + faturas) no
   *  navegador. Em produção usa o novo painel SPA `app.melhorenvio.com.br`;
   *  em sandbox segue no painel antigo (não tem equivalente no `app.`). */
  rechargeUrl(env: 'sandbox' | 'production' = 'production') {
    return env === 'production'
      ? 'https://app.melhorenvio.com.br/melhor-carteira'
      : 'https://sandbox.melhorenvio.com.br/painel/gerenciar/recarga';
  }
}
