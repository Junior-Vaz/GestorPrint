<script setup lang="ts">
import { apiFetch, safeJson } from '../utils/api'
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import { usePermissionsStore } from '../stores/permissions'

const auth = useAuthStore()
const ui = useUiStore()
const perms = usePermissionsStore()

interface RecentOrder {
  id: number
  customerName: string
  productDescription: string
  amount: number
  status: string
  createdAt: string
}

interface TrendPoint {
  date: string
  weekday: string
  fullDate: string
  revenue: number
  expense: number
}

interface TopCustomer {
  name: string
  total: number
}

const stats = ref({
  customers: 0,
  orders: 0,
  estimates: 0,
  lowStockItems: [] as any[],
  loading: true,
  companyName: 'GestorPrint',
  ordersByStatus: { PENDING: 0, PRODUCTION: 0, FINISHED: 0, DELIVERED: 0, COMPLETED: 0 } as Record<string, number>,
  revenue: 0,
  revenueMonth: 0,
  revenueToday: 0,
  expenses: 0,
  netProfit: 0,
  pendingOrders: 0,
  completedOrders: 0,
  receivablesPending: 0,
  payablesPending: 0,
})

const recentOrders = ref<RecentOrder[]>([])
const trend = ref<TrendPoint[]>([])
const topCustomers = ref<TopCustomer[]>([])
const hasTrend = ref(false)

