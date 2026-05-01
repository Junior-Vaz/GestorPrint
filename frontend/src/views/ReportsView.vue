<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { apiFetch } from '../utils/api'
import { usePlanStore } from '../stores/plan'

const plan = usePlanStore()

// ── Estado ───────────────────────────────────────────────────────────────────
const selectedPeriod = ref<'7d' | '30d' | '90d' | '12m'>('30d')

interface Summary {
  revenue: number
  expenses: number
  netProfit: number
  pendingOrders: number
  completedOrders: number
  inventoryValue: number
  lowStockCount: number
  paidTransactionsCount?: number
  revenueToday?: number
  revenueMonth?: number
}

interface TrendPoint { date: string; weekday: string; fullDate: string; revenue: number; expense: number }

const summary = ref<Summary>({
  revenue: 0,
  expenses: 0,
  netProfit: 0,
  pendingOrders: 0,
  completedOrders: 0,
  inventoryValue: 0,
  lowStockCount: 0,
})

const trend = ref<TrendPoint[]>([])
const topCustomers = ref<{ name: string; total: number }[]>([])
const expenseBreakdown = ref<{ category: string; total: number }[]>([])
const productionStats = ref<{ name: string; count: number }[]>([])

// Advanced reports
const estimatePipeline = ref<{ status: string; count: number; total: number }[]>([])
const conversionRate = ref(0)
const salesByPerson = ref<{ userId: number; name: string; orderCount: number; revenue: number; commission: number }[]>([])
const productionByPerson = ref<{ userId: number; name: string; orderCount: number; revenue: number }[]>([])
const invoiceAging = ref<{ bucket: string; count: number; total: number }[]>([])
const salesByType = ref<{ type: string; key: string; count: number; total: number }[]>([])
const pdvVsEstimate = ref({ pdv: { count: 0, total: 0 }, fromEstimate: { count: 0, total: 0 } })

// Comparativo MoM/YoY
const summaryPrev = ref<Summary | null>(null)
const summaryYearAgo = ref<Summary | null>(null)

// Date range custom
const customStartDate = ref('')
const customEndDate = ref('')
const useCustomRange = computed(() => !!(customStartDate.value && customEndDate.value))

const loading = ref(true)

const buildPeriodQuery = () => {
  if (useCustomRange.value) {
    return `startDate=${customStartDate.value}&endDate=${customEndDate.value}`
  }
  return `period=${selectedPeriod.value}`
}

const fetchReports = async () => {
  loading.value = true
  try {
    const q = buildPeriodQuery()
    const [sumRes, statsRes, advRes] = await Promise.all([
      apiFetch(`/api/reports/summary?${q}`),
      apiFetch(`/api/reports/stats?${q}`),
      apiFetch(`/api/reports/advanced?${q}`),
    ])
    if (sumRes.ok) summary.value = await sumRes.json()
    if (statsRes.ok) {
      const d = await statsRes.json()
      trend.value = d.salesTrend || []
      topCustomers.value = d.topCustomers || []
      expenseBreakdown.value = d.expenseBreakdown || []
      productionStats.value = d.productionStats || []
    }
    if (advRes.ok) {
      const d = await advRes.json()
      estimatePipeline.value = d.estimatePipeline || []
      conversionRate.value = d.conversionRate || 0
      salesByPerson.value = d.salesByPerson || []
      productionByPerson.value = d.productionByPerson || []
      invoiceAging.value = d.invoiceAging || []
      salesByType.value = d.salesByType || []
      pdvVsEstimate.value = d.pdvVsEstimate || { pdv: { count: 0, total: 0 }, fromEstimate: { count: 0, total: 0 } }
    }

    // Comparativo: busca período anterior + ano anterior pra MoM/YoY
    if (!useCustomRange.value) {
      const days = selectedPeriod.value === '7d' ? 7 : selectedPeriod.value === '30d' ? 30 : selectedPeriod.value === '90d' ? 90 : 365
      const now = new Date()
      const prevEnd = new Date(now); prevEnd.setDate(now.getDate() - days)
      const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - days)
      const yearAgoEnd = new Date(now); yearAgoEnd.setFullYear(now.getFullYear() - 1)
      const yearAgoStart = new Date(yearAgoEnd); yearAgoStart.setDate(yearAgoEnd.getDate() - days)
      const fmt = (d: Date) => d.toISOString().split('T')[0]
      const [prev, ya] = await Promise.all([
        apiFetch(`/api/reports/summary?startDate=${fmt(prevStart)}&endDate=${fmt(prevEnd)}`),
        apiFetch(`/api/reports/summary?startDate=${fmt(yearAgoStart)}&endDate=${fmt(yearAgoEnd)}`),
      ])
      summaryPrev.value = prev.ok ? await prev.json() : null
      summaryYearAgo.value = ya.ok ? await ya.json() : null
    } else {
      summaryPrev.value = null
      summaryYearAgo.value = null
    }
  } catch (e) {
    console.error('Error fetching reports', e)
  } finally {
    loading.value = false
  }
}

const applyCustomRange = () => {
  if (customStartDate.value && customEndDate.value) fetchReports()
}

const clearCustomRange = () => {
  customStartDate.value = ''
  customEndDate.value = ''
  fetchReports()
}

