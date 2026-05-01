<script setup lang="ts">
/**
 * Dashboard de resumo do ecommerce — KPIs com comparativo, gráfico de
 * vendas, distribuição por status/método de pagamento, top produtos e
 * saldo Melhor Envios. Segue o padrão visual da ReportsView (BI).
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'

const { showToast } = useToast()

interface TrendPoint { date: string; label: string; orders: number; revenue: number }
interface PaymentMethod { method: string; count: number; revenue: number }
interface DashboardSnapshot {
  ordersToday:    number
  ordersThisWeek: number
  ordersThisMonth: number
  revenueToday:    number
  revenueThisMonth: number
  averageTicket:   number
  prevPeriod?: { orders: number; revenue: number; averageTicket: number; conversion: number }
  salesTrend: TrendPoint[]
  paymentMethodDistribution: PaymentMethod[]
  statusDistribution: Array<{ status: string; count: number }>
  pendingPayment: number
  inProduction:   number
  awaitingShipment: number
  awaitingPickup:   number
  topProducts: Array<{ productId: number; name: string; qty: number; revenue: number }>
  melhorEnvios: { balance: number; configured: boolean; available: boolean; error?: string; rechargeUrl: string; environment: string }
  conversionRate?: number
  newCustomersThisMonth: number
  period: '7d' | '30d' | '90d' | '12m'
  generatedAt: string
}

const PERIODS = [
  { key: '7d',  label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: '12m', label: '12 meses' },
] as const

const selectedPeriod = ref<'7d' | '30d' | '90d' | '12m'>('30d')
const snap = ref<DashboardSnapshot | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const refreshingBalance = ref(false)
let pollId: ReturnType<typeof setInterval> | null = null

async function fetchSnapshot(silent = false) {
  if (!silent) refreshing.value = true
  try {
    const res = await apiFetch(`/api/ecommerce/admin/dashboard?period=${selectedPeriod.value}`)
    if (res.ok) snap.value = await res.json()
  } finally {
    if (!silent) refreshing.value = false
    loading.value = false
  }
}

async function refreshBalance() {
  if (refreshingBalance.value) return
  refreshingBalance.value = true
  try {
    const res = await apiFetch('/api/ecommerce/admin/melhor-envios/balance/refresh', { method: 'POST' })
    if (res.ok) {
      const balance = await res.json()
      if (snap.value) {
        snap.value.melhorEnvios = { ...snap.value.melhorEnvios, balance: balance.balance, available: balance.available, error: balance.error }
      }
      showToast(balance.available ? 'Saldo atualizado' : (balance.error || 'Falha ao consultar'), balance.available ? 'success' : 'error')
    }
  } finally { refreshingBalance.value = false }
}

watch(selectedPeriod, () => fetchSnapshot(false))

onMounted(async () => {
  await fetchSnapshot()
  pollId = setInterval(() => fetchSnapshot(true), 60_000)
})
onUnmounted(() => { if (pollId) clearInterval(pollId) })

// ─── Helpers ────────────────────────────────────────────────────────────
const fmtMoney = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct   = (v: number) => `${(v * 100).toFixed(1).replace('.0', '')}%`
const periodLabel = computed(() => PERIODS.find(p => p.key === selectedPeriod.value)?.label || '')

// Comparativo: delta % de cada KPI vs período anterior
const trendDeltas = computed(() => {
  const prev = snap.value?.prevPeriod
  if (!snap.value || !prev) return { revenue: null, orders: null, ticket: null, conversion: null }
  const periodRevenue = snap.value.salesTrend.reduce((s, p) => s + p.revenue, 0)
  const periodOrders  = snap.value.salesTrend.reduce((s, p) => s + p.orders, 0)
  const pct = (cur: number, prev: number): number | null => {
    if (!prev) return cur > 0 ? 100 : null
    return ((cur - prev) / prev) * 100
  }
  return {
    revenue:    pct(periodRevenue, prev.revenue),
    orders:     pct(periodOrders, prev.orders),
    ticket:     pct(snap.value.averageTicket, prev.averageTicket),
    conversion: pct(snap.value.conversionRate || 0, prev.conversion),
  }
})

// Saldo ME — cor e label conforme severidade
const balanceStatus = computed(() => {
  const b = snap.value?.melhorEnvios.balance ?? 0
  if (!snap.value?.melhorEnvios.available) return { color: '#94a3b8', label: 'Indisponível' }
  if (b < 10)  return { color: '#dc2626', label: 'Crítico' }
  if (b < 50)  return { color: '#d97706', label: 'Baixo' }
  return { color: '#059669', label: 'OK' }
})

// Status: label humano + cor (mesma paleta do kanban)
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:    { label: 'Pendentes',    color: '#d97706' },
  PRODUCTION: { label: 'Em produção',  color: '#2563eb' },
  FINISHED:   { label: 'Finalizados',  color: '#7c3aed' },
  DELIVERED:  { label: 'Entregues',    color: '#059669' },
  REJECTED:   { label: 'Rejeitados',   color: '#dc2626' },
  CANCELLED:  { label: 'Cancelados',   color: '#64748b' },
}
const statusList = computed(() => {
  const list = snap.value?.statusDistribution || []
  return list.map(s => ({ ...s, ...(STATUS_LABEL[s.status] || { label: s.status, color: '#64748b' }) }))
              .sort((a, b) => b.count - a.count)
})
const totalStatusCount = computed(() => statusList.value.reduce((s, x) => s + x.count, 0))

// Payment methods — cores fixas por método pra leitura consistente
const METHOD_LABEL: Record<string, { label: string; color: string }> = {
  PIX:         { label: 'PIX',          color: '#1D9E75' },
  CREDIT_CARD: { label: 'Cartão',       color: '#2563EB' },
  BOLETO:      { label: 'Boleto',       color: '#A32D2D' },
  CASH:        { label: 'Dinheiro',     color: '#059669' },
  OTHER:       { label: 'Outros',       color: '#64748b' },
}
const methodList = computed(() =>
  (snap.value?.paymentMethodDistribution || []).map(m => ({
    ...m,
    ...(METHOD_LABEL[m.method] || { label: m.method, color: '#64748b' }),
  }))
)
const totalMethodCount = computed(() => methodList.value.reduce((s, x) => s + x.count, 0))

// ─── Chart helpers (mesma técnica da ReportsView) ─────────────────────
const chartWidth  = 880
const chartHeight = 280
const yAxisWidth  = 60
const chartPath = computed(() => {
  const trend = snap.value?.salesTrend || []
  if (!trend.length) return { revenue: '', revArea: '', orders: '', yTicks: [], lastRev: null }
  const w = chartWidth - yAxisWidth - 8
  const h = chartHeight - 20
  const maxRev = Math.max(...trend.map(p => p.revenue), 1)
  const maxOrders = Math.max(...trend.map(p => p.orders), 1)

  const xStep = trend.length > 1 ? w / (trend.length - 1) : 0
  const xAt = (i: number) => yAxisWidth + i * xStep
  const yRev = (v: number) => 10 + h - (v / maxRev) * h
  const yOrd = (v: number) => 10 + h - (v / maxOrders) * h

  const revPath = trend.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yRev(p.revenue).toFixed(1)}`).join(' ')
  const ordPath = trend.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yOrd(p.orders).toFixed(1)}`).join(' ')

  // Área sob a curva de receita (pra preencher gradiente)
  const areaStart = `M${xAt(0).toFixed(1)},${(10 + h).toFixed(1)}`
  const areaEnd = ` L${xAt(trend.length - 1).toFixed(1)},${(10 + h).toFixed(1)} Z`
  const revArea = areaStart + ' L' + trend.map((p, i) => `${xAt(i).toFixed(1)},${yRev(p.revenue).toFixed(1)}`).join(' L') + areaEnd

  // Ticks do eixo Y (5 níveis)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ y: 10 + h - t * h, value: maxRev * t }))

  // Marcador do último ponto (highlight)
  const lastIdx = trend.length - 1
  const lastPoint = trend[lastIdx]
  const lastRev = lastPoint ? { x: xAt(lastIdx), y: yRev(lastPoint.revenue) } : null

  return { revenue: revPath, revArea, orders: ordPath, yTicks, lastRev }
})
const chartXLabels = computed(() => {
  const trend = snap.value?.salesTrend || []
  if (trend.length <= 8) return trend.map(t => ({ date: t.label }))
  // Reduz pra ~7 labels evenly spaced
  const step = Math.ceil(trend.length / 7)
  return trend.filter((_, i) => i % step === 0).map(t => ({ date: t.label }))
})

// Donut de payment methods — calcula stroke-dasharray cumulativo
const donutSegments = computed(() => {
  const total = totalMethodCount.value
  if (!total) return []
  const circumference = 2 * Math.PI * 60   // raio 60
  let offset = 0
  return methodList.value.map(m => {
    const fraction = m.count / total
    const segLength = fraction * circumference
    const seg = {
      ...m,
      dasharray: `${segLength.toFixed(2)} ${(circumference - segLength).toFixed(2)}`,
      dashoffset: -offset,
      pct: (fraction * 100).toFixed(1),
    }
    offset += segLength
    return seg
  })
})

// Soma do período (computada do trend)
const periodTotalRevenue = computed(() =>
  (snap.value?.salesTrend || []).reduce((s, p) => s + p.revenue, 0)
)
const periodTotalOrders = computed(() =>
  (snap.value?.salesTrend || []).reduce((s, p) => s + p.orders, 0)
)
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header -->
      <div class="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Resumo do ecommerce</div>
          <div class="text-xs text-slate-500 mt-0.5">Visão consolidada — {{ periodLabel }}</div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Period pills (igual ReportsView) -->
          <div class="flex gap-1 bg-slate-50 p-1 rounded-full border border-slate-200">
            <button v-for="p in PERIODS" :key="p.key"
              @click="selectedPeriod = p.key"
              :class="['px-3.5 py-1.5 rounded-full text-xs transition-colors',
                selectedPeriod === p.key
                  ? 'bg-white text-slate-900 font-medium shadow-sm'
                  : 'text-slate-600 hover:text-slate-900']">
              {{ p.label }}
            </button>
          </div>
          <button @click="fetchSnapshot(false)" :disabled="refreshing"
            class="p-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg text-slate-600 transition-colors"
            title="Atualizar agora">
            <svg :class="['w-4 h-4', refreshing && 'animate-spin']" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-24">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>

      <template v-else-if="snap">
        <!-- Saldo Melhor Envios — banner destaque -->
        <section class="rounded-xl p-4 mb-6 transition-colors flex items-center justify-between gap-4 flex-wrap"
                 :style="{ borderColor: balanceStatus.color + '40', background: balanceStatus.color + '0A', borderWidth: '1px', borderStyle: 'solid' }">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0" :style="{ background: balanceStatus.color }">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-500 flex items-center gap-2">
                Saldo Melhor Envios
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold text-[10px]" :style="{ background: balanceStatus.color, color: '#fff' }">{{ balanceStatus.label }}</span>
                <span v-if="snap.melhorEnvios.environment === 'sandbox'" class="text-[10px] text-slate-400">SANDBOX</span>
              </div>
              <div class="text-2xl font-medium mt-0.5" :style="{ color: balanceStatus.color }">
                {{ snap.melhorEnvios.available ? fmtMoney(snap.melhorEnvios.balance) : '—' }}
              </div>
              <div v-if="snap.melhorEnvios.error" class="text-[11px] text-slate-500 mt-0.5">{{ snap.melhorEnvios.error }}</div>
              <div v-else-if="snap.melhorEnvios.balance < 50 && snap.melhorEnvios.available" class="text-[11px] text-amber-700 mt-0.5">
                Saldo baixo. Recarregue pra não bloquear emissão de etiquetas.
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="refreshBalance" :disabled="refreshingBalance"
              class="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full hover:bg-white transition-colors disabled:opacity-50">
              <svg :class="['w-3 h-3', refreshingBalance && 'animate-spin']" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Reconsultar
            </button>
            <a :href="snap.melhorEnvios.rechargeUrl" target="_blank" rel="noopener"
              class="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-full px-4 py-1.5 transition-colors">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Recarregar
            </a>
          </div>
        </section>

        <!-- KPIs com setinhas comparativas -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <!-- Receita do período -->
          <div class="rounded-xl p-5" style="background:#E1F5EE">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs" style="color:#0F6E56">Receita ({{ periodLabel }})</div>
                <div class="text-2xl font-medium mt-1" style="color:#0F6E56">{{ fmtMoney(periodTotalRevenue) }}</div>
              </div>
              <svg class="w-4 h-4 mt-1" style="color:#1D9E75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
            <div v-if="trendDeltas.revenue !== null" class="flex items-center gap-1 text-[11px]">
              <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" :style="{ color: trendDeltas.revenue >= 0 ? '#0F6E56' : '#A32D2D' }">
                <path v-if="trendDeltas.revenue >= 0" d="M6 2l4 5H8v3H4V7H2z"/>
                <path v-else d="M6 10L2 5h2V2h4v3h2z"/>
              </svg>
              <span :style="{ color: trendDeltas.revenue >= 0 ? '#0F6E56' : '#A32D2D' }" class="font-medium">{{ Math.abs(trendDeltas.revenue).toFixed(1) }}%</span>
              <span style="color:#0F6E56; opacity:.6">vs. período anterior</span>
            </div>
            <div v-else class="text-[11px]" style="color:#0F6E56; opacity:.6">sem comparativo</div>
          </div>

          <!-- Pedidos -->
          <div class="border border-slate-200 rounded-xl p-5">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs text-slate-500">Pedidos</div>
                <div class="text-2xl font-medium text-slate-900 mt-1">{{ periodTotalOrders }}</div>
              </div>
              <svg class="w-4 h-4 mt-1 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>
            </div>
            <div v-if="trendDeltas.orders !== null" class="flex items-center gap-1 text-[11px]">
              <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" :style="{ color: trendDeltas.orders >= 0 ? '#1D9E75' : '#A32D2D' }">
                <path v-if="trendDeltas.orders >= 0" d="M6 2l4 5H8v3H4V7H2z"/>
                <path v-else d="M6 10L2 5h2V2h4v3h2z"/>
              </svg>
              <span :style="{ color: trendDeltas.orders >= 0 ? '#1D9E75' : '#A32D2D' }" class="font-medium">{{ Math.abs(trendDeltas.orders).toFixed(1) }}%</span>
              <span class="text-slate-400">vs. período anterior</span>
            </div>
            <div v-else class="text-[11px] text-slate-400">sem comparativo</div>
          </div>

          <!-- Ticket médio -->
          <div class="border border-slate-200 rounded-xl p-5">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs text-slate-500">Ticket médio</div>
                <div class="text-2xl font-medium text-slate-900 mt-1">{{ fmtMoney(snap.averageTicket) }}</div>
              </div>
              <span class="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">média</span>
            </div>
            <div v-if="trendDeltas.ticket !== null" class="flex items-center gap-1 text-[11px]">
              <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" :style="{ color: trendDeltas.ticket >= 0 ? '#1D9E75' : '#A32D2D' }">
                <path v-if="trendDeltas.ticket >= 0" d="M6 2l4 5H8v3H4V7H2z"/>
                <path v-else d="M6 10L2 5h2V2h4v3h2z"/>
              </svg>
              <span :style="{ color: trendDeltas.ticket >= 0 ? '#1D9E75' : '#A32D2D' }" class="font-medium">{{ Math.abs(trendDeltas.ticket).toFixed(1) }}%</span>
              <span class="text-slate-400">vs. período anterior</span>
            </div>
            <div v-else class="text-[11px] text-slate-400">sem comparativo</div>
          </div>

          <!-- Conversão -->
          <div class="border border-slate-200 rounded-xl p-5">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs text-slate-500">Conversão</div>
                <div class="text-2xl font-medium text-slate-900 mt-1">{{ fmtPct(snap.conversionRate || 0) }}</div>
              </div>
              <span class="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">pago / criado</span>
            </div>
            <div v-if="trendDeltas.conversion !== null" class="flex items-center gap-1 text-[11px]">
              <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" :style="{ color: trendDeltas.conversion >= 0 ? '#1D9E75' : '#A32D2D' }">
                <path v-if="trendDeltas.conversion >= 0" d="M6 2l4 5H8v3H4V7H2z"/>
                <path v-else d="M6 10L2 5h2V2h4v3h2z"/>
              </svg>
              <span :style="{ color: trendDeltas.conversion >= 0 ? '#1D9E75' : '#A32D2D' }" class="font-medium">{{ Math.abs(trendDeltas.conversion).toFixed(1) }} p.p.</span>
              <span class="text-slate-400">vs. anterior</span>
            </div>
            <div v-else class="text-[11px] text-slate-400">sem comparativo</div>
          </div>
        </div>

        <!-- Gráfico principal — Receita & Pedidos no período -->
        <div class="border border-slate-200 rounded-xl p-6 mb-6">
          <div class="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <div class="text-base font-medium text-slate-900">Vendas no período</div>
              <div class="text-xs text-slate-500 mt-0.5">Receita (linha verde) · Pedidos (linha azul)</div>
            </div>
            <div class="flex gap-4 text-xs">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm" style="background:#1D9E75"></span>
                <span class="text-slate-500">Receita</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm border border-dashed" style="border-color:#185FA5; background:transparent"></span>
                <span class="text-slate-500">Pedidos</span>
              </div>
            </div>
          </div>

          <div class="relative">
            <svg v-if="snap.salesTrend.length > 0" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="w-full block" :style="{ height: chartHeight + 'px' }">
              <defs>
                <linearGradient id="ecRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#1D9E75" stop-opacity="0.16"/>
                  <stop offset="100%" stop-color="#1D9E75" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <g>
                <line v-for="(tick, idx) in chartPath.yTicks" :key="`g${idx}`"
                  :x1="yAxisWidth" :y1="tick.y" :x2="chartWidth" :y2="tick.y"
                  stroke="#E5E7EB" stroke-width="0.5" stroke-dasharray="3 4"/>
                <text v-for="(tick, idx) in chartPath.yTicks" :key="`t${idx}`"
                  :x="yAxisWidth - 10" :y="tick.y + 4"
                  text-anchor="end" font-size="11" fill="#94A3B8" style="font-family: inherit">
                  {{ fmtMoney(tick.value) }}
                </text>
              </g>
              <path :d="chartPath.revArea" fill="url(#ecRevGrad)"/>
              <path :d="chartPath.orders" fill="none" stroke="#185FA5" stroke-width="1.4" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round"/>
              <path :d="chartPath.revenue" fill="none" stroke="#1D9E75" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
              <g v-if="chartPath.lastRev">
                <circle :cx="chartPath.lastRev.x" :cy="chartPath.lastRev.y" r="7" fill="#1D9E75" fill-opacity="0.2"/>
                <circle :cx="chartPath.lastRev.x" :cy="chartPath.lastRev.y" r="3.5" fill="#1D9E75"/>
                <circle :cx="chartPath.lastRev.x" :cy="chartPath.lastRev.y" r="1.5" fill="white"/>
              </g>
            </svg>
            <div v-else class="flex items-center justify-center text-sm text-slate-400" :style="{ height: chartHeight + 'px' }">Sem dados no período</div>
          </div>
          <div v-if="snap.salesTrend.length > 0" class="flex justify-between text-xs text-slate-400 mt-2" :style="{ paddingLeft: yAxisWidth + 'px', paddingRight: '8px' }">
            <span v-for="(label, i) in chartXLabels" :key="i">{{ label.date }}</span>
          </div>
        </div>

        <!-- Pedidos que precisam atenção -->
        <div class="border border-slate-200 rounded-xl p-6 mb-6">
          <div class="text-base font-medium text-slate-900 mb-4">Precisa de atenção</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">{{ snap.pendingPayment }}</div>
              <div>
                <div class="text-xs font-semibold text-amber-900">Aguardando pagamento</div>
                <div class="text-[11px] text-amber-700">PIX/Boleto não confirmados</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">{{ snap.inProduction }}</div>
              <div>
                <div class="text-xs font-semibold text-blue-900">Em produção</div>
                <div class="text-[11px] text-blue-700">Sendo impressos agora</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
              <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-bold shrink-0">{{ snap.awaitingShipment }}</div>
              <div>
                <div class="text-xs font-semibold text-purple-900">Aguardando despacho</div>
                <div class="text-[11px] text-purple-700">Prontos sem etiqueta</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-sm font-bold shrink-0">{{ snap.awaitingPickup }}</div>
              <div>
                <div class="text-xs font-semibold text-emerald-900">Aguardando retirada</div>
                <div class="text-[11px] text-emerald-700">Cliente vai buscar</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Linha 1: Status (barras) + Pagamentos (donut) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Distribuição de status -->
          <div class="border border-slate-200 rounded-xl p-6">
            <div class="text-base font-medium text-slate-900 mb-1">Pedidos do mês por status</div>
            <div class="text-xs text-slate-500 mb-5">Total: {{ totalStatusCount }} pedido{{ totalStatusCount === 1 ? '' : 's' }}</div>
            <div v-if="!statusList.length" class="text-center py-12 text-sm text-slate-400">Nenhum pedido este mês</div>
            <div v-else class="space-y-3">
              <div v-for="s in statusList" :key="s.status" class="flex items-center gap-3">
                <span class="w-28 text-xs text-slate-700 shrink-0">{{ s.label }}</span>
                <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full transition-all rounded-full" :style="{ width: `${(s.count / totalStatusCount) * 100}%`, background: s.color }"></div>
                </div>
                <span class="w-12 text-right text-xs font-mono font-semibold text-slate-900">{{ s.count }}</span>
              </div>
            </div>
          </div>

          <!-- Donut payment methods -->
          <div class="border border-slate-200 rounded-xl p-6">
            <div class="text-base font-medium text-slate-900 mb-1">Métodos de pagamento</div>
            <div class="text-xs text-slate-500 mb-5">Distribuição no período</div>
            <div v-if="!methodList.length" class="text-center py-12 text-sm text-slate-400">Sem pedidos no período</div>
            <div v-else class="flex items-center gap-6">
              <!-- Donut SVG -->
              <div class="relative shrink-0" style="width: 140px; height: 140px;">
                <svg viewBox="0 0 140 140" class="w-[140px] h-[140px] -rotate-90">
                  <circle cx="70" cy="70" r="60" fill="none" stroke="#F1F5F9" stroke-width="14"/>
                  <circle v-for="seg in donutSegments" :key="seg.method"
                    cx="70" cy="70" r="60" fill="none" :stroke="seg.color" stroke-width="14"
                    :stroke-dasharray="seg.dasharray" :stroke-dashoffset="seg.dashoffset"
                    style="transition: stroke-dashoffset 0.6s ease;"/>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <div class="text-xl font-medium text-slate-900">{{ totalMethodCount }}</div>
                  <div class="text-[11px] text-slate-500">pedidos</div>
                </div>
              </div>
              <!-- Legenda -->
              <div class="flex-1 space-y-2">
                <div v-for="seg in donutSegments" :key="seg.method" class="flex items-center gap-2.5">
                  <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: seg.color }"></span>
                  <span class="text-xs text-slate-700 flex-1">{{ seg.label }}</span>
                  <span class="text-xs font-mono text-slate-500">{{ seg.pct }}%</span>
                  <span class="text-xs font-mono font-medium text-slate-900 w-8 text-right">{{ seg.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top produtos -->
        <div class="border border-slate-200 rounded-xl p-6 mb-6">
          <div class="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <div class="text-base font-medium text-slate-900">Top 5 produtos vendidos</div>
              <div class="text-xs text-slate-500 mt-0.5">Mais vendidos no mês corrente (por quantidade)</div>
            </div>
          </div>
          <div v-if="!snap.topProducts.length" class="text-center py-12 text-sm text-slate-400">Nenhuma venda este mês</div>
          <div v-else class="space-y-2">
            <div v-for="(p, i) in snap.topProducts" :key="p.productId"
              class="grid grid-cols-12 items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
              <span class="col-span-1 w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-mono font-bold flex items-center justify-center">
                {{ i + 1 }}
              </span>
              <div class="col-span-5 min-w-0">
                <div class="text-sm text-slate-900 truncate">{{ p.name }}</div>
                <div class="text-[11px] text-slate-500">{{ p.qty }} unidades</div>
              </div>
              <!-- Barra proporcional -->
              <div class="col-span-4">
                <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full"
                    :style="{ width: `${(p.qty / (snap.topProducts[0]?.qty || 1)) * 100}%`, background: '#1D9E75' }"></div>
                </div>
              </div>
              <div class="col-span-2 text-right text-sm font-medium text-slate-900">{{ fmtMoney(p.revenue) }}</div>
            </div>
          </div>
        </div>

        <!-- Footer info -->
        <div class="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
          <span>{{ snap.newCustomersThisMonth }} novos clientes este mês · {{ snap.ordersToday }} pedido(s) hoje · {{ fmtMoney(snap.revenueToday) }} faturados</span>
          <span>Atualizado às {{ new Date(snap.generatedAt).toLocaleTimeString('pt-BR') }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
