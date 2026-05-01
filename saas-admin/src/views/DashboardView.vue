<template>
  <SidebarLayout>
    <div class="p-6 max-w-7xl mx-auto space-y-5">

      <!-- Header — minimalista, info-densa, vibe operations panel -->
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-[11px] font-mono text-slate-400 uppercase tracking-[0.18em]">Visão geral · {{ now }}</p>
          <h1 class="text-[22px] font-medium text-slate-900 mt-0.5 tracking-tight">Dashboard da plataforma</h1>
        </div>
        <button
          @click="fetchDashboard"
          :disabled="loading"
          class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <svg v-if="!loading" class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <div v-else class="h-3.5 w-3.5 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
          Atualizar
        </button>
      </div>

      <!-- KPI strip — sem rounded grosso, info densa em linha -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div v-for="kpi in kpiCards" :key="kpi.label"
          class="bg-white border border-slate-200 rounded-md p-4">
          <p class="text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">{{ kpi.label }}</p>
          <p class="text-2xl font-medium mt-1.5 tabular-nums" :class="kpi.color">{{ kpi.value }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <!-- Plan Distribution -->
        <div class="xl:col-span-2 bg-white border border-slate-200 rounded-md">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 class="text-sm font-medium text-slate-900">Distribuição por plano</h2>
            <span class="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{{ dashboard?.totalTenants || 0 }} tenants</span>
          </div>

          <div class="p-5">
            <!-- Barra horizontal sem rounded-full agressivo -->
            <div class="flex overflow-hidden h-2 mb-4 bg-slate-100 rounded-sm">
              <div
                v-for="p in planDistribution" :key="p.value"
                :class="[p.color, 'transition-all duration-500']"
                :style="{ width: p.pct + '%' }"
                :title="`${p.label}: ${p.count}`"
              ></div>
            </div>

            <div class="grid grid-cols-2 gap-2 mb-5">
              <div v-for="p in planDistribution" :key="p.value"
                class="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2.5 border border-slate-100">
                <div class="flex items-center gap-2">
                  <span :class="[p.color, 'w-2 h-2 rounded-sm shrink-0']"></span>
                  <span class="text-xs text-slate-700 font-medium">{{ p.label }}</span>
                </div>
                <span class="text-sm font-medium text-slate-900 tabular-nums">{{ p.count }}</span>
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5 pt-4 border-t border-slate-100">
              <span v-for="(count, status) in statusCounts" :key="status"
                :class="['inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider', STATUS_COLORS[status as string] || 'bg-slate-100 text-slate-500']">
                <span>{{ status }}</span>
                <span class="font-medium tabular-nums">{{ count }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Platform Stats -->
        <div class="bg-white border border-slate-200 rounded-md">
          <div class="px-5 py-4 border-b border-slate-100">
            <h2 class="text-sm font-medium text-slate-900">Uso da plataforma</h2>
          </div>
          <div class="p-5 space-y-3">
            <div v-for="stat in platformStats" :key="stat.label"
              class="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <span class="text-xs text-slate-500">{{ stat.label }}</span>
              <span class="text-sm font-medium tabular-nums" :class="stat.color || 'text-slate-900'">{{ stat.value }}</span>
            </div>
            <div class="mt-3 px-3 py-2.5 bg-slate-50 rounded-md border border-slate-100">
              <p class="text-[11px] text-slate-500 leading-relaxed">
                <span class="font-mono uppercase tracking-wider text-slate-400">Note:</span>
                MRR estimado com base no plano atual de cada tenant ativo.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- MRR History — sparkline SVG (sem dependência de chart) -->
      <div class="bg-white border border-slate-200 rounded-md">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium text-slate-900">MRR ao longo do tempo</h2>
            <p class="text-[11px] text-slate-400 mt-0.5">Receita recorrente mensal estimada (últimos 12 meses)</p>
          </div>
          <div v-if="mrrHistory.length" class="text-right">
            <p class="text-xs font-mono text-slate-400 uppercase tracking-wider">Atual</p>
            <p class="text-base font-medium text-slate-900 tabular-nums">
              R$ {{ (mrrHistory[mrrHistory.length - 1]?.mrr || 0).toLocaleString('pt-BR') }}
            </p>
            <p v-if="mrrTrend !== 0" class="text-[11px] tabular-nums" :class="mrrTrend > 0 ? 'text-emerald-700' : 'text-red-700'">
              {{ mrrTrend > 0 ? '↑' : '↓' }} {{ Math.abs(mrrTrend) }}% vs mês anterior
            </p>
          </div>
        </div>
        <div class="p-5">
          <div v-if="mrrLoading" class="flex items-center justify-center py-12">
            <div class="h-5 w-5 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="mrrHistory.length" class="space-y-3">
            <!-- Sparkline -->
            <svg :viewBox="`0 0 ${mrrChart.width} ${mrrChart.height}`" class="w-full h-32" preserveAspectRatio="none">
              <!-- Linha base/zero -->
              <line x1="0" :y1="mrrChart.height" :x2="mrrChart.width" :y2="mrrChart.height" stroke="#e2e8f0" stroke-width="1"/>
              <!-- Área preenchida -->
              <polygon :points="mrrChart.areaPath" fill="#0f172a" fill-opacity="0.06"/>
              <!-- Linha -->
              <polyline :points="mrrChart.linePath" fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round"/>
              <!-- Pontos -->
              <circle v-for="(p, i) in mrrChart.points" :key="i" :cx="p.x" :cy="p.y" r="2.5" fill="#0f172a"/>
            </svg>
            <!-- Labels de mês -->
            <div class="flex justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              <span v-for="(m, i) in mrrHistory" :key="i" :class="i % 2 !== 0 && mrrHistory.length > 6 ? 'opacity-0' : ''">
                {{ formatMonth(m.month) }}
              </span>
            </div>
          </div>
          <div v-else class="text-center py-8 text-xs text-slate-400">Sem dados.</div>
        </div>
      </div>

      <!-- Recent Tenants -->
      <div class="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-sm font-medium text-slate-900">Tenants recentes</h2>
          <RouterLink to="/tenants"
            class="text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors">
            Ver todos →
          </RouterLink>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/50">
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Nome / Slug</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Plano</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Status</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Criado em</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in dashboard?.recentTenants" :key="t.id"
                class="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                <td class="px-5 py-3">
                  <p class="text-sm font-medium text-slate-900">{{ t.name }}</p>
                  <p class="text-[11px] text-slate-400 font-mono mt-0.5">{{ t.slug }}</p>
                </td>
                <td class="px-5 py-3">
                  <span :class="['inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider', PLAN_BADGE[t.plan] || 'bg-slate-100 text-slate-600']">{{ t.plan }}</span>
                </td>
                <td class="px-5 py-3">
                  <span :class="['inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider', STATUS_COLORS[t.planStatus] || 'bg-slate-100 text-slate-500']">{{ t.planStatus }}</span>
                </td>
                <td class="px-5 py-3">
                  <span class="text-xs text-slate-600 font-mono">{{ formatDate(t.createdAt) }}</span>
                </td>
              </tr>
              <tr v-if="!dashboard?.recentTenants?.length && !loading">
                <td colspan="4" class="px-5 py-12 text-center text-xs text-slate-400">
                  Nenhum tenant encontrado.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import SidebarLayout from '../components/SidebarLayout.vue'
import { apiFetch } from '../utils/api'

interface Dashboard {
  totalTenants: number; totalUsers: number; totalOrders: number; totalCustomers: number; mrr: number;
  byPlan: { plan: string; _count: { _all: number } }[];
  byStatus: { planStatus: string; _count: { _all: number } }[];
  recentTenants: { id: number; name: string; slug: string; plan: string; planStatus: string; createdAt: string }[];
}

const PLANS = [
  { value: 'FREE',       label: 'Free',       color: 'bg-slate-400' },
  { value: 'BASIC',      label: 'Basic',      color: 'bg-blue-500'  },
  { value: 'PRO',        label: 'Pro',        color: 'bg-indigo-600' },
  { value: 'ENTERPRISE', label: 'Enterprise', color: 'bg-purple-700' },
]
const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-400', BASIC: 'bg-blue-500', PRO: 'bg-indigo-600', ENTERPRISE: 'bg-purple-700'
}
const PLAN_BADGE: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600', BASIC: 'bg-blue-50 text-blue-700',
  PRO: 'bg-indigo-50 text-indigo-700', ENTERPRISE: 'bg-violet-50 text-violet-700',
}
const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-amber-50 text-amber-700', ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-red-50 text-red-700', CANCELLED: 'bg-slate-100 text-slate-500',
}

