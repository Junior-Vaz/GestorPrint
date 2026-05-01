<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useConfirm } from '../composables/useConfirm'
import { useUiStore } from '../stores/ui'
import { usePlanStore } from '../stores/plan'
import { usePermissionsStore } from '../stores/permissions'
import PaginationControls from '../components/shared/PaginationControls.vue'

const ui = useUiStore()
const plan = usePlanStore()
const perms = usePermissionsStore()
const { confirm: confirmDialog } = useConfirm()

const stats = ref({
  revenue: 0,
  expenses: 0,
  netProfit: 0,
  paidTransactionsCount: 0,
  pendingTransactionsCount: 0,
  revenueToday: 0,
  revenueMonth: 0,
  totalReceivablesPending: 0,
  totalReceivablesPendingCount: 0,
  totalPayablesPending: 0,
  totalPayablesPendingCount: 0,
  loading: true,
})

interface TrendPoint { date: string; weekday: string; fullDate: string; revenue: number; expense: number }
const trend = ref<TrendPoint[]>([])
const expenseBreakdown = ref<{ category: string; total: number }[]>([])
const topCustomers = ref<{ name: string; total: number }[]>([])
const hasTrend = ref(false)

const showSangriaModal = ref(false)
const sangriaForm = ref({ amount: 0, description: '' })