const exportPdf = () => {
  if (!plan.hasPdf) {
    plan.setLimitError('Exportação em PDF não disponível no plano atual.')
    return
  }
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/reports/export/pdf?period=${selectedPeriod.value}&token=${token}`, '_blank')
}

const exportXlsx = () => {
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/reports/export/xlsx?period=${selectedPeriod.value}&token=${token}`, '_blank')
}

const exportSales = () => {
  const token = localStorage.getItem('gp_token') || ''
  const q = buildPeriodQuery()
  window.open(`/api/reports/export/sales/xlsx?${q}&token=${token}`, '_blank')
}

const exportProduction = () => {
  const token = localStorage.getItem('gp_token') || ''
  const q = buildPeriodQuery()
  window.open(`/api/reports/export/production/xlsx?${q}&token=${token}`, '_blank')
}

watch(selectedPeriod, fetchReports)
onMounted(fetchReports)

// ── Helpers ──────────────────────────────────────────────────────────────────
const currency = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const currencyFull = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const initials = (name: string) =>
  (name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '??'

const avatarPalette = [
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#EAF3DE', fg: '#3B6D11' },
  { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#FBEAF0', fg: '#72243E' },
  { bg: '#E1F5EE', fg: '#085041' },
]
const avatarColor = (seed: string): { bg: string; fg: string } => {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return avatarPalette[h % avatarPalette.length] ?? { bg: '#F1EFE8', fg: '#444441' }
}

// ── KPIs derivados ───────────────────────────────────────────────────────────
const profitMargin = computed(() => {
  if (!summary.value.revenue) return 0
  return (summary.value.netProfit / summary.value.revenue) * 100
})

const avgTicket = computed(() => {
  const n = summary.value.completedOrders || summary.value.paidTransactionsCount || 0
  if (!n) return 0
  return summary.value.revenue / n
})

// Delta: compara primeira vs segunda metade do período
const trendDeltas = computed(() => {
  const empty = { revenue: null as number | null, expense: null as number | null, profit: null as number | null }
  if (trend.value.length < 4) return empty
  const mid = Math.floor(trend.value.length / 2)
  const first = trend.value.slice(0, mid)
  const second = trend.value.slice(mid)
  const sum = (arr: TrendPoint[], key: 'revenue' | 'expense') =>
    arr.reduce((s, t) => s + (t[key] || 0), 0)
  const pct = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr === 0 ? 0 : null
    return ((curr - prev) / prev) * 100
  }
  const rev1 = sum(first, 'revenue'), rev2 = sum(second, 'revenue')
  const exp1 = sum(first, 'expense'), exp2 = sum(second, 'expense')
  const prof1 = rev1 - exp1, prof2 = rev2 - exp2
  return { revenue: pct(rev2, rev1), expense: pct(exp2, exp1), profit: pct(prof2, prof1) }
})

// ── Gráfico fluxo de caixa ───────────────────────────────────────────────────
const chartWidth = 820
const chartHeight = 260
const yAxisWidth = 60
const plotWidth = chartWidth - yAxisWidth

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
  const empty = { revenue: '', expense: '', profit: '', revArea: '', yTicks: [] as { value: number; y: number }[], lastRev: null as any }
  if (!trend.value.length) return empty
  const max = Math.max(1, ...trend.value.map(t => Math.max(t.revenue, t.expense, t.revenue - t.expense)))
  const min = Math.min(0, ...trend.value.map(t => t.revenue - t.expense))
  const range = max - min
  const step = trend.value.length > 1 ? plotWidth / (trend.value.length - 1) : plotWidth
  const pad = 24
  const usable = chartHeight - pad * 2

  const toY = (v: number) => pad + (1 - (v - min) / range) * usable

  const revPts = trend.value.map((t, i) => ({ x: yAxisWidth + i * step, y: toY(t.revenue), value: t.revenue }))
  const expPts = trend.value.map((t, i) => ({ x: yAxisWidth + i * step, y: toY(t.expense), value: t.expense }))
  const profPts = trend.value.map((t, i) => ({ x: yAxisWidth + i * step, y: toY(t.revenue - t.expense), value: t.revenue - t.expense }))

  const revenue = smoothPath(revPts)
  const expense = smoothPath(expPts)
  const profit = smoothPath(profPts)

  const firstRev = revPts[0]
  const lastRev = revPts[revPts.length - 1]
  const revArea = revenue && firstRev && lastRev
    ? `${revenue} L ${lastRev.x.toFixed(1)} ${chartHeight - pad} L ${firstRev.x.toFixed(1)} ${chartHeight - pad} Z`
    : ''

  const yTicks = [0, 0.5, 1].map(r => ({ value: max - (r * range), y: pad + r * usable }))

  return { revenue, expense, profit, revArea, yTicks, lastRev: lastRev ?? null }
})

const chartXLabels = computed(() => {
  if (!trend.value.length) return [] as { date: string; x: number }[]
  const step = trend.value.length > 1 ? plotWidth / (trend.value.length - 1) : plotWidth
  const every = Math.max(1, Math.ceil(trend.value.length / 7))
  return trend.value.map((t, i) => ({ date: t.date, x: yAxisWidth + i * step, i })).filter(p => p.i % every === 0)
})

// Donut de status dos pedidos
const statusColors: Record<string, string> = {
  'Aguardando': '#94A3B8',
  'Produção':   '#BA7517',
  'Concluído':  '#1D9E75',
  'Entregue':   '#185FA5',
  'Cancelado':  '#A32D2D',
}