// Timestamp do header — atualizado a cada minuto
const now = ref(new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))
setInterval(() => {
  now.value = new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}, 60_000)

const dashboard = ref<Dashboard | null>(null)
const loading = ref(false)

const planCounts = computed(() => {
  const map: Record<string, number> = { FREE: 0, BASIC: 0, PRO: 0, ENTERPRISE: 0 }
  dashboard.value?.byPlan.forEach(r => { map[r.plan] = r._count._all })
  return map
})
const statusCounts = computed(() => {
  const map: Record<string, number> = { TRIAL: 0, ACTIVE: 0, SUSPENDED: 0, CANCELLED: 0 }
  dashboard.value?.byStatus.forEach(r => { map[r.planStatus] = r._count._all })
  return map
})
const planDistribution = computed(() => {
  const total = Object.values(planCounts.value).reduce((a, b) => a + b, 0) || 1
  return PLANS.map(p => ({
    ...p,
    count: planCounts.value[p.value] ?? 0,
    pct: ((planCounts.value[p.value] ?? 0) / total) * 100,
    color: PLAN_COLORS[p.value],
  }))
})
const kpiActive = computed(() => (statusCounts.value.ACTIVE ?? 0) + (statusCounts.value.TRIAL ?? 0))
const kpiProPlus = computed(() => (planCounts.value.PRO ?? 0) + (planCounts.value.ENTERPRISE ?? 0))