const exportReport = () => {
  if (!plan.hasReports) {
    plan.setLimitError('Exportação Excel requer o módulo de Relatórios.')
    return
  }
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/reports/export/xlsx?period=30d&token=${token}`, '_blank')
}

const transactions = ref<any[]>([])
const txPage = ref(1)
const txLimit = ref(20)
const txTotal = ref(0)
const txTotalPages = ref(0)
const txSearch = ref('')
const txStatus = ref('')

const fetchTransactions = async () => {
  // Não puxa histórico se o user não tem permissão de ver financeiro —
  // evita 403 + popup ao entrar na tela. Sidebar já filtra mas é defesa
  // em camadas (admin pode revogar a permissão com session ativa).
  if (!perms.can.view('financial')) return
  try {
    const params = new URLSearchParams({ page: String(txPage.value), limit: String(txLimit.value) })
    if (txSearch.value) params.set('search', txSearch.value)
    if (txStatus.value) params.set('status', txStatus.value)
    const histRes = await apiFetch(`/api/payments/history?${params}`, { silentOn403: true })
    if (!histRes.ok) return
    const result = await histRes.json()
    if (Array.isArray(result)) {
      transactions.value = result; txTotal.value = result.length; txTotalPages.value = 1
    } else {
      transactions.value = result.data; txTotal.value = result.total; txTotalPages.value = result.totalPages
    }
  } catch (e) { console.error('Error fetching transactions', e) }
}

const fetchFinancialData = async () => {
  stats.value.loading = true
  try {
    // silentOn403: a tela de Fluxo de Caixa abre mesmo em planos sem feature
    // `reports` — apenas os gráficos ficam vazios. Suprime o popup "Recurso
    // não disponível" que aparecia toda vez que carregava em planos básicos.
    const [sumRes, statsRes] = await Promise.all([
      apiFetch('/api/reports/summary',         { silentOn403: true }),
      apiFetch('/api/reports/stats?period=30d', { silentOn403: true }),
    ])
    if (sumRes.ok) {
      const data = await sumRes.json()
      stats.value = { ...data, loading: false }
    }
    if (statsRes.ok) {
      const d = await statsRes.json()
      trend.value = d.salesTrend || []
      expenseBreakdown.value = d.expenseBreakdown || []
      topCustomers.value = d.topCustomers || []
      hasTrend.value = trend.value.length > 0
    }
    await fetchTransactions()
  } catch (e) {
    console.error('Error fetching financial stats', e)
  } finally {
    stats.value.loading = false
  }
}

const debouncedTxSearch = useDebounceFn(() => { txPage.value = 1; fetchTransactions() }, 300)
watch(txSearch, debouncedTxSearch)
watch([txPage, txLimit, txStatus], fetchTransactions)

const saveSangria = async () => {
  if (sangriaForm.value.amount <= 0) return
  try {
    const res = await apiFetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: `Sangria: ${sangriaForm.value.description || 'Retirada de Caixa'}`,
        amount: sangriaForm.value.amount,
        category: 'Sangria',
        date: new Date().toISOString(),
      }),
    })
    if (res.ok) {
      showSangriaModal.value = false
      sangriaForm.value = { amount: 0, description: '' }
      await fetchFinancialData()
    }
  } catch (e) { console.error('Error saving sangria', e) }
}

const confirmPayment = async (id: number) => {
  if (!await confirmDialog('Deseja confirmar o pagamento manual desta transação?', { title: 'Confirmar pagamento', confirmLabel: 'Confirmar', danger: false })) return
  try {
    const res = await apiFetch(`/api/payments/confirm/${id}`, { method: 'POST' })
    if (res.ok) await fetchFinancialData()
  } catch (e) { console.error('Error confirming payment', e) }
}

const currency = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const currencyFull = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Chart ──────────────────────────────────────────────────────────────────
const chartWidth = 720
const chartHeight = 220
const yAxisWidth = 56
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
  const empty = { revenue: '', expense: '', revArea: '', expArea: '', yTicks: [] as { value: number; y: number }[], lastRev: null as any, lastExp: null as any }
  if (!trend.value.length) return empty

  const max = Math.max(1, ...trend.value.map(t => Math.max(t.revenue, t.expense)))
  const step = trend.value.length > 1 ? plotWidth / (trend.value.length - 1) : plotWidth
  const pad = 20
  const usable = chartHeight - pad * 2

  const revPts = trend.value.map((t, i) => ({ x: yAxisWidth + i * step, y: pad + (1 - t.revenue / max) * usable, value: t.revenue }))
  const expPts = trend.value.map((t, i) => ({ x: yAxisWidth + i * step, y: pad + (1 - t.expense / max) * usable, value: t.expense }))

  const revenue = smoothPath(revPts)
  const expense = smoothPath(expPts)

  const firstRev = revPts[0]
  const lastRev = revPts[revPts.length - 1]
  const firstExp = expPts[0]
  const lastExp = expPts[expPts.length - 1]

  const revArea = revenue && firstRev && lastRev
    ? `${revenue} L ${lastRev.x.toFixed(1)} ${chartHeight - pad} L ${firstRev.x.toFixed(1)} ${chartHeight - pad} Z`
    : ''
  const expArea = expense && firstExp && lastExp
    ? `${expense} L ${lastExp.x.toFixed(1)} ${chartHeight - pad} L ${firstExp.x.toFixed(1)} ${chartHeight - pad} Z`
    : ''

  const yTicks = [0, 0.5, 1].map(r => ({ value: max * (1 - r), y: pad + r * usable }))

  return { revenue, expense, revArea, expArea, yTicks, lastRev: lastRev ?? null, lastExp: lastExp ?? null }
})

const chartXLabels = computed(() => {
  if (!trend.value.length) return [] as { date: string; x: number }[]
  const step = trend.value.length > 1 ? plotWidth / (trend.value.length - 1) : plotWidth
  const every = Math.max(1, Math.ceil(trend.value.length / 6))
  return trend.value.map((t, i) => ({ date: t.date, x: yAxisWidth + i * step, i })).filter(p => p.i % every === 0)
})

const expenseTotal = computed(() => expenseBreakdown.value.reduce((s, e) => s + Number(e.total || 0), 0))
const expenseMaxShare = computed(() => Math.max(1, ...expenseBreakdown.value.map(e => Number(e.total || 0))))

// Paleta para as barras de despesas por categoria
const palette = ['#185FA5', '#BA7517', '#1D9E75', '#534AB7', '#D4537E', '#888780']
const colorFor = (i: number) => palette[i % palette.length]

const initials = (name: string) =>
  (name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '??'

onMounted(fetchFinancialData)
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header + CTAs -->
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Fluxo de caixa</div>
          <div class="text-xs text-slate-500 mt-0.5">Entradas, saídas e histórico dos últimos 30 dias</div>
        </div>

        <div class="flex items-center gap-2">
          <button v-if="perms.can.create('financial')" @click="showSangriaModal = true"
                  class="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 border border-slate-200 hover:bg-red-50 rounded-full px-4 py-2 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"/></svg>
            Sangria
          </button>
          <button @click="exportReport"
                  class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Exportar
          </button>
        </div>
      </div>

      <!-- Destaque: Hoje + Mês -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div class="rounded-xl p-5" style="background:#E1F5EE">
          <div class="flex items-baseline justify-between mb-2">
            <span class="text-xs" style="color:#0F6E56">Faturamento hoje</span>
            <span class="text-[11px]" style="color:#0F6E56; opacity:.6">atualizado agora</span>
          </div>
          <div class="text-3xl font-medium" style="color:#0F6E56">
            {{ stats.loading ? '—' : currencyFull(stats.revenueToday) }}
          </div>
        </div>
        <div class="rounded-xl p-5 bg-slate-50">
          <div class="flex items-baseline justify-between mb-2">
            <span class="text-xs text-slate-500">Faturamento este mês</span>
            <span class="text-[11px] text-slate-400">mês corrente</span>
          </div>
          <div class="text-3xl font-medium text-slate-900">
            {{ stats.loading ? '—' : currencyFull(stats.revenueMonth) }}
          </div>
        </div>
      </div>

      <!-- KPIs principais -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500">Entradas</span>
            <span class="w-1.5 h-1.5 rounded-full" style="background:#1D9E75"></span>
          </div>
          <div class="text-2xl font-medium text-slate-900">{{ stats.loading ? '—' : currency(stats.revenue) }}</div>
          <div class="text-[11px] text-slate-400 mt-1">{{ stats.paidTransactionsCount || 0 }} pagas</div>
        </div>

        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500">Saídas</span>
            <span class="w-1.5 h-1.5 rounded-full" style="background:#A32D2D"></span>
          </div>
          <div class="text-2xl font-medium text-slate-900">{{ stats.loading ? '—' : currency(stats.expenses) }}</div>
          <div class="text-[11px] text-slate-400 mt-1">despesas no período</div>
        </div>

        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500">Lucro líquido</span>
          </div>
          <div class="text-2xl font-medium" :style="{ color: stats.netProfit >= 0 ? '#1D9E75' : '#A32D2D' }">
            {{ stats.loading ? '—' : currency(stats.netProfit) }}
          </div>
          <div class="text-[11px] text-slate-400 mt-1">entradas &minus; saídas</div>
        </div>

        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500">Pendentes</span>
            <span class="w-1.5 h-1.5 rounded-full" style="background:#BA7517"></span>
          </div>
          <div class="text-2xl font-medium text-slate-900">{{ stats.loading ? '—' : stats.pendingTransactionsCount }}</div>
          <div class="text-[11px] text-slate-400 mt-1">transações aguardando</div>
        </div>
      </div>

      <!-- Gráfico: Fluxo de caixa -->
      <div class="mb-8 pt-6 border-t border-slate-100">
        <div class="flex items-center justify-between mb-5">
          <div class="text-base font-medium text-slate-900">Fluxo de caixa</div>
          <div class="text-xs text-slate-400">últimos 30 dias</div>
        </div>

        <div class="flex flex-wrap gap-6 mb-4">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-sm" style="background:#1D9E75"></span>
            <span class="text-xs text-slate-500">Entradas</span>
            <span class="text-sm font-medium text-slate-900">{{ currency(stats.revenue) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-sm" style="background:#A32D2D"></span>
            <span class="text-xs text-slate-500">Saídas</span>
            <span class="text-sm font-medium text-slate-900">{{ currency(stats.expenses) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">Saldo</span>
            <span class="text-sm font-medium" :style="{ color: stats.netProfit >= 0 ? '#1D9E75' : '#A32D2D' }">{{ currency(stats.netProfit) }}</span>
          </div>
        </div>

        <div class="relative">
          <svg v-if="hasTrend" :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
               class="w-full block" :style="{ height: chartHeight + 'px' }">
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1D9E75" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="#1D9E75" stop-opacity="0"/>
              </linearGradient>
              <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#A32D2D" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="#A32D2D" stop-opacity="0"/>
              </linearGradient>
            </defs>

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

            <path :d="chartPath.expArea" fill="url(#expGrad)"/>
            <path :d="chartPath.revArea" fill="url(#revGrad)"/>
            <path :d="chartPath.expense" fill="none" stroke="#A32D2D" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
            <path :d="chartPath.revenue" fill="none" stroke="#1D9E75" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>

            <g v-if="chartPath.lastRev">
              <circle :cx="chartPath.lastRev.x" :cy="chartPath.lastRev.y" r="6" fill="#1D9E75" fill-opacity="0.15"/>
              <circle :cx="chartPath.lastRev.x" :cy="chartPath.lastRev.y" r="3" fill="#1D9E75"/>
            </g>
          </svg>

          <div v-else class="flex items-center justify-center text-sm text-slate-400" :style="{ height: chartHeight + 'px' }">
            Sem dados suficientes para exibir o fluxo.
          </div>
        </div>

        <div v-if="hasTrend" class="flex justify-between text-xs text-slate-400 mt-2" :style="{ paddingLeft: yAxisWidth + 'px', paddingRight: '8px' }">
          <span v-for="label in chartXLabels" :key="label.x">{{ label.date }}</span>
        </div>
      </div>

      <!-- Despesas por categoria + Quick links -->
      <div class="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 mb-8 pt-6 border-t border-slate-100">
        <!-- Barras: despesas por categoria -->
        <div>
          <div class="text-base font-medium text-slate-900 mb-4">Despesas por categoria</div>

          <div v-if="expenseBreakdown.length === 0" class="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-xl">
            Sem despesas no período
          </div>

          <div v-else class="space-y-3">
            <div v-for="(item, i) in expenseBreakdown" :key="item.category">
              <div class="flex items-center justify-between text-sm mb-1.5">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: colorFor(i) }"></span>
                  <span class="text-slate-700 truncate">{{ item.category || 'Sem categoria' }}</span>
                </div>
                <div class="flex items-baseline gap-2 shrink-0">
                  <span class="text-[11px] text-slate-400">{{ Math.round(Number(item.total || 0) / expenseTotal * 100) }}%</span>
                  <span class="font-medium text-slate-900">{{ currency(item.total) }}</span>
                </div>
              </div>
              <div class="h-1 rounded-full bg-slate-100">
                <div class="h-full rounded-full transition-all duration-500"
                     :style="{ width: (Number(item.total || 0) / expenseMaxShare * 100) + '%', background: colorFor(i) }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Cards A Receber / A Pagar + Top clientes -->
        <div class="space-y-4">
          <div @click="ui.setTab('receivables')"
               class="bg-slate-50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 transition-colors">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-500">Contas a receber</span>
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/></svg>
            </div>
            <div class="text-xl font-medium text-slate-900">
              {{ stats.loading ? '—' : currency(stats.totalReceivablesPending || 0) }}
            </div>
            <div class="text-[11px] text-slate-400 mt-1">{{ stats.totalReceivablesPendingCount || 0 }} fatura{{ (stats.totalReceivablesPendingCount || 0) === 1 ? '' : 's' }} pendente{{ (stats.totalReceivablesPendingCount || 0) === 1 ? '' : 's' }}</div>
          </div>

          <div @click="ui.setTab('payables')"
               class="bg-slate-50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 transition-colors">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-500">Contas a pagar</span>
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/></svg>
            </div>
            <div class="text-xl font-medium text-slate-900">
              {{ stats.loading ? '—' : currency(stats.totalPayablesPending || 0) }}
            </div>
            <div class="text-[11px] text-slate-400 mt-1">{{ stats.totalPayablesPendingCount || 0 }} conta{{ (stats.totalPayablesPendingCount || 0) === 1 ? '' : 's' }} pendente{{ (stats.totalPayablesPendingCount || 0) === 1 ? '' : 's' }}</div>
          </div>

          <div v-if="topCustomers.length" class="pt-2">
            <div class="text-sm font-medium text-slate-900 mb-3">Maiores clientes</div>
            <div class="flex flex-col gap-2.5">
              <div v-for="c in topCustomers.slice(0, 5)" :key="c.name" class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center shrink-0">
                    {{ initials(c.name) }}
                  </span>
                  <span class="text-slate-700 truncate">{{ c.name }}</span>
                </div>
                <span class="font-medium text-slate-900 shrink-0 ml-2">{{ currency(c.total) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Histórico de transações -->
      <div class="pt-6 border-t border-slate-100">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div class="text-base font-medium text-slate-900">Histórico de transações</div>
          <div class="flex items-center gap-2">
            <div class="relative">
              <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input v-model="txSearch" type="text" placeholder="Buscar…"
                     class="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors w-44">
            </div>
            <select v-model="txStatus"
                    class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors">
              <option value="">Todos status</option>
              <option value="PAID">Pago</option>
              <option value="PENDING">Pendente</option>
            </select>
          </div>
        </div>

        <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div v-if="transactions.length === 0" class="flex flex-col items-center justify-center py-14 text-center">
            <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div class="text-sm font-medium text-slate-900">Sem transações</div>
            <div class="text-xs text-slate-500 mt-1">Ainda não há pagamentos registrados.</div>
          </div>

          <div v-else>
            <div class="grid grid-cols-[120px_1.4fr_90px_120px_120px_110px] gap-4 text-[11px] text-slate-400 px-5 py-3 border-b border-slate-200 bg-slate-50">
              <span>Transação</span>
              <span>Cliente</span>
              <span>Método</span>
              <span class="text-right">Valor</span>
              <span>Status</span>
              <span class="text-right">Data</span>
            </div>

            <div v-for="t in transactions" :key="t.id"
                 class="grid grid-cols-[120px_1.4fr_90px_120px_120px_110px] gap-4 items-center py-3.5 px-5 border-b border-slate-100 last:border-0 text-sm hover:bg-slate-50 transition-colors">
              <span class="text-[11px] text-slate-400">#TRX-{{ t.id }}</span>
              <div class="min-w-0">
                <div class="text-slate-900 font-medium truncate">{{ t.order?.customer?.name || 'Venda avulsa' }}</div>
                <div class="text-[11px] text-slate-400">Pedido #{{ t.orderId }}</div>
              </div>
              <span class="text-xs text-slate-600">{{ t.paymentType }}</span>
              <span class="text-right text-slate-900 font-medium">R$ {{ t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</span>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                      :style="t.status === 'PAID' ? { background: '#E1F5EE', color: '#0F6E56' } : { background: '#FAEEDA', color: '#854F0B' }">
                  <span class="w-1.5 h-1.5 rounded-full" :style="t.status === 'PAID' ? { background: '#1D9E75' } : { background: '#BA7517' }"></span>
                  {{ t.status === 'PAID' ? 'Pago' : 'Pendente' }}
                </span>
                <button v-if="t.status === 'PENDING' && perms.can.edit('financial')" @click="confirmPayment(t.id)"
                        class="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="Confirmar pagamento manual">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/></svg>
                </button>
              </div>
              <span class="text-right text-xs text-slate-500">{{ new Date(t.createdAt).toLocaleDateString('pt-BR') }}</span>
            </div>

            <div class="border-t border-slate-100 px-4">
              <PaginationControls v-model:page="txPage" v-model:limit="txLimit" :total="txTotal" :total-pages="txTotalPages"/>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sangria Modal -->
    <Teleport to="body">
      <div v-if="showSangriaModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showSangriaModal = false"></div>
        <div class="bg-white w-full max-w-sm rounded-2xl border border-slate-200 relative z-10 overflow-hidden">
          <header class="p-6 border-b border-slate-100 text-center">
            <div class="w-11 h-11 bg-red-50 text-red-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"/></svg>
            </div>
            <h3 class="text-base font-medium text-slate-900">Retirada de caixa</h3>
            <p class="text-xs text-slate-500 mt-1">Registre uma sangria rápida</p>
          </header>

          <form @submit.prevent="saveSangria" class="p-6 space-y-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Valor (R$)</label>
              <input v-model.number="sangriaForm.amount" type="number" step="0.01" required autofocus
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-lg text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Motivo</label>
              <input v-model="sangriaForm.description" type="text" placeholder="Ex: almoço, troco…"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div class="flex gap-2 pt-1">
              <button type="button" @click="showSangriaModal = false"
                      class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button type="submit"
                      class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors">
                Confirmar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
