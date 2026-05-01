import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Evento individual da timeline de rastreamento. Vem do Melhor Envios já
 * normalizado: data ISO, descrição do status, location textual, e UF
 * extraída quando possível (pra plotar no mapa do Brasil).
 */
export interface TrackingEvent {
  date:     string;        // ISO 8601
  status:   string;        // ex: "Postado", "Em trânsito", "Entregue"
  location: string;        // ex: "Centro de Distribuição São Paulo / SP"
  state?:   string;        // ex: "SP" — extraída de `location`. undefined se não conseguiu
}

export interface TrackingResult {
  orderId:          number;
  trackingCode:     string | null;
  shippingService:  string | null;
  shippingCarrier:  string | null;
  events:           TrackingEvent[];
  /** UF da loja (origem) — vem de Settings.originAddress.state */
  originState?:     string;
  /** UF do destinatário — vem de Order.shippingAddress.state */
  destinationState?: string;
  /** Status agregado mais recente do ME (released_for_pickup, in_transit, delivered, etc). */
  meStatus?:        string;
  /** Última atualização (data do evento mais recente, ISO). */
  lastUpdate?:      string;
  /** True se a loja não tem ME configurado — UI mostra fallback amigável. */
  trackingDisabled?: boolean;
  /** True se ME ainda não tem nenhum evento registrado pro pedido. */
  awaitingFirstEvent?: boolean;
}

interface CacheEntry {
  ts:   number;
  data: TrackingResult;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;   // 5 min — eventos do ME mudam devagar

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna o histórico de rastreio do pedido. Cacheado em memória por 5min
   * (chamadas frequentes da SPA não martelam o ME).
   *
   * Tolerante a falhas: se o ME estiver fora ou o token inválido, devolve
   * `{ events: [], trackingDisabled: true }` em vez de lançar 5xx — a UI
   * mostra estado vazio amigável.
   */
  async getTracking(tenantId: number, uuid: string): Promise<TrackingResult> {
    const order = await (this.prisma as any).order.findFirst({
      where: { uuid, tenantId, source: 'ECOMMERCE' },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    // Pickup não tem trajeto — retorna vazio. SPA decide não exibir o mapa.
    const carrier = String(order.shippingCarrier || '').toLowerCase();
    const service = String(order.shippingService || '').toLowerCase();
    const isPickup = service.startsWith('retirar') || carrier === 'loja' || carrier.includes('retirar');
    if (isPickup) {
      return {
        orderId: order.id,
        trackingCode: null,
        shippingService: order.shippingService,
        shippingCarrier: order.shippingCarrier,
        events: [],
        trackingDisabled: true,
      };
    }

    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const originState = (settings?.originAddress as any)?.state || undefined;
    const destinationState = (order.shippingAddress as any)?.state || undefined;

    // Cache hit? (chave por meShipmentId — tracking code de transportadora não muda)
    const cacheKey = order.meShipmentId ? `me:${order.meShipmentId}` : `code:${order.trackingCode}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
      return { ...cached.data, originState, destinationState };
    }

    const baseResult: TrackingResult = {
      orderId: order.id,
      trackingCode: order.trackingCode || null,
      shippingService: order.shippingService,
      shippingCarrier: order.shippingCarrier,
      events: [],
      originState,
      destinationState,
    };

    // Sem ME configurado ou sem shipmentId → retorna vazio. Trackings inseridos
    // manualmente pelo admin (sem passar pelo ME) também caem aqui — o cliente
    // ao menos vê o código pra colar no site da transportadora.
    const token = settings?.meAccessToken;
    if (!token || !order.meShipmentId) {
      return { ...baseResult, trackingDisabled: !order.meShipmentId };
    }

    const env = settings?.meEnvironment || 'sandbox';
    const baseUrl = env === 'production'
      ? 'https://melhorenvio.com.br'
      : 'https://sandbox.melhorenvio.com.br';

    // ME tracking endpoint aceita lista de shipment IDs e devolve um objeto
    // map: { "<shipmentId>": { status, tracking, events } }
    let meBody: any;
    try {
      const res = await fetch(`${baseUrl}/api/v2/me/shipment/tracking`, {
        method: 'POST',
        headers: {
          'Accept':         'application/json',
          'Content-Type':   'application/json',
          'Authorization':  `Bearer ${token}`,
          'User-Agent':     'GestorPrint Ecommerce (admin@gestorprint.com.br)',
        },
        body: JSON.stringify({ orders: [order.meShipmentId] }),
      });
      if (!res.ok) {
        this.logger.warn(`[tracking] ME respondeu ${res.status} para ${order.meShipmentId}`);
        return { ...baseResult, trackingDisabled: true };
      }
      meBody = await res.json();
    } catch (e: any) {
      this.logger.warn(`[tracking] Falha consultando ME: ${e?.message}`);
      return { ...baseResult, trackingDisabled: true };
    }

    const meEntry = meBody?.[order.meShipmentId] || {};
    const rawEvents: any[] = Array.isArray(meEntry.tracking?.events)
      ? meEntry.tracking.events
      : (Array.isArray(meEntry.events) ? meEntry.events : []);

    const events: TrackingEvent[] = rawEvents
      .map(ev => this.normalizeEvent(ev))
      .filter((e): e is TrackingEvent => !!e);

    // Eventos vêm em ordem desconhecida — ordenamos cronológicos crescente
    // (mais antigo → mais recente). UI itera direto, último é o atual.
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const result: TrackingResult = {
      ...baseResult,
      events,
      meStatus:   meEntry.status || undefined,
      lastUpdate: events.length ? events[events.length - 1].date : undefined,
      awaitingFirstEvent: events.length === 0,
    };

    this.cache.set(cacheKey, { ts: Date.now(), data: result });
    return result;
  }

  /**
   * Normaliza um evento do ME pro shape interno. ME retorna formatos
   * ligeiramente diferentes por transportadora — daí a defensividade.
   */
  private normalizeEvent(ev: any): TrackingEvent | null {
    if (!ev) return null;
    // Tenta vários campos comuns
    const date     = ev.created_at || ev.date || ev.datetime || ev.timestamp;
    const status   = ev.description || ev.status || ev.message || ev.event;
    const location = ev.location || ev.city_state || ev.local || ev.where || '';
    if (!date || !status) return null;

    return {
      date:     new Date(date).toISOString(),
      status:   String(status).trim(),
      location: String(location).trim(),
      state:    this.extractUF(String(location)),
    };
  }

  /**
   * Extrai UF do texto de location. Aceita formatos:
   *  - "São Paulo / SP"
   *  - "Centro de Distribuição - Curitiba/PR"
   *  - "RECIFE / PE"
   *  - "Rio de Janeiro - RJ"
   * Retorna undefined se não achar UF válida (lista das 27).
   */
  private extractUF(text: string): string | undefined {
    if (!text) return undefined;
    const VALID_UFS = new Set([
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
      'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
    ]);
    // Tenta os padrões mais comuns no fim da string: "/SP", "- SP", " SP"
    const m = text.match(/[\/\-\s]\s*([A-Z]{2})\s*$/i);
    if (m) {
      const uf = m[1].toUpperCase();
      if (VALID_UFS.has(uf)) return uf;
    }
    // Fallback: qualquer UF válida no texto (último match)
    const all = text.toUpperCase().match(/\b([A-Z]{2})\b/g) || [];
    for (let i = all.length - 1; i >= 0; i--) {
      if (VALID_UFS.has(all[i])) return all[i];
    }
    return undefined;
  }
}
