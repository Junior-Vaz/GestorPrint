<template>
  <SidebarLayout>
    <div class="p-6 space-y-6">

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p class="text-xs text-slate-500 font-medium">Total Tenants</p>
          <p class="text-3xl font-bold text-slate-800 mt-1">{{ dashboard?.totalTenants ?? '—' }}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p class="text-xs text-slate-500 font-medium">Ativos + Trial</p>
          <p class="text-3xl font-bold text-emerald-600 mt-1">{{ kpiActive }}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p class="text-xs text-slate-500 font-medium">Suspensos</p>
          <p class="text-3xl font-bold text-red-500 mt-1">{{ statusCounts.SUSPENDED }}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p class="text-xs text-slate-500 font-medium">PRO + Enterprise</p>
          <p class="text-3xl font-bold text-indigo-600 mt-1">{{ kpiProPlus }}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p class="text-xs text-slate-500 font-medium">MRR Estimado</p>
          <p class="text-3xl font-bold text-slate-800 mt-1">R${{ dashboard?.mrr ?? 0 }}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p class="text-xs text-slate-500 font-medium">Usuários Totais</p>
          <p class="text-3xl font-bold text-slate-800 mt-1">{{ dashboard?.totalUsers ?? '—' }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Plan Distribution -->
        <div class="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 class="text-sm font-semibold text-slate-700 mb-4">Distribuição por Plano</h2>

          <div class="flex rounded-full overflow-hidden h-5 mb-4 bg-slate-100">
            <div
              v-for="p in planDistribution" :key="p.value"
              :class="[p.color, 'transition-all duration-700 first:rounded-l-full last:rounded-r-full']"
              :style="{ width: p.pct + '%' }"
              :title="`${p.label}: ${p.count}`"
            ></div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div v-for="p in planDistribution" :key="p.value" class="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
              <div class="flex items-center gap-2">
                <span :class="[p.color, 'w-2.5 h-2.5 rounded-full flex-shrink-0']"></span>
                <span class="text-sm text-slate-600 font-medium">{{ p.label }}</span>
              </div>
              <span class="text-sm font-bold text-slate-800">{{ p.count }}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            <span
              v-for="(count, status) in statusCounts" :key="status"
              :class="['px-3 py-1 rounded-full text-xs font-semibold', STATUS_COLORS[status as string] || 'bg-slate-100 text-slate-500']"
            >
              {{ status }} {{ count }}
            </span>
          </div>
        </div>

        <!-- Stats column -->
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 class="text-sm font-semibold text-slate-700 mb-4">Uso da Plataforma</h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-500">Pedidos Totais</span>
              <span class="text-sm font-bold text-slate-800">{{ dashboard?.totalOrders ?? '—' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-500">Clientes Totais</span>
              <span class="text-sm font-bold text-slate-800">{{ dashboard?.totalCustomers ?? '—' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-500">Usuários</span>
              <span class="text-sm font-bold text-slate-800">{{ dashboard?.totalUsers ?? '—' }}</span>
            </div>
            <div class="pt-3 border-t border-slate-100">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">MRR Estimado</span>
                <span class="text-base font-bold text-emerald-600">R$ {{ dashboard?.mrr ?? 0 }}</span>
              </div>
              <p class="text-xs text-slate-400 mt-1">Baseado no plano de cada tenant</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Tenants -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-700">Tenants Recentes</h2>
          <RouterLink to="/tenants" class="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">Ver todos →</RouterLink>
        </div>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-slate-100">
            <tr v-for="t in dashboard?.recentTenants" :key="t.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-5 py-3">
                <p class="font-semibold text-slate-800">{{ t.name }}</p>
                <p class="text-xs text-slate-400">{{ t.slug }}</p>
              </td>
              <td class="px-5 py-3">
                <span :class="['px-2 py-0.5 rounded-md text-xs font-bold', PLAN_BADGE[t.plan] || 'bg-slate-100 text-slate-600']">{{ t.plan }}</span>
              </td>
              <td class="px-5 py-3">
                <span :class="['px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_COLORS[t.planStatus] || 'bg-slate-100 text-slate-500']">{{ t.planStatus }}</span>
              </td>
              <td class="px-5 py-3 text-slate-400 text-xs">{{ formatDate(t.createdAt) }}</td>
            </tr>
            <tr v-if="!dashboard?.recentTenants?.length">
              <td colspan="4" class="px-5 py-8 text-center text-slate-400 text-sm">Nenhum tenant encontrado</td>
            </tr>
          </tbody>
        </table>
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
const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

onMounted(async () => {
  const res = await apiFetch('/api/tenants/dashboard')
  if (res.ok) dashboard.value = await res.json()
})
</script>
