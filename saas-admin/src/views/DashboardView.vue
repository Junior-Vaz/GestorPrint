<template>
  <SidebarLayout>
    <div class="p-6 max-w-7xl mx-auto space-y-6">

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <div class="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-100">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            Dashboard SaaS
          </h1>
          <p class="text-slate-500 mt-1 font-medium italic">Visão geral da plataforma e métricas de receita</p>
        </div>
        <button
          @click="fetchDashboard"
          :disabled="loading"
          class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-60"
        >
          <svg v-if="!loading" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <div v-else class="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Atualizar
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div v-for="kpi in kpiCards" :key="kpi.label"
          class="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/40 shadow-xl shadow-slate-200/60">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">{{ kpi.label }}</p>
          <p class="text-3xl font-extrabold mt-2" :class="kpi.color">{{ kpi.value }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Plan Distribution -->
        <div class="xl:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white/40 shadow-2xl shadow-slate-200/60">
          <h2 class="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <div class="w-2 h-6 bg-indigo-500 rounded-full"></div>
            Distribuição por Plano
          </h2>

          <div class="flex rounded-full overflow-hidden h-5 mb-5 bg-slate-100">
            <div
              v-for="p in planDistribution" :key="p.value"
              :class="[p.color, 'transition-all duration-700 first:rounded-l-full last:rounded-r-full']"
              :style="{ width: p.pct + '%' }"
              :title="`${p.label}: ${p.count}`"
            ></div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-5">
            <div v-for="p in planDistribution" :key="p.value"
              class="flex items-center justify-between bg-slate-50/80 rounded-xl px-4 py-3 border border-slate-100">
              <div class="flex items-center gap-2">
                <span :class="[p.color, 'w-3 h-3 rounded-full shrink-0']"></span>
                <span class="text-sm text-slate-700 font-semibold">{{ p.label }}</span>
              </div>
              <span class="text-sm font-extrabold text-slate-800">{{ p.count }}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
            <span v-for="(count, status) in statusCounts" :key="status"
              :class="['px-3 py-1 rounded-full text-xs font-black', STATUS_COLORS[status as string] || 'bg-slate-100 text-slate-500']">
              {{ status }} {{ count }}
            </span>
          </div>
        </div>

        <!-- Platform Stats -->
        <div class="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white/40 shadow-2xl shadow-slate-200/60">
          <h2 class="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <div class="w-2 h-6 bg-emerald-500 rounded-full"></div>
            Uso da Plataforma
          </h2>
          <div class="space-y-4">
            <div v-for="stat in platformStats" :key="stat.label"
              class="flex items-center justify-between py-2 border-b border-slate-50">
              <span class="text-sm text-slate-500 font-medium">{{ stat.label }}</span>
              <span class="text-sm font-extrabold" :class="stat.color || 'text-slate-800'">{{ stat.value }}</span>
            </div>
          </div>
          <div class="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <p class="text-xs text-emerald-600 font-semibold">MRR calculado com base no plano atual de cada tenant ativo.</p>
          </div>
        </div>
      </div>

      <!-- Recent Tenants -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div class="w-2 h-6 bg-purple-500 rounded-full"></div>
            Tenants Recentes
          </h2>
          <RouterLink to="/tenants"
            class="text-sm text-indigo-600 hover:text-indigo-700 font-bold transition-colors">
            Ver todos →
          </RouterLink>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-100">
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Plano</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Criado em</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="t in dashboard?.recentTenants" :key="t.id"
                class="hover:bg-indigo-50/30 transition-colors group">
                <td class="px-6 py-4">
                  <p class="font-bold text-slate-800">{{ t.name }}</p>
                  <p class="text-xs text-slate-400 font-mono">{{ t.slug }}</p>
                </td>
                <td class="px-6 py-4">
                  <span :class="['px-3 py-1 rounded-lg text-xs font-black inline-flex', PLAN_BADGE[t.plan] || 'bg-slate-100 text-slate-600']">{{ t.plan }}</span>
                </td>
                <td class="px-6 py-4">
                  <span :class="['px-3 py-1 rounded-full text-xs font-black inline-flex', STATUS_COLORS[t.planStatus] || 'bg-slate-100 text-slate-500']">{{ t.planStatus }}</span>
                </td>
                <td class="px-6 py-4">
                  <span class="text-sm font-semibold text-slate-600">{{ formatDate(t.createdAt) }}</span>
                </td>
              </tr>
              <tr v-if="!dashboard?.recentTenants?.length && !loading">
                <td colspan="4" class="px-6 py-12 text-center text-slate-400 font-medium italic">
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
  FREE: 'bg-slate-100 text-slate-600', BASIC: 'bg-blue-100 text-blue-700',
  PRO: 'bg-indigo-100 text-indigo-700', ENTERPRISE: 'bg-purple-100 text-purple-700',
}
const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-amber-100 text-amber-700', ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-700', CANCELLED: 'bg-slate-100 text-slate-500',
}

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
  { label: 'Total Tenants', value: dashboard.value?.totalTenants ?? '—', color: 'text-slate-800' },
  { label: 'Ativos + Trial', value: kpiActive.value, color: 'text-emerald-600' },
  { label: 'Suspensos',      value: statusCounts.value.SUSPENDED, color: 'text-red-500' },
  { label: 'PRO + Enterprise', value: kpiProPlus.value, color: 'text-indigo-600' },
  { label: 'MRR Estimado',  value: `R$${dashboard.value?.mrr ?? 0}`, color: 'text-slate-800' },
  { label: 'Usuários',      value: dashboard.value?.totalUsers ?? '—', color: 'text-slate-800' },
])

const platformStats = computed(() => [
  { label: 'Pedidos Totais',  value: dashboard.value?.totalOrders ?? '—' },
  { label: 'Clientes Totais', value: dashboard.value?.totalCustomers ?? '—' },
  { label: 'Usuários',        value: dashboard.value?.totalUsers ?? '—' },
  { label: 'MRR Estimado',    value: `R$ ${dashboard.value?.mrr ?? 0}`, color: 'text-emerald-600' },
])

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const fetchDashboard = async () => {
  loading.value = true
  const res = await apiFetch('/api/tenants/dashboard')
  if (res.ok) dashboard.value = await res.json()
  loading.value = false
}

onMounted(fetchDashboard)
</script>