const currency = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const currencyFull = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const initials = (name: string) =>
  (name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '??'

const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

const formatRelativeDate = (iso: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate  = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays > 0 && diffDays < 7) return `há ${diffDays} dias`
  if (diffDays < 0 && diffDays > -7) return `em ${Math.abs(diffDays)} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

// Deterministic color pick per customer (pastel palette)
const avatarPalette = [
  { bg: '#EEEDFE', fg: '#3C3489' }, // purple
  { bg: '#E6F1FB', fg: '#0C447C' }, // blue
  { bg: '#EAF3DE', fg: '#3B6D11' }, // green
  { bg: '#FAEEDA', fg: '#854F0B' }, // amber
  { bg: '#FBEAF0', fg: '#72243E' }, // pink
  { bg: '#E1F5EE', fg: '#085041' }, // teal
]
const avatarColor = (seed: string): { bg: string; fg: string } => {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return avatarPalette[h % avatarPalette.length] ?? { bg: '#F1EFE8', fg: '#444441' }
}

const statusLabel = (s: string) => ({
  PENDING: 'Pendente',
  PRODUCTION: 'Produção',
  FINISHED: 'Finalizado',
  COMPLETED: 'Concluído',
  DELIVERED: 'Entregue',
} as Record<string, string>)[s] || s

const statusPill = (s: string) => ({
  PENDING:    { bg: '#F1EFE8', fg: '#5F5E5A' },
  PRODUCTION: { bg: '#FAEEDA', fg: '#854F0B' },
  FINISHED:   { bg: '#E6F1FB', fg: '#0C447C' },
  COMPLETED:  { bg: '#EAF3DE', fg: '#3B6D11' },
  DELIVERED:  { bg: '#EAF3DE', fg: '#3B6D11' },
} as Record<string, { bg: string; fg: string }>)[s] || { bg: '#F1EFE8', fg: '#5F5E5A' }

// ── Chart computation ────────────────────────────────────────────────────────
const chartWidth = 720
const chartHeight = 220
const yAxisWidth = 56 // espaço reservado dentro do SVG para labels Y
const plotWidth = chartWidth - yAxisWidth

// Catmull-Rom → cubic Bezier, gives a smooth curve through all points.
const smoothPath = (points: { x: number; y: number }[]): string => {
  if (points.length < 2) return ''
  const first = points[0]
  if (!first) return ''
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[Math.min(i + 2, points.length - 1)]!
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

const chartPath = computed(() => {
  const empty = { revenue: '', expense: '', area: '', lastPoint: null as { x: number; y: number; value: number } | null, yTicks: [] as { value: number; y: number }[] }
  if (!trend.value.length) return empty

  const max = Math.max(1, ...trend.value.map(t => Math.max(t.revenue, t.expense)))
  const step = trend.value.length > 1 ? plotWidth / (trend.value.length - 1) : plotWidth
  const pad = 20
  const usable = chartHeight - pad * 2

  const revPts = trend.value.map((t, i) => ({ x: yAxisWidth + i * step, y: pad + (1 - t.revenue / max) * usable, value: t.revenue }))
  const expPts = trend.value.map((t, i) => ({ x: yAxisWidth + i * step, y: pad + (1 - t.expense / max) * usable, value: t.expense }))

  const revenue = smoothPath(revPts)
  const expense = smoothPath(expPts)

  const first = revPts[0]
  const last = revPts[revPts.length - 1]
  const area = revenue && first && last
    ? `${revenue} L ${last.x.toFixed(1)} ${chartHeight - pad} L ${first.x.toFixed(1)} ${chartHeight - pad} Z`
    : ''

  const yTicks = [0, 0.5, 1].map(r => ({
    value: max * (1 - r),
    y: pad + r * usable,
  }))

  return { revenue, expense, area, lastPoint: last ?? null, yTicks }
})

// Evenly sampled X-axis labels (max 6), synced with trend indices
const chartXLabels = computed(() => {
  if (!trend.value.length) return [] as { date: string; x: number }[]
  const step = trend.value.length > 1 ? plotWidth / (trend.value.length - 1) : plotWidth
  const every = Math.max(1, Math.ceil(trend.value.length / 6))
  return trend.value
    .map((t, i) => ({ date: t.date, x: yAxisWidth + i * step, i }))
    .filter(p => p.i % every === 0)
})

// Sparkline for the side panel — last 14 days, smooth + area.
const sparkline = computed(() => {
  const w = 260
  const h = 70
  const slice = trend.value.slice(-14)
  if (!slice.length) {
    return { line: '', area: '', last: null as { x: number; y: number; value: number } | null, w, h }
  }

  const pad = 6
  const max = Math.max(1, ...slice.map(t => t.revenue))
  const step = slice.length > 1 ? w / (slice.length - 1) : w
  const pts = slice.map((t, i) => ({ x: i * step, y: pad + (1 - t.revenue / max) * (h - pad * 2), value: t.revenue }))

  const line = smoothPath(pts)
  const first = pts[0]
  const last = pts[pts.length - 1]
  const area = line && first && last ? `${line} L ${last.x.toFixed(1)} ${h} L ${first.x.toFixed(1)} ${h} Z` : ''

  return { line, area, last: last ?? null, w, h }
})

// Category volume derived from recent orders — used in the right side panel
// when no expense breakdown is available.
const categoryVolume = computed(() => {
  const total = stats.value.revenue || 1
  const bands = [
    { label: 'Entregues',   value: stats.value.ordersByStatus.DELIVERED || 0, color: '#1D9E75' },
    { label: 'Em produção', value: stats.value.ordersByStatus.PRODUCTION || 0, color: '#BA7517' },
    { label: 'Pendentes',   value: stats.value.ordersByStatus.PENDING || 0, color: '#185FA5' },
    { label: 'Finalizados', value: stats.value.ordersByStatus.FINISHED || 0, color: '#534AB7' },
  ]
  const sum = bands.reduce((a, b) => a + b.value, 0) || 1
  return bands.map(b => ({ ...b, pct: Math.round((b.value / sum) * 100), share: (b.value / sum) * 100 }))
    .filter(b => b.value > 0)
  // total kept in closure for future use; currently unused but preserves the API
  void total
})

// ── Data fetch ───────────────────────────────────────────────────────────────
// Cada bloco só dispara o request se o user tem permissão pra ver o resource.
// Isso evita 403s no console + popups "Recurso não disponível" inúteis quando
// um operador limitado (ex: PRODUCTION) abre o Dashboard. As permissões já
// foram carregadas pelo `perms.load()` no boot do App.vue, então `perms.can.X`
// é confiável aqui (sem race com primeiro fetch).
const fetchStats = async () => {
  stats.value.loading = true
  try {
    // Garante que a matriz de permissões esteja carregada antes de decidir
    // quais endpoints chamar. Sem isso, no primeiro mount o `perms.can.X`
    // usa o fallback role-based (conservador) e endpoints que o user PODE
    // ver mas estão fora do default acabariam sendo skipados.
    if (!perms.loaded) await perms.load()

    // Requests condicionais — só chama o que o user pode ver.
    // Promise.all aceita undefined no array; trato isso filtrando no map.
    const requests: Array<Promise<Response> | null> = [
      perms.can.view('customers')    ? apiFetch('/api/customers?page=1&limit=1')   : null,
      perms.can.view('orders-board') ? apiFetch('/api/orders?page=1&limit=200')    : null,
      perms.can.view('estimates')    ? apiFetch('/api/estimates?page=1&limit=1')   : null,
      perms.can.view('products')     ? apiFetch('/api/products?page=1&limit=50')   : null,
    ]
    const [cRes, oRes, eRes, pRes] = await Promise.all(
      requests.map(r => r ?? Promise.resolve(null as any)),
    )

    if (cRes?.ok) {
      const data = await cRes.json()
      stats.value.customers = Array.isArray(data) ? data.length : (data.total ?? 0)
    }

    if (oRes?.ok) {
      const data = await oRes.json()
      const orders: any[] = Array.isArray(data) ? data : (data.data ?? [])
      stats.value.orders = Array.isArray(data) ? data.length : (data.total ?? orders.length)
      stats.value.ordersByStatus = orders.reduce((acc: any, o: any) => {
        acc[o.status] = (acc[o.status] || 0) + 1
        return acc
      }, { PENDING: 0, PRODUCTION: 0, FINISHED: 0, DELIVERED: 0, COMPLETED: 0 })

      recentOrders.value = orders
        .slice()
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((o: any) => ({
          id: o.id,
          customerName: o.customer?.name || o.customerName || 'Venda avulsa',
          productDescription: o.productDescription || '—',
          amount: Number(o.amount || 0),
          status: o.status,
          createdAt: o.createdAt,
        }))
    }

    if (eRes?.ok) {
      const data: any = await safeJson(eRes, {})
      stats.value.estimates = Array.isArray(data) ? data.length : (data.total ?? 0)
    }

    if (pRes?.ok) {
      const data: any = await safeJson(pRes, {})
      const products: any[] = Array.isArray(data) ? data : (data.data ?? [])
      stats.value.lowStockItems = products.filter((p: any) => p.stock <= p.minStock)
    }

    // KPIs financeiros — só pra quem vê reports. silentOn403 é redundância
    // (já filtramos antes), mas mantém defesa em camadas se a matriz mudar
    // entre o load e a chamada.
    if (perms.can.view('reports')) {
      const [sumRes, statsRes] = await Promise.all([
        apiFetch('/api/reports/summary',         { silentOn403: true }),
        apiFetch('/api/reports/stats?period=30d', { silentOn403: true }),
      ])

      if (sumRes.ok) {
        const s: any = await safeJson(sumRes, {})
        stats.value.revenue = Number(s.revenue || 0)
        stats.value.revenueMonth = Number(s.revenueMonth || 0)
        stats.value.revenueToday = Number(s.revenueToday || 0)
        stats.value.expenses = Number(s.expenses || 0)
        stats.value.netProfit = Number(s.netProfit || 0)
        stats.value.pendingOrders = Number(s.pendingOrders || 0)
        stats.value.completedOrders = Number(s.completedOrders || 0)
        stats.value.receivablesPending = Number(s.totalReceivablesPending || 0)
        stats.value.payablesPending = Number(s.totalPayablesPending || 0)
      }

      if (statsRes.ok) {
        const st: any = await safeJson(statsRes, {})
        trend.value = st.salesTrend || []
        topCustomers.value = st.topCustomers || []
        hasTrend.value = trend.value.length > 0
      }
    }

    // Settings — usado só pra puxar `companyName` exibido no dashboard.
    // Se user não tem acesso, o nome cai no default 'GestorPrint'.
    if (perms.can.view('settings')) {
      const settingsRes = await apiFetch('/api/settings', { silentOn403: true })
      if (settingsRes.ok) {
        const settings: any = await safeJson(settingsRes, {})
        if (settings?.companyName) stats.value.companyName = settings.companyName
      }
    }
  } catch (e) {
    console.error('Error fetching dashboard stats', e)
  } finally {
    stats.value.loading = false
  }
}

onMounted(fetchStats)

// Usa ui.setTab pra herdar o gate central de features — bypassar via
// `ui.currentTab = tab` direto deixaria features bloqueadas acessíveis
const goTo = (tab: string) => { ui.setTab(tab) }
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 px-4 md:px-8 pt-2 pb-10">

      <!-- ─── Main column — direto sobre o fundo, sem cartão wrapper ─── -->
      <section>
        <div>

          <!-- Contexto + CTA -->
          <div class="flex items-center justify-between mb-7 gap-4">
            <div class="min-w-0">
              <div class="text-sm font-medium text-slate-900 truncate">{{ stats.companyName }}</div>
              <div class="text-xs text-slate-500 mt-0.5 capitalize">{{ todayLabel }}</div>
            </div>
            <button v-if="perms.can.view('pdv')" @click="goTo('pdv')"
              class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors shrink-0">
              <span class="text-base leading-none">+</span>
              <span>Novo pedido</span>
            </button>
          </div>

          <!-- KPI cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div class="border border-slate-200 rounded-xl px-4 py-3.5">
              <div class="text-xs text-slate-500 mb-2">Pedidos totais</div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-medium text-slate-900">{{ stats.loading ? '—' : stats.orders.toLocaleString('pt-BR') }}</span>
                <span v-if="!stats.loading && stats.completedOrders > 0" class="inline-flex items-center gap-0.5 text-xs" style="color:#1D9E75">
                  <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2l4 5H8v3H4V7H2z"/></svg>
                  {{ stats.completedOrders }}
                </span>
              </div>
            </div>

            <div class="border border-slate-200 rounded-xl px-4 py-3.5">
              <div class="text-xs text-slate-500 mb-2">Em produção</div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-medium text-slate-900">{{ stats.loading ? '—' : stats.pendingOrders.toLocaleString('pt-BR') }}</span>
                <span v-if="!stats.loading && (stats.ordersByStatus.PRODUCTION || 0) > 0" class="inline-flex items-center gap-0.5 text-xs" style="color:#BA7517">
                  <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="2.5"/></svg>
                  {{ stats.ordersByStatus.PRODUCTION || 0 }} ativos
                </span>
              </div>
            </div>

            <div class="border border-slate-200 rounded-xl px-4 py-3.5">
              <div class="text-xs text-slate-500 mb-2">Clientes</div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-medium text-slate-900">{{ stats.loading ? '—' : stats.customers.toLocaleString('pt-BR') }}</span>
                <span v-if="!stats.loading && topCustomers.length > 0" class="inline-flex items-center gap-0.5 text-xs" style="color:#1D9E75">
                  <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2l4 5H8v3H4V7H2z"/></svg>
                  {{ topCustomers.length }} ativos
                </span>
              </div>
            </div>

            <div class="border border-slate-200 rounded-xl px-4 py-3.5">
              <div class="text-xs text-slate-500 mb-2">Estoque baixo</div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-medium text-slate-900">{{ stats.loading ? '—' : stats.lowStockItems.length.toLocaleString('pt-BR') }}</span>
                <span v-if="!stats.loading && stats.lowStockItems.length > 0" class="inline-flex items-center gap-0.5 text-xs" style="color:#A32D2D">
                  <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 10L2 5h2V2h4v3h2z"/></svg>
                  alerta
                </span>
                <span v-else-if="!stats.loading" class="inline-flex items-center gap-0.5 text-xs" style="color:#1D9E75">
                  <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M4.5 8.5l-2-2 1-1 1 1 3-3 1 1z"/></svg>
                  em dia
                </span>
              </div>
            </div>
          </div>

          <!-- Revenue chart -->
          <div class="mb-8 pt-8 border-t border-slate-100">
            <div class="text-base font-medium text-slate-900 mb-4">Faturamento</div>

            <div class="flex flex-wrap gap-8 mb-4">
              <div>
                <div class="flex items-center gap-2 text-xs text-slate-500">
                  <span class="w-2.5 h-2.5 rounded-sm" style="background:#185FA5"></span> Receita
                </div>
                <div class="text-xl font-medium text-slate-900 mt-1">{{ currency(stats.revenue) }}</div>
              </div>
              <div>
                <div class="flex items-center gap-2 text-xs text-slate-500">
                  <span class="w-2.5 h-2.5 rounded-sm" style="background:#B4B2A9"></span> Despesas
                </div>
                <div class="text-xl font-medium text-slate-900 mt-1">{{ currency(stats.expenses) }}</div>
              </div>
              <div>
                <div class="text-xs text-slate-500">Lucro líquido</div>
                <div class="text-xl font-medium mt-1" :style="{ color: stats.netProfit >= 0 ? '#1D9E75' : '#A32D2D' }">{{ currency(stats.netProfit) }}</div>
              </div>
            </div>

            <div class="relative">
              <svg v-if="hasTrend" :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                   class="w-full block"
                   :style="{ height: chartHeight + 'px' }">
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#185FA5" stop-opacity="0.14"/>
                    <stop offset="100%" stop-color="#185FA5" stop-opacity="0"/>
                  </linearGradient>
                </defs>

                <!-- Grid horizontal + labels Y -->
                <g>
                  <line v-for="(tick, idx) in chartPath.yTicks" :key="`g${idx}`"
                        :x1="yAxisWidth" :y1="tick.y" :x2="chartWidth" :y2="tick.y"
                        stroke="#E5E7EB" stroke-width="0.5" stroke-dasharray="3 4"/>
                  <text v-for="(tick, idx) in chartPath.yTicks" :key="`t${idx}`"
                        :x="yAxisWidth - 10" :y="tick.y + 4"
                        text-anchor="end" font-size="11" fill="#94A3B8"
                        style="font-family: inherit">
                    {{ currency(tick.value) }}
                  </text>
                </g>

                <path :d="chartPath.area" fill="url(#revGradient)"/>
                <path :d="chartPath.expense" fill="none" stroke="#B4B2A9" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>
                <path :d="chartPath.revenue" fill="none" stroke="#185FA5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>

                <g v-if="chartPath.lastPoint">
                  <circle :cx="chartPath.lastPoint.x" :cy="chartPath.lastPoint.y" r="7" fill="#185FA5" fill-opacity="0.15"/>
                  <circle :cx="chartPath.lastPoint.x" :cy="chartPath.lastPoint.y" r="3.5" fill="#185FA5"/>
                  <circle :cx="chartPath.lastPoint.x" :cy="chartPath.lastPoint.y" r="1.5" fill="white"/>
                </g>
              </svg>

              <div v-else class="flex items-center justify-center text-sm text-slate-400" :style="{ height: chartHeight + 'px' }">
                Sem dados suficientes para exibir a tendência.
              </div>
            </div>

            <div v-if="hasTrend" class="flex justify-between text-xs text-slate-400 mt-2" :style="{ paddingLeft: yAxisWidth + 'px', paddingRight: '8px' }">
              <span v-for="label in chartXLabels" :key="label.x">{{ label.date }}</span>
            </div>
          </div>

          <!-- Recent orders table -->
          <div class="pt-8 border-t border-slate-100">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-baseline gap-2">
                <div class="text-base font-medium text-slate-900">Últimos pedidos</div>
                <span v-if="recentOrders.length" class="text-xs text-slate-400">{{ recentOrders.length }}</span>
              </div>
              <button v-if="perms.can.view('orders-board')" @click="goTo('board')" class="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors">Ver todos →</button>
            </div>

            <!-- Header -->
            <div class="grid grid-cols-[1.5fr_1.2fr_120px_110px_110px] gap-4 text-[11px] text-slate-400 px-2 pb-2.5 border-b border-slate-100">
              <span>Cliente</span>
              <span>Serviço</span>
              <span>Status</span>
              <span>Data</span>
              <span class="text-right">Valor</span>
            </div>

            <!-- Loading skeleton -->
            <template v-if="stats.loading">
              <div v-for="i in 4" :key="`s${i}`"
                   class="grid grid-cols-[1.5fr_1.2fr_120px_110px_110px] gap-4 items-center py-4 px-2 border-b border-slate-100">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0"></div>
                  <div class="space-y-1.5 min-w-0 flex-1">
                    <div class="h-3 bg-slate-100 rounded animate-pulse w-32 max-w-full"></div>
                    <div class="h-2 bg-slate-50 rounded animate-pulse w-16"></div>
                  </div>
                </div>
                <div class="h-3 bg-slate-100 rounded animate-pulse w-40 max-w-full"></div>
                <div class="h-5 bg-slate-100 rounded-full animate-pulse w-20"></div>
                <div class="h-3 bg-slate-100 rounded animate-pulse w-16"></div>
                <div class="h-3 bg-slate-100 rounded animate-pulse w-14 justify-self-end"></div>
              </div>
            </template>

            <!-- Empty state -->
            <div v-else-if="recentOrders.length === 0" class="py-14 flex flex-col items-center gap-3 text-center">
              <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </div>
              <div class="text-sm text-slate-500">Nenhum pedido ainda</div>
              <button v-if="perms.can.view('pdv')" @click="goTo('pdv')" class="text-xs font-medium text-slate-900 underline underline-offset-4 hover:no-underline">Criar primeiro pedido</button>
            </div>

            <!-- Rows -->
            <div v-else
                 v-for="o in recentOrders" :key="o.id"
                 @click="perms.can.view('orders-board') && goTo('board')"
                 :class="['group grid grid-cols-[1.5fr_1.2fr_120px_110px_110px] gap-4 items-center py-4 px-2 -mx-2 border-b border-slate-100 text-sm rounded-lg transition-colors',
                          perms.can.view('orders-board') ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default']">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center shrink-0"
                      :style="{ background: avatarColor(o.customerName).bg, color: avatarColor(o.customerName).fg }">
                  {{ initials(o.customerName) }}
                </span>
                <div class="min-w-0">
                  <div class="text-slate-900 truncate font-medium">{{ o.customerName }}</div>
                  <div class="text-[11px] text-slate-400">#{{ String(o.id).padStart(4, '0') }}</div>
                </div>
              </div>
              <span class="text-slate-500 truncate">{{ o.productDescription }}</span>
              <span>
                <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                      :style="{ background: statusPill(o.status).bg, color: statusPill(o.status).fg }">
                  <span class="w-1.5 h-1.5 rounded-full" :style="{ background: statusPill(o.status).fg }"></span>
                  {{ statusLabel(o.status) }}
                </span>
              </span>
              <span class="text-slate-500">{{ formatRelativeDate(o.createdAt) }}</span>
              <span class="text-right font-medium text-slate-900 flex items-center justify-end gap-1.5">
                {{ currency(o.amount) }}
                <svg class="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </span>
            </div>
          </div>

        </div>
      </section>

      <!-- ─── Side panel ──────────────────────────────────────────────── -->
      <aside class="bg-gray-100 rounded-2xl  p-6 h-fit lg:sticky lg:top-4">
        <div class="flex items-center justify-between mb-5">
          <div class="text-base font-medium text-slate-900">Volume mensal</div>
          <button @click="fetchStats" :disabled="stats.loading" class="text-slate-400 hover:text-slate-900 disabled:opacity-50"
                  aria-label="Atualizar">
            <svg class="w-5 h-5" :class="{ 'animate-spin': stats.loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>

        <div class="mb-5">
          <div class="flex items-baseline justify-between mb-1">
            <span class="text-xs text-slate-500">Hoje</span>
            <span class="text-xs text-slate-400">{{ todayLabel.split(',')[0] }}</span>
          </div>
          <div class="text-3xl font-medium text-slate-900 leading-tight">{{ currencyFull(stats.revenueToday) }}</div>
          <div class="flex items-center justify-between mt-3 text-sm">
            <span class="text-slate-500">No mês</span>
            <span class="font-medium text-slate-900">{{ currency(stats.revenueMonth) }}</span>
          </div>
        </div>

        <!-- Sparkline -->
        <div v-if="hasTrend && sparkline.last" class="relative">
          <svg :viewBox="`0 0 ${sparkline.w} ${sparkline.h}`" class="w-full block" preserveAspectRatio="none" :style="{ height: sparkline.h + 'px' }">
            <defs>
              <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1D9E75" stop-opacity="0.22"/>
                <stop offset="100%" stop-color="#1D9E75" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path :d="sparkline.area" fill="url(#sparkGradient)"/>
            <path :d="sparkline.line" fill="none" stroke="#1D9E75" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
            <circle :cx="sparkline.last.x" :cy="sparkline.last.y" r="5" fill="#1D9E75" fill-opacity="0.2"/>
            <circle :cx="sparkline.last.x" :cy="sparkline.last.y" r="2.5" fill="#1D9E75"/>
          </svg>
          <div class="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>{{ trend[0]?.date }}</span>
            <span>{{ trend[trend.length - 1]?.date }}</span>
          </div>
        </div>

        <div class="pt-5 mt-5 border-t border-slate-100">
          <div class="text-sm font-medium text-slate-900 mb-3">Status dos pedidos</div>
          <div class="flex flex-col gap-3">
            <div v-for="band in categoryVolume" :key="band.label">
              <div class="flex justify-between text-sm mb-1.5">
                <span class="text-slate-600">{{ band.label }}</span>
                <span class="font-medium text-slate-900">{{ band.value }}</span>
              </div>
              <div class="h-1 rounded-full bg-slate-100">
                <div class="h-full rounded-full transition-all duration-500" :style="{ width: band.share + '%', background: band.color }"></div>
              </div>
            </div>
            <div v-if="categoryVolume.length === 0" class="text-sm text-slate-400">
              Sem pedidos ativos.
            </div>
          </div>
        </div>

        <div v-if="topCustomers.length" class="pt-5 mt-5 border-t border-slate-100">
          <div class="text-sm font-medium text-slate-900 mb-3">Maiores clientes</div>
          <div class="flex flex-col gap-3">
            <div v-for="c in topCustomers.slice(0, 5)" :key="c.name" class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center shrink-0"
                      :style="{ background: avatarColor(c.name).bg, color: avatarColor(c.name).fg }">
                  {{ initials(c.name) }}
                </span>
                <span class="text-slate-700 truncate">{{ c.name }}</span>
              </div>
              <span class="font-medium text-slate-900 shrink-0 ml-2">{{ currency(c.total) }}</span>
            </div>
          </div>
        </div>

        <div v-if="perms.can.view('reports') || perms.can.view('financial')"
             class="flex gap-2 pt-5 mt-5 border-t border-slate-100">
          <button v-if="perms.can.view('reports')" @click="goTo('reports')"
            class="flex-1 text-sm font-medium rounded-full px-3 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
            Relatórios
          </button>
          <button v-if="perms.can.view('financial')" @click="goTo('financial')"
            class="flex-1 text-sm font-medium rounded-full px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white transition-colors">
            Financeiro
          </button>
        </div>
      </aside>

    </div>
  </div>
</template>