const totalProduction = computed(() =>
  productionStats.value.reduce((s, p) => s + Number(p.count || 0), 0)
)

// Donut SVG paths
const donutSegments = computed(() => {
  const total = totalProduction.value
  if (!total) return [] as { path: string; color: string; label: string; count: number; pct: number }[]
  const radius = 56
  const innerRadius = 40
  const cx = 70, cy = 70
  let angle = -Math.PI / 2

  return productionStats.value.filter(p => p.count > 0).map(p => {
    const pct = p.count / total
    const sweep = pct * Math.PI * 2
    const startAngle = angle
    const endAngle = angle + sweep
    angle = endAngle

    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const x3 = cx + innerRadius * Math.cos(endAngle)
    const y3 = cy + innerRadius * Math.sin(endAngle)
    const x4 = cx + innerRadius * Math.cos(startAngle)
    const y4 = cy + innerRadius * Math.sin(startAngle)
    const largeArc = sweep > Math.PI ? 1 : 0

    const path = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z',
    ].join(' ')

    return { path, color: statusColors[p.name] || '#94A3B8', label: p.name, count: p.count, pct: pct * 100 }
  })
})

// Expense breakdown — paleta cíclica
const expensePalette = ['#185FA5', '#BA7517', '#1D9E75', '#534AB7', '#D4537E', '#0F6E56', '#888780']
const expenseTotal = computed(() => expenseBreakdown.value.reduce((s, e) => s + Number(e.total || 0), 0))
const sortedExpenses = computed(() =>
  [...expenseBreakdown.value].sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
)

// Period pills
const PERIODS = [
  { key: '7d',  label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: '12m', label: '12 meses' },
] as const

const periodLabel = computed(() => {
  if (useCustomRange.value) {
    return `${new Date(customStartDate.value).toLocaleDateString('pt-BR')} a ${new Date(customEndDate.value).toLocaleDateString('pt-BR')}`
  }
  return PERIODS.find(p => p.key === selectedPeriod.value)?.label || ''
})

