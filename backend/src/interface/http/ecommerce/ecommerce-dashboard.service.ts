import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { MelhorEnviosService } from './melhor-envios.service';

/**
 * Dashboard agregando métricas operacionais e financeiras do ecommerce.
 * Fonte única consultada pela view EcommerceDashboardView no ERP.
 *
 * Trade-off: várias queries Prisma em paralelo (~6) — barato porque tudo
 * filtra por tenantId+source=ECOMMERCE indexado. Ainda assim, idealmente
 * seria materializado num refresh periódico se a base crescer muito.
 */
export interface DashboardSnapshot {
  // KPIs principais
  ordersToday:    number;
  ordersThisWeek: number;
  ordersThisMonth: number;
  revenueToday:    number;
  revenueThisMonth: number;
  averageTicket:   number;

  // Comparativo período anterior — pra setinhas % nos KPIs
  prevPeriod?: {
    orders:        number;
    revenue:       number;
    averageTicket: number;
    conversion:    number;
  };

  // Série temporal — granularidade automática (dia/semana) baseada no período
  salesTrend: Array<{
    date:    string;   // "2026-04-30"
    label:   string;   // "30/abr"
    orders:  number;
    revenue: number;
  }>;

  // Distribuição por método de pagamento (donut) — período corrente
  paymentMethodDistribution: Array<{ method: string; count: number; revenue: number }>;

  // Status (barras horizontais)
  statusDistribution: Array<{ status: string; count: number }>;

  // Pedidos pendentes (precisam atenção)
  pendingPayment: number;
  inProduction:   number;
  awaitingShipment: number;
  awaitingPickup:   number;

  // Top 5 produtos vendidos no período
  topProducts: Array<{ productId: number; name: string; qty: number; revenue: number }>;

  // Saldo Melhor Envios
  melhorEnvios: {
    balance:    number;
    configured: boolean;
    available:  boolean;
    error?:     string;
    rechargeUrl: string;
    environment: string;
  };

  // Conversão
  conversionRate?: number;   // pedidos pagos / pedidos criados (período)

  // Cliente
  newCustomersThisMonth: number;

  // Período usado (echo back da query)
  period: '7d' | '30d' | '90d' | '12m';

  // Última atualização (pra UI mostrar "atualizado há Xs")
  generatedAt: string;
}