const kpiCards = computed(() => [
  { label: 'Total Tenants',    value: dashboard.value?.totalTenants ?? '—', color: 'text-slate-900' },
  { label: 'Ativos + Trial',   value: kpiActive.value,                      color: 'text-emerald-700' },
  { label: 'Suspensos',        value: statusCounts.value.SUSPENDED,         color: 'text-red-700' },
  { label: 'PRO + Enterprise', value: kpiProPlus.value,                     color: 'text-indigo-700' },
  { label: 'MRR Estimado',     value: `R$ ${dashboard.value?.mrr ?? 0}`,    color: 'text-slate-900' },
  { label: 'Usuários',         value: dashboard.value?.totalUsers ?? '—',   color: 'text-slate-900' },
])

const platformStats = computed(() => [
  { label: 'Pedidos Totais',  value: dashboard.value?.totalOrders ?? '—' },
  { label: 'Clientes Totais', value: dashboard.value?.totalCustomers ?? '—' },
  { label: 'Usuários',        value: dashboard.value?.totalUsers ?? '—' },
  { label: 'MRR Estimado',    value: `R$ ${dashboard.value?.mrr ?? 0}`, color: 'text-emerald-600' },
])

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

// Mês "2026-04" → "Abr"
const formatMonth = (yyyymm: string) => {
  const parts = yyyymm.split('-')
  const mm = parts[1] ?? '1'
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return labels[Math.max(0, Math.min(11, parseInt(mm, 10) - 1))] ?? ''
}

const fetchDashboard = async () => {
  loading.value = true
  const res = await apiFetch('/api/tenants/dashboard')
  if (res.ok) dashboard.value = await res.json()
  loading.value = false
}

// ── MRR History — sparkline simples sem dependência de chart lib ─────────
interface MrrPoint { month: string; mrr: number; activeTenants: number }
const mrrHistory = ref<MrrPoint[]>([])
const mrrLoading = ref(false)

const fetchMrrHistory = async () => {
  mrrLoading.value = true
  try {
    const res = await apiFetch('/api/tenants/dashboard/mrr-history?months=12')
    if (res.ok) mrrHistory.value = await res.json()
  } finally { mrrLoading.value = false }
}

// Tendência: % de variação do último mês vs penúltimo
const mrrTrend = computed(() => {
  if (mrrHistory.value.length < 2) return 0
  const last = mrrHistory.value[mrrHistory.value.length - 1]?.mrr ?? 0
  const prev = mrrHistory.value[mrrHistory.value.length - 2]?.mrr ?? 0
  if (!prev) return 0
  return Math.round(((last - prev) / prev) * 100)
})

// Constrói paths SVG da sparkline. Math escala os valores no viewBox.
const mrrChart = computed(() => {
  const w = 800, h = 100, padX = 4, padY = 6
  const data = mrrHistory.value
  if (!data.length) return { width: w, height: h, linePath: '', areaPath: '', points: [] }

  const max = Math.max(...data.map(d => d.mrr), 1)
  const stepX = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0

  const points = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padY + (h - padY * 2) * (1 - d.mrr / max),
    value: d.mrr,
  }))

  const linePath = points.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `${padX},${h} ${linePath} ${padX + (data.length - 1) * stepX},${h}`

  return { width: w, height: h, linePath, areaPath, points }
})

onMounted(() => {
  fetchDashboard()
  fetchMrrHistory()
})
</script>