// ── Helpers para MoM/YoY ─────────────────────────────────────────────────────
const deltaVs = (current: number, previous: number | undefined): number | null => {
  if (previous === undefined || previous === null) return null
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

// ── Status pipeline ──────────────────────────────────────────────────────────
const pipelineStatusLabel: Record<string, string> = {
  DRAFT:     'Rascunho',
  SENT:      'Enviado',
  APPROVED:  'Aprovado',
  REJECTED:  'Rejeitado',
  CONVERTED: 'Convertido',
}
const pipelineStatusColor: Record<string, string> = {
  DRAFT:     '#94A3B8',
  SENT:      '#185FA5',
  APPROVED:  '#1D9E75',
  REJECTED:  '#A32D2D',
  CONVERTED: '#534AB7',
}

const pipelineSorted = computed(() => {
  const order = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED']
  return [...estimatePipeline.value].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
})

const pipelineMaxCount = computed(() =>
  Math.max(1, ...pipelineSorted.value.map(p => p.count))
)

// ── Aging cores ──────────────────────────────────────────────────────────────
const agingColor = (bucket: string): string => ({
  '0-30':  '#BA7517',
  '31-60': '#D4537E',
  '61-90': '#A32D2D',
  '90+':   '#501313',
} as Record<string, string>)[bucket] || '#94A3B8'

const agingTotal = computed(() => invoiceAging.value.reduce((s, a) => s + a.total, 0))

// ── Vendas por tipo cores ────────────────────────────────────────────────────
const typeColor = (key: string): string => ({
  service:    '#185FA5',
  plotter:    '#BA7517',
  cutting:    '#534AB7',
  embroidery: '#D4537E',
  pdv:        '#1D9E75',
} as Record<string, string>)[key] || '#94A3B8'

const salesByTypeTotal = computed(() => salesByType.value.reduce((s, t) => s + t.total, 0))

// ── Tabs ─────────────────────────────────────────────────────────────────────
type TabKey = 'overview' | 'financial' | 'sales' | 'production'
const activeTab = ref<TabKey>('overview')

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview',   label: 'Visão geral', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { key: 'financial',  label: 'Financeiro',  icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'sales',      label: 'Vendas',      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { key: 'production', label: 'Produção',    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
]
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header -->
      <div class="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Relatórios &amp; BI</div>
          <div class="text-xs text-slate-500 mt-0.5">Análise financeira — {{ periodLabel }}</div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div v-if="!useCustomRange" class="flex gap-1 bg-slate-50 p-1 rounded-full border border-slate-200">
            <button v-for="p in PERIODS" :key="p.key"
                    @click="selectedPeriod = p.key"
                    :class="['px-3.5 py-1.5 rounded-full text-xs transition-colors',
                      selectedPeriod === p.key
                        ? 'bg-white text-slate-900 font-medium shadow-sm'
                        : 'text-slate-600 hover:text-slate-900']">
              {{ p.label }}
            </button>
          </div>

          <div class="flex items-center gap-1.5">
            <input type="date" v-model="customStartDate" @change="applyCustomRange"
                   class="py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-400 transition-colors"/>
            <span class="text-xs text-slate-400">até</span>
            <input type="date" v-model="customEndDate" @change="applyCustomRange"
                   class="py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-400 transition-colors"/>
            <button v-if="useCustomRange" @click="clearCustomRange"
                    class="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Limpar">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 border-b border-slate-200 mb-6 ">
        <button
          v-for="tab in TABS" :key="tab.key"
          @click="activeTab = tab.key"
          :class="['shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px',
            activeTab === tab.key
              ? 'text-slate-900 border-slate-900 font-medium'
              : 'text-slate-500 border-transparent hover:text-slate-900']">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="tab.icon"/></svg>
          {{ tab.label }}
        </button>
      </div>

      <!-- ══ TAB: VISÃO GERAL ══════════════════════════════════════════ -->
      <div v-if="activeTab === 'overview'">

        <!-- KPI Row -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div class="rounded-xl p-5" style="background:#E1F5EE">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs" style="color:#0F6E56">Receita bruta</div>
                <div class="text-2xl font-medium mt-1" style="color:#0F6E56">{{ currency(summary.revenue) }}</div>
              </div>
              <svg class="w-4 h-4 mt-1" :style="{ color: '#1D9E75' }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
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

          <div class="border border-slate-200 rounded-xl p-5">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs text-slate-500">Despesas</div>
                <div class="text-2xl font-medium text-slate-900 mt-1">{{ currency(summary.expenses) }}</div>
              </div>
              <svg class="w-4 h-4 mt-1 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"/></svg>
            </div>
            <div v-if="trendDeltas.expense !== null" class="flex items-center gap-1 text-[11px]">
              <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" :style="{ color: trendDeltas.expense <= 0 ? '#1D9E75' : '#A32D2D' }">
                <path v-if="trendDeltas.expense >= 0" d="M6 2l4 5H8v3H4V7H2z"/>
                <path v-else d="M6 10L2 5h2V2h4v3h2z"/>
              </svg>
              <span :style="{ color: trendDeltas.expense <= 0 ? '#1D9E75' : '#A32D2D' }" class="font-medium">{{ Math.abs(trendDeltas.expense).toFixed(1) }}%</span>
              <span class="text-slate-400">vs. período anterior</span>
            </div>
            <div v-else class="text-[11px] text-slate-400">sem comparativo</div>
          </div>

          <div class="border border-slate-200 rounded-xl p-5">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs text-slate-500">Lucro líquido</div>
                <div class="text-2xl font-medium mt-1" :style="{ color: summary.netProfit >= 0 ? '#1D9E75' : '#A32D2D' }">
                  {{ currency(summary.netProfit) }}
                </div>
              </div>
              <span class="text-[11px] px-1.5 py-0.5 rounded" style="background:#F1F5F9; color:#64748B">
                {{ profitMargin.toFixed(1) }}% margem
              </span>
            </div>
            <div v-if="trendDeltas.profit !== null" class="flex items-center gap-1 text-[11px]">
              <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" :style="{ color: trendDeltas.profit >= 0 ? '#1D9E75' : '#A32D2D' }">
                <path v-if="trendDeltas.profit >= 0" d="M6 2l4 5H8v3H4V7H2z"/>
                <path v-else d="M6 10L2 5h2V2h4v3h2z"/>
              </svg>
              <span :style="{ color: trendDeltas.profit >= 0 ? '#1D9E75' : '#A32D2D' }" class="font-medium">{{ Math.abs(trendDeltas.profit).toFixed(1) }}%</span>
              <span class="text-slate-400">vs. período anterior</span>
            </div>
            <div v-else class="text-[11px] text-slate-400">sem comparativo</div>
          </div>

          <div class="border border-slate-200 rounded-xl p-5">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs text-slate-500">Ticket médio</div>
                <div class="text-2xl font-medium text-slate-900 mt-1">{{ currency(avgTicket) }}</div>
              </div>
              <span class="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                {{ summary.completedOrders || summary.paidTransactionsCount || 0 }} pedidos
              </span>
            </div>
            <div class="text-[11px] text-slate-400">média por venda no período</div>
          </div>
        </div>

        <!-- Gráfico principal -->
        <div class="border border-slate-200 rounded-xl p-6 mb-6">
          <div class="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <div class="text-base font-medium text-slate-900">Fluxo de caixa</div>
              <div class="text-xs text-slate-500 mt-0.5">Receita, despesas e saldo diário</div>
            </div>
            <div class="flex gap-4 text-xs">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm" style="background:#1D9E75"></span>
                <span class="text-slate-500">Receita</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm" style="background:#A32D2D"></span>
                <span class="text-slate-500">Despesas</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm border border-dashed" style="border-color:#185FA5; background:transparent"></span>
                <span class="text-slate-500">Saldo</span>
              </div>
            </div>
          </div>

          <div class="relative">
            <svg v-if="trend.length > 0" :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                 class="w-full block" :style="{ height: chartHeight + 'px' }">
              <defs>
                <linearGradient id="revGradReports" x1="0" y1="0" x2="0" y2="1">
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
                  {{ currency(tick.value) }}
                </text>
              </g>
              <path :d="chartPath.revArea" fill="url(#revGradReports)"/>
              <path :d="chartPath.profit" fill="none" stroke="#185FA5" stroke-width="1.4" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round"/>
              <path :d="chartPath.expense" fill="none" stroke="#A32D2D" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
              <path :d="chartPath.revenue" fill="none" stroke="#1D9E75" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
              <g v-if="chartPath.lastRev">
                <circle :cx="chartPath.lastRev.x" :cy="chartPath.lastRev.y" r="7" fill="#1D9E75" fill-opacity="0.2"/>
                <circle :cx="chartPath.lastRev.x" :cy="chartPath.lastRev.y" r="3.5" fill="#1D9E75"/>
                <circle :cx="chartPath.lastRev.x" :cy="chartPath.lastRev.y" r="1.5" fill="white"/>
              </g>
            </svg>
            <div v-else class="flex items-center justify-center text-sm text-slate-400" :style="{ height: chartHeight + 'px' }">Sem dados no período</div>
          </div>
          <div v-if="trend.length > 0" class="flex justify-between text-xs text-slate-400 mt-2" :style="{ paddingLeft: yAxisWidth + 'px', paddingRight: '8px' }">
            <span v-for="label in chartXLabels" :key="label.x">{{ label.date }}</span>
          </div>
        </div>

        <!-- Comparativo -->
        <div v-if="!useCustomRange && (summaryPrev || summaryYearAgo)" class="border border-slate-200 rounded-xl p-6">
          <div class="mb-5">
            <div class="text-base font-medium text-slate-900">Comparativo de períodos</div>
            <div class="text-xs text-slate-500 mt-0.5">Atual vs anterior vs ano passado</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="border border-slate-200 rounded-lg p-4">
              <div class="text-xs text-slate-500 mb-3">Receita</div>
              <div class="space-y-2">
                <div class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">Atual</span>
                  <span class="text-sm font-medium text-slate-900">{{ currency(summary.revenue) }}</span>
                </div>
                <div v-if="summaryPrev" class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">Anterior</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm text-slate-600">{{ currency(summaryPrev.revenue) }}</span>
                    <span v-if="deltaVs(summary.revenue, summaryPrev.revenue) !== null" class="text-[10px] font-medium"
                          :style="{ color: (deltaVs(summary.revenue, summaryPrev.revenue) ?? 0) >= 0 ? '#1D9E75' : '#A32D2D' }">
                      {{ (deltaVs(summary.revenue, summaryPrev.revenue) ?? 0) >= 0 ? '↑' : '↓' }} {{ Math.abs(deltaVs(summary.revenue, summaryPrev.revenue) ?? 0).toFixed(1) }}%
                    </span>
                  </div>
                </div>
                <div v-if="summaryYearAgo" class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">1 ano atrás</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm text-slate-600">{{ currency(summaryYearAgo.revenue) }}</span>
                    <span v-if="deltaVs(summary.revenue, summaryYearAgo.revenue) !== null" class="text-[10px] font-medium"
                          :style="{ color: (deltaVs(summary.revenue, summaryYearAgo.revenue) ?? 0) >= 0 ? '#1D9E75' : '#A32D2D' }">
                      {{ (deltaVs(summary.revenue, summaryYearAgo.revenue) ?? 0) >= 0 ? '↑' : '↓' }} {{ Math.abs(deltaVs(summary.revenue, summaryYearAgo.revenue) ?? 0).toFixed(1) }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="border border-slate-200 rounded-lg p-4">
              <div class="text-xs text-slate-500 mb-3">Despesas</div>
              <div class="space-y-2">
                <div class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">Atual</span>
                  <span class="text-sm font-medium text-slate-900">{{ currency(summary.expenses) }}</span>
                </div>
                <div v-if="summaryPrev" class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">Anterior</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm text-slate-600">{{ currency(summaryPrev.expenses) }}</span>
                    <span v-if="deltaVs(summary.expenses, summaryPrev.expenses) !== null" class="text-[10px] font-medium"
                          :style="{ color: (deltaVs(summary.expenses, summaryPrev.expenses) ?? 0) <= 0 ? '#1D9E75' : '#A32D2D' }">
                      {{ (deltaVs(summary.expenses, summaryPrev.expenses) ?? 0) >= 0 ? '↑' : '↓' }} {{ Math.abs(deltaVs(summary.expenses, summaryPrev.expenses) ?? 0).toFixed(1) }}%
                    </span>
                  </div>
                </div>
                <div v-if="summaryYearAgo" class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">1 ano atrás</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm text-slate-600">{{ currency(summaryYearAgo.expenses) }}</span>
                    <span v-if="deltaVs(summary.expenses, summaryYearAgo.expenses) !== null" class="text-[10px] font-medium"
                          :style="{ color: (deltaVs(summary.expenses, summaryYearAgo.expenses) ?? 0) <= 0 ? '#1D9E75' : '#A32D2D' }">
                      {{ (deltaVs(summary.expenses, summaryYearAgo.expenses) ?? 0) >= 0 ? '↑' : '↓' }} {{ Math.abs(deltaVs(summary.expenses, summaryYearAgo.expenses) ?? 0).toFixed(1) }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="border border-slate-200 rounded-lg p-4">
              <div class="text-xs text-slate-500 mb-3">Lucro líquido</div>
              <div class="space-y-2">
                <div class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">Atual</span>
                  <span class="text-sm font-medium" :style="{ color: summary.netProfit >= 0 ? '#1D9E75' : '#A32D2D' }">{{ currency(summary.netProfit) }}</span>
                </div>
                <div v-if="summaryPrev" class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">Anterior</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm text-slate-600">{{ currency(summaryPrev.netProfit) }}</span>
                    <span v-if="deltaVs(summary.netProfit, summaryPrev.netProfit) !== null" class="text-[10px] font-medium"
                          :style="{ color: (deltaVs(summary.netProfit, summaryPrev.netProfit) ?? 0) >= 0 ? '#1D9E75' : '#A32D2D' }">
                      {{ (deltaVs(summary.netProfit, summaryPrev.netProfit) ?? 0) >= 0 ? '↑' : '↓' }} {{ Math.abs(deltaVs(summary.netProfit, summaryPrev.netProfit) ?? 0).toFixed(1) }}%
                    </span>
                  </div>
                </div>
                <div v-if="summaryYearAgo" class="flex items-baseline justify-between">
                  <span class="text-[11px] text-slate-400">1 ano atrás</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm text-slate-600">{{ currency(summaryYearAgo.netProfit) }}</span>
                    <span v-if="deltaVs(summary.netProfit, summaryYearAgo.netProfit) !== null" class="text-[10px] font-medium"
                          :style="{ color: (deltaVs(summary.netProfit, summaryYearAgo.netProfit) ?? 0) >= 0 ? '#1D9E75' : '#A32D2D' }">
                      {{ (deltaVs(summary.netProfit, summaryYearAgo.netProfit) ?? 0) >= 0 ? '↑' : '↓' }} {{ Math.abs(deltaVs(summary.netProfit, summaryYearAgo.netProfit) ?? 0).toFixed(1) }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ TAB: FINANCEIRO ══════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'financial'">

        <!-- Ações de download -->
        <div class="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div class="text-xs text-slate-500">Relatório financeiro completo</div>
          <div class="flex items-center gap-2">
            <button @click="exportXlsx"
                    class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Baixar Excel
            </button>
            <button @click="exportPdf"
                    :title="plan.hasPdf ? '' : 'Geração de PDF não disponível no plano atual'"
                    :class="['inline-flex items-center gap-1.5 text-sm font-medium rounded-full px-4 py-2 transition-colors',
                      plan.hasPdf
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
              <svg v-if="plan.hasPdf" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <svg v-else class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              Baixar PDF
            </button>
          </div>
        </div>

        <!-- Despesas por categoria -->
        <div class="border border-slate-200 rounded-xl p-6 mb-6">
          <div class="flex items-baseline justify-between mb-5">
            <div>
              <div class="text-base font-medium text-slate-900">Despesas por categoria</div>
              <div class="text-xs text-slate-500 mt-0.5">Distribuição no período</div>
            </div>
            <div class="text-right">
              <div class="text-lg font-medium text-slate-900">{{ currency(expenseTotal) }}</div>
              <div class="text-[11px] text-slate-400">total</div>
            </div>
          </div>

          <div v-if="sortedExpenses.length === 0" class="flex flex-col items-center justify-center py-10 text-center">
            <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div class="text-sm text-slate-500">Sem despesas no período</div>
          </div>

          <div v-else class="space-y-3">
            <div v-for="(item, i) in sortedExpenses" :key="item.category">
              <div class="flex items-center justify-between text-sm mb-1.5">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: expensePalette[i % expensePalette.length] }"></span>
                  <span class="text-slate-700 truncate">{{ item.category || 'Sem categoria' }}</span>
                </div>
                <div class="flex items-baseline gap-2 shrink-0">
                  <span class="text-[11px] text-slate-400">{{ expenseTotal > 0 ? Math.round((Number(item.total || 0) / expenseTotal) * 100) : 0 }}%</span>
                  <span class="font-medium text-slate-900">{{ currency(item.total) }}</span>
                </div>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                     :style="{ width: (Number(item.total || 0) / (expenseTotal || 1) * 100) + '%', background: expensePalette[i % expensePalette.length] }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Aging -->
        <div class="border border-slate-200 rounded-xl p-6">
          <div class="flex items-baseline justify-between mb-5 flex-wrap gap-3">
            <div>
              <div class="text-base font-medium text-slate-900">Aging de contas a receber</div>
              <div class="text-xs text-slate-500 mt-0.5">Faturas vencidas por faixa de atraso</div>
            </div>
            <div class="text-right">
              <div class="text-lg font-medium" :style="{ color: agingTotal > 0 ? '#A32D2D' : '#1D9E75' }">{{ currency(agingTotal) }}</div>
              <div class="text-[11px] text-slate-400">em atraso</div>
            </div>
          </div>

          <div v-if="agingTotal === 0" class="flex items-center justify-center py-8 text-sm text-slate-400">
            <svg class="w-4 h-4 mr-2" style="color:#1D9E75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Nenhuma fatura em atraso
          </div>

          <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="b in invoiceAging" :key="b.bucket"
                 class="rounded-lg p-4 border border-slate-200">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-slate-500">{{ b.bucket }} dias</span>
                <span class="w-1.5 h-1.5 rounded-full" :style="{ background: agingColor(b.bucket) }"></span>
              </div>
              <div class="text-xl font-medium" :style="{ color: b.total > 0 ? agingColor(b.bucket) : '#CBD5E1' }">
                {{ currency(b.total) }}
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">{{ b.count }} {{ b.count === 1 ? 'fatura' : 'faturas' }}</div>
              <div class="h-1 rounded-full bg-slate-100 mt-3 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                     :style="{ width: agingTotal > 0 ? (b.total / agingTotal * 100) + '%' : '0%', background: agingColor(b.bucket) }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ TAB: VENDAS ═══════════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'sales'">

        <!-- Ações de download -->
        <div class="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div class="text-xs text-slate-500">Pipeline, conversão e performance de vendedores</div>
          <div class="flex items-center gap-2">
            <button @click="exportSales"
                    class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Baixar Excel
            </button>
          </div>
        </div>

        <!-- Pipeline -->
        <div class="border border-slate-200 rounded-xl p-6 mb-6">
          <div class="flex items-baseline justify-between mb-5 flex-wrap gap-3">
            <div>
              <div class="text-base font-medium text-slate-900">Pipeline de orçamentos</div>
              <div class="text-xs text-slate-500 mt-0.5">Taxa de conversão do funil de vendas</div>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-medium" :style="{ color: conversionRate >= 50 ? '#1D9E75' : conversionRate >= 30 ? '#BA7517' : '#A32D2D' }">
                {{ conversionRate.toFixed(1) }}%
              </span>
              <span class="text-xs text-slate-400">de conversão</span>
            </div>
          </div>

          <div v-if="pipelineSorted.length === 0" class="flex items-center justify-center py-10 text-sm text-slate-400">
            Sem orçamentos no período
          </div>

          <div v-else class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div v-for="p in pipelineSorted" :key="p.status"
                 class="rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs" :style="{ color: pipelineStatusColor[p.status] || '#64748B' }">
                  {{ pipelineStatusLabel[p.status] || p.status }}
                </span>
                <span class="w-1.5 h-1.5 rounded-full" :style="{ background: pipelineStatusColor[p.status] || '#94A3B8' }"></span>
              </div>
              <div class="text-2xl font-medium text-slate-900">{{ p.count }}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">{{ currency(p.total) }}</div>
              <div class="h-1 rounded-full bg-slate-100 mt-3 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                     :style="{ width: (p.count / pipelineMaxCount) * 100 + '%', background: pipelineStatusColor[p.status] || '#94A3B8' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Vendas por tipo -->
        <div class="border border-slate-200 rounded-xl p-6 mb-6">
          <div class="flex items-baseline justify-between mb-5 flex-wrap gap-3">
            <div>
              <div class="text-base font-medium text-slate-900">Vendas por tipo de serviço</div>
              <div class="text-xs text-slate-500 mt-0.5">Mix de produtos no período</div>
            </div>
            <div class="text-right">
              <div class="text-lg font-medium text-slate-900">{{ currency(salesByTypeTotal) }}</div>
              <div class="text-[11px] text-slate-400">total</div>
            </div>
          </div>

          <div v-if="salesByType.length === 0" class="flex items-center justify-center py-8 text-sm text-slate-400">
            Sem vendas no período
          </div>

          <div v-else>
            <div class="flex h-2.5 rounded-full overflow-hidden mb-4 bg-slate-100">
              <div v-for="t in salesByType" :key="`bar-${t.key}`"
                   class="transition-all duration-500"
                   :style="{ width: (t.total / (salesByTypeTotal || 1) * 100) + '%', background: typeColor(t.key) }"
                   :title="`${t.type}: ${currency(t.total)}`"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
              <div v-for="t in salesByType" :key="t.key" class="flex items-center gap-3">
                <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: typeColor(t.key) }"></span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline justify-between text-sm">
                    <span class="text-slate-700 truncate">{{ t.type }}</span>
                    <span class="font-medium text-slate-900 shrink-0 ml-2">{{ currency(t.total) }}</span>
                  </div>
                  <div class="flex items-baseline justify-between text-[11px] text-slate-400">
                    <span>{{ t.count }} {{ t.count === 1 ? 'pedido' : 'pedidos' }}</span>
                    <span>{{ salesByTypeTotal > 0 ? Math.round(t.total / salesByTypeTotal * 100) : 0 }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Vendedores + Top clientes -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="border border-slate-200 rounded-xl p-6">
            <div class="mb-4">
              <div class="text-base font-medium text-slate-900">Vendedores</div>
              <div class="text-xs text-slate-500 mt-0.5">Receita gerada no período</div>
            </div>
            <div v-if="salesByPerson.length === 0" class="flex items-center justify-center py-8 text-sm text-slate-400">
              Nenhuma venda com vendedor atribuído
            </div>
            <div v-else class="space-y-2">
              <div v-for="(s, i) in salesByPerson" :key="s.userId"
                   class="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                <span class="w-5 text-xs text-slate-400 font-medium">#{{ i + 1 }}</span>
                <span class="w-9 h-9 rounded-full text-xs font-medium flex items-center justify-center shrink-0"
                      :style="{ background: avatarColor(s.name).bg, color: avatarColor(s.name).fg }">
                  {{ initials(s.name) }}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-slate-900 font-medium truncate">{{ s.name }}</div>
                  <div class="text-[11px] text-slate-400">
                    {{ s.orderCount }} {{ s.orderCount === 1 ? 'pedido' : 'pedidos' }}
                    <span v-if="s.commission > 0"> · comissão {{ currency(s.commission) }}</span>
                  </div>
                </div>
                <span class="text-sm font-medium text-slate-900 shrink-0">{{ currencyFull(s.revenue) }}</span>
              </div>
            </div>
          </div>

          <div class="border border-slate-200 rounded-xl p-6">
            <div class="flex items-baseline justify-between mb-4">
              <div>
                <div class="text-base font-medium text-slate-900">Maiores clientes</div>
                <div class="text-xs text-slate-500 mt-0.5">Ranking por receita</div>
              </div>
              <span class="text-xs text-slate-400">top {{ topCustomers.length }}</span>
            </div>
            <div v-if="topCustomers.length === 0" class="flex items-center justify-center py-8 text-sm text-slate-400">
              Sem clientes com faturamento
            </div>
            <div v-else class="space-y-2">
              <div v-for="(c, i) in topCustomers.slice(0, 5)" :key="c.name"
                   class="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                <span class="w-5 text-xs text-slate-400 font-medium">#{{ i + 1 }}</span>
                <span class="w-9 h-9 rounded-full text-xs font-medium flex items-center justify-center shrink-0"
                      :style="{ background: avatarColor(c.name).bg, color: avatarColor(c.name).fg }">
                  {{ initials(c.name) }}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-slate-900 font-medium truncate">{{ c.name }}</div>
                  <div class="h-1 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500"
                         :style="{ width: (Number(c.total) / Math.max(1, Number(topCustomers[0]?.total || 1))) * 100 + '%', background: '#1D9E75' }"></div>
                  </div>
                </div>
                <span class="text-sm font-medium text-slate-900 shrink-0">{{ currencyFull(Number(c.total || 0)) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ TAB: PRODUÇÃO ═════════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'production'">

        <!-- Ações de download -->
        <div class="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div class="text-xs text-slate-500">Status de pedidos, produtores e estoque</div>
          <div class="flex items-center gap-2">
            <button @click="exportProduction"
                    class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Baixar Excel
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 mb-6">
          <!-- Donut -->
          <div class="border border-slate-200 rounded-xl p-6">
            <div class="mb-4">
              <div class="text-base font-medium text-slate-900">Status de produção</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ totalProduction }} pedidos no total</div>
            </div>
            <div v-if="productionStats.length === 0" class="flex items-center justify-center py-8 text-sm text-slate-400">
              Sem pedidos registrados
            </div>
            <div v-else class="flex items-center gap-5">
              <div class="shrink-0 relative">
                <svg viewBox="0 0 140 140" class="w-[140px] h-[140px]">
                  <circle cx="70" cy="70" r="48" fill="none" stroke="#F1F5F9" stroke-width="16"/>
                  <path v-for="(seg, idx) in donutSegments" :key="idx" :d="seg.path" :fill="seg.color"/>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div class="text-2xl font-medium text-slate-900 leading-none">{{ totalProduction }}</div>
                  <div class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">pedidos</div>
                </div>
              </div>
              <div class="flex-1 min-w-0 space-y-2">
                <div v-for="seg in donutSegments" :key="seg.label" class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2 h-2 rounded-sm" :style="{ background: seg.color }"></span>
                    <span class="text-slate-700 truncate">{{ seg.label }}</span>
                  </div>
                  <div class="flex items-baseline gap-1.5 shrink-0">
                    <span class="font-medium text-slate-900">{{ seg.count }}</span>
                    <span class="text-[10px] text-slate-400">{{ seg.pct.toFixed(0) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Estoque -->
          <div class="border border-slate-200 rounded-xl p-6">
            <div class="mb-3">
              <div class="text-base font-medium text-slate-900">Estoque</div>
              <div class="text-xs text-slate-500 mt-0.5">Valor e alertas</div>
            </div>
            <div class="space-y-3">
              <div class="flex items-baseline justify-between">
                <span class="text-xs text-slate-500">Valor em estoque</span>
                <span class="text-base font-medium text-slate-900">{{ currency(summary.inventoryValue) }}</span>
              </div>
              <div class="flex items-baseline justify-between">
                <span class="text-xs text-slate-500">Itens com estoque baixo</span>
                <span class="text-base font-medium" :style="{ color: summary.lowStockCount > 0 ? '#A32D2D' : '#1D9E75' }">
                  {{ summary.lowStockCount || 0 }}
                </span>
              </div>
              <div class="flex items-baseline justify-between">
                <span class="text-xs text-slate-500">Pedidos em produção</span>
                <span class="text-base font-medium text-slate-900">{{ summary.pendingOrders || 0 }}</span>
              </div>
              <div class="flex items-baseline justify-between">
                <span class="text-xs text-slate-500">Pedidos concluídos</span>
                <span class="text-base font-medium" style="color:#0F6E56">{{ summary.completedOrders || 0 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Produtores -->
        <div class="border border-slate-200 rounded-xl p-6">
          <div class="mb-4">
            <div class="text-base font-medium text-slate-900">Produtores</div>
            <div class="text-xs text-slate-500 mt-0.5">Pedidos produzidos no período</div>
          </div>
          <div v-if="productionByPerson.length === 0" class="flex items-center justify-center py-8 text-sm text-slate-400">
            Nenhum pedido com produtor atribuído
          </div>
          <div v-else class="space-y-2">
            <div v-for="(p, i) in productionByPerson" :key="p.userId"
                 class="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
              <span class="w-5 text-xs text-slate-400 font-medium">#{{ i + 1 }}</span>
              <span class="w-9 h-9 rounded-full text-xs font-medium flex items-center justify-center shrink-0"
                    :style="{ background: avatarColor(p.name).bg, color: avatarColor(p.name).fg }">
                {{ initials(p.name) }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-slate-900 font-medium truncate">{{ p.name }}</div>
                <div class="text-[11px] text-slate-400">{{ currencyFull(p.revenue) }} em produção</div>
              </div>
              <span class="text-lg font-medium text-slate-900 shrink-0">{{ p.orderCount }}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