@Injectable()
export class EcommerceDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly me: MelhorEnviosService,
  ) {}

  async getSnapshot(
    tenantId: number,
    period: '7d' | '30d' | '90d' | '12m' = '30d',
  ): Promise<DashboardSnapshot> {
    const now      = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const startWeek  = new Date(now); startWeek.setDate(now.getDate() - 7); startWeek.setHours(0, 0, 0, 0);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Janela do período selecionado — usado pelo trend e KPIs comparativos
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const startPeriod = new Date(now); startPeriod.setDate(now.getDate() - periodDays); startPeriod.setHours(0, 0, 0, 0);
    const startPrevPeriod = new Date(startPeriod); startPrevPeriod.setDate(startPrevPeriod.getDate() - periodDays);

    // Granularidade da série: 7d/30d → dia, 90d/12m → semana
    const bucketByWeek = period === '90d' || period === '12m';

    const baseWhere = { tenantId, source: 'ECOMMERCE' as const };

    // Disparamos tudo em paralelo — Prisma usa pool de conexão, então não rola gargalo
    const [
      ordersToday,
      ordersThisWeek,
      ordersThisMonth,
      revenueTodayAgg,
      revenueMonthAgg,
      statusGroups,
      pendingPayment,
      inProduction,
      awaitingShipment,
      awaitingPickup,
      paidOrdersThisMonth,
      newCustomers,
      monthOrders,
      meBalance,
      periodOrders,
      prevPeriodAgg,
      prevPeriodCount,
    ] = await Promise.all([
      (this.prisma as any).order.count({ where: { ...baseWhere, createdAt: { gte: startToday } } }),
      (this.prisma as any).order.count({ where: { ...baseWhere, createdAt: { gte: startWeek } } }),
      (this.prisma as any).order.count({ where: { ...baseWhere, createdAt: { gte: startMonth } } }),
      (this.prisma as any).order.aggregate({
        where: { ...baseWhere, paymentStatus: 'APPROVED', createdAt: { gte: startToday } },
        _sum:  { amount: true },
      }),
      (this.prisma as any).order.aggregate({
        where: { ...baseWhere, paymentStatus: 'APPROVED', createdAt: { gte: startMonth } },
        _sum:  { amount: true },
      }),
      (this.prisma as any).order.groupBy({
        by:    ['status'],
        where: { ...baseWhere, createdAt: { gte: startMonth } },
        _count: { _all: true },
      }),
      (this.prisma as any).order.count({ where: { ...baseWhere, paymentStatus: 'PENDING' } }),
      (this.prisma as any).order.count({ where: { ...baseWhere, status: 'PRODUCTION' } }),
      // "Aguardando despacho" — finalizado mas sem etiqueta nem tracking, e
      // não é retirada na loja. Usa NOT contains pra filtrar pickup.
      (this.prisma as any).order.count({
        where: {
          ...baseWhere,
          status: 'FINISHED',
          shippingLabelUrl: null,
          NOT: [
            { shippingService: { contains: 'etirar', mode: 'insensitive' } },
            { shippingCarrier: { equals: 'Loja',     mode: 'insensitive' } },
          ],
        },
      }),
      // "Aguardando retirada" — pickup pronto pro cliente buscar
      (this.prisma as any).order.count({
        where: {
          ...baseWhere,
          status: 'FINISHED',
          OR: [
            { shippingService: { contains: 'etirar', mode: 'insensitive' } },
            { shippingCarrier: { equals: 'Loja',     mode: 'insensitive' } },
          ],
        },
      }),
      (this.prisma as any).order.count({
        where: { ...baseWhere, paymentStatus: 'APPROVED', createdAt: { gte: startMonth } },
      }),
      (this.prisma as any).customer.count({
        where: { tenantId, createdAt: { gte: startMonth } },
      }),
      // Pra calcular top produtos: traz pedidos do mês com details.items
      (this.prisma as any).order.findMany({
        where:  { ...baseWhere, paymentStatus: 'APPROVED', createdAt: { gte: startMonth } },
        select: { details: true },
        take:   500,   // safety cap — gráficas com >500 vendas/mês geralmente migram pra ETL
      }),
      this.me.getBalance(tenantId),
      // Pedidos do período pra trend + payment method distribution
      (this.prisma as any).order.findMany({
        where:  { ...baseWhere, createdAt: { gte: startPeriod } },
        select: { createdAt: true, amount: true, paymentStatus: true, paymentMethod: true },
        orderBy: { createdAt: 'asc' },
        take:   5000,
      }),
      // Período anterior — pra comparativo MoM nas setinhas dos KPIs
      (this.prisma as any).order.aggregate({
        where: {
          ...baseWhere,
          createdAt: { gte: startPrevPeriod, lt: startPeriod },
          paymentStatus: 'APPROVED',
        },
        _sum:   { amount: true },
        _count: { _all: true },
      }),
      (this.prisma as any).order.count({
        where: { ...baseWhere, createdAt: { gte: startPrevPeriod, lt: startPeriod } },
      }),
    ]);

    const revenueToday    = Number(revenueTodayAgg?._sum?.amount || 0);
    const revenueThisMonth = Number(revenueMonthAgg?._sum?.amount || 0);
    const averageTicket   = paidOrdersThisMonth > 0 ? revenueThisMonth / paidOrdersThisMonth : 0;
    const conversionRate  = ordersThisMonth > 0 ? paidOrdersThisMonth / ordersThisMonth : 0;

    // ── Série temporal (salesTrend) ────────────────────────────────────────
    // Bucket por dia (7d/30d) ou semana (90d/12m). Agrupa pelos pedidos do
    // período, contando orders e somando revenue (apenas approved entram no
    // revenue, contagem inclui todos pra mostrar volume real de tráfego).
    const buckets = new Map<string, { orders: number; revenue: number; date: Date }>();
    const bucketKey = (d: Date) => {
      const dt = new Date(d);
      if (bucketByWeek) {
        const day = dt.getDay();
        const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
        dt.setDate(diff);
      }
      dt.setHours(0, 0, 0, 0);
      return dt.toISOString().slice(0, 10);
    };
    // Pré-popula buckets vazios pra ter linha contínua mesmo em dias sem venda
    const totalBuckets = bucketByWeek ? Math.ceil(periodDays / 7) : periodDays;
    for (let i = totalBuckets - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * (bucketByWeek ? 7 : 1));
      const k = bucketKey(d);
      if (!buckets.has(k)) buckets.set(k, { orders: 0, revenue: 0, date: new Date(k) });
    }
    for (const o of (periodOrders as any[])) {
      const k = bucketKey(new Date(o.createdAt));
      const b = buckets.get(k) || { orders: 0, revenue: 0, date: new Date(k) };
      b.orders += 1;
      if (o.paymentStatus === 'APPROVED') b.revenue += Number(o.amount || 0);
      buckets.set(k, b);
    }
    const fmtLabel = (d: Date) => {
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      return bucketByWeek
        ? `${d.getDate()}/${months[d.getMonth()]}`
        : `${d.getDate().toString().padStart(2, '0')}/${months[d.getMonth()]}`;
    };
    const salesTrend = [...buckets.values()]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(b => ({
        date:    b.date.toISOString().slice(0, 10),
        label:   fmtLabel(b.date),
        orders:  b.orders,
        revenue: Number(b.revenue.toFixed(2)),
      }));

    // ── Distribuição por método de pagamento ───────────────────────────────
    // Conta + soma revenue por method pra alimentar o donut. Só pedidos approved
    // contam no revenue, mas todos contam no count (mostra preferência do cliente).
    const methodAgg = new Map<string, { count: number; revenue: number }>();
    for (const o of (periodOrders as any[])) {
      const m = String(o.paymentMethod || 'OTHER').toUpperCase();
      const cur = methodAgg.get(m) || { count: 0, revenue: 0 };
      cur.count += 1;
      if (o.paymentStatus === 'APPROVED') cur.revenue += Number(o.amount || 0);
      methodAgg.set(m, cur);
    }
    const paymentMethodDistribution = [...methodAgg.entries()]
      .map(([method, v]) => ({ method, count: v.count, revenue: Number(v.revenue.toFixed(2)) }))
      .sort((a, b) => b.count - a.count);

    // ── Comparativo período anterior (pra setinhas % nos KPIs) ─────────────
    const prevRevenue       = Number((prevPeriodAgg as any)?._sum?.amount || 0);
    const prevPaidOrders    = Number((prevPeriodAgg as any)?._count?._all || 0);
    const prevTotalOrders   = Number(prevPeriodCount || 0);
    const prevAverageTicket = prevPaidOrders > 0 ? prevRevenue / prevPaidOrders : 0;
    const prevConversion    = prevTotalOrders > 0 ? prevPaidOrders / prevTotalOrders : 0;

    // Top produtos: agrega items das orders pagas do mês
    const productAgg = new Map<number, { name: string; qty: number; revenue: number }>();
    for (const o of monthOrders) {
      const items = (o.details as any)?.items || [];
      for (const it of items) {
        const pid = Number(it.id || it.productId);
        if (!pid) continue;
        const cur = productAgg.get(pid) || { name: it.name || `Produto ${pid}`, qty: 0, revenue: 0 };
        cur.qty     += Number(it.qty || 0);
        cur.revenue += Number(it.lineTotal || (it.qty * (it.unitPrice || 0)) || 0);
        productAgg.set(pid, cur);
      }
    }
    const topProducts = [...productAgg.entries()]
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      ordersToday, ordersThisWeek, ordersThisMonth,
      revenueToday, revenueThisMonth, averageTicket,
      prevPeriod: {
        orders:        prevTotalOrders,
        revenue:       prevRevenue,
        averageTicket: prevAverageTicket,
        conversion:    prevConversion,
      },
      salesTrend,
      paymentMethodDistribution,
      statusDistribution: (statusGroups as any[]).map((s: any) => ({ status: s.status, count: s._count._all })),
      pendingPayment, inProduction, awaitingShipment, awaitingPickup,
      topProducts,
      period,
      melhorEnvios: {
        balance:     (meBalance as any).balance,
        configured:  (meBalance as any).configured,
        available:   (meBalance as any).available,
        error:       (meBalance as any).error,
        rechargeUrl: this.me.rechargeUrl((meBalance as any).environment),
        environment: (meBalance as any).environment,
      },
      conversionRate,
      newCustomersThisMonth: newCustomers,
      generatedAt: new Date().toISOString(),
    };
  }
}
