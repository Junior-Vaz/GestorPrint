<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const stats = ref({
  customers: 0,
  orders: 0,
  estimates: 0,
  totalValue: 0,
  lowStockItems: [] as any[],
  loading: true,
  companyName: 'Operador',
  ordersByStatus: {
    PENDING: 0,
    PRODUCTION: 0,
    FINISHED: 0,
    DELIVERED: 0
  },
  netProfit: 0
})

const chartData = computed(() => {
  const total = stats.value.orders || 1
  const s = stats.value.ordersByStatus
  return [
    { label: 'Pendente', count: s.PENDING, color: '#94a3b8', percentage: (s.PENDING / total) * 100 },
    { label: 'Produção', count: s.PRODUCTION, color: '#f59e0b', percentage: (s.PRODUCTION / total) * 100 },
    { label: 'Finalizado', count: s.FINISHED, color: '#10b981', percentage: (s.FINISHED / total) * 100 },
    { label: 'Entregue', count: s.DELIVERED, color: '#6366f1', percentage: (s.DELIVERED / total) * 100 }
  ]
})

const fetchStats = async () => {
  stats.value.loading = true
  try {
    const [cRes, oRes, eRes] = await Promise.all([
      apiFetch('/api/customers'),
      apiFetch('/api/orders'),
      apiFetch('/api/estimates'),
    ])

    if (cRes.ok) stats.value.customers = (await cRes.json()).length
    if (oRes.ok) {
      const orders = await oRes.json()
      stats.value.orders = orders.length
      stats.value.ordersByStatus = orders.reduce((acc: any, order: any) => {
        acc[order.status] = (acc[order.status] || 0) + 1
        return acc
      }, { PENDING: 0, PRODUCTION: 0, FINISHED: 0, DELIVERED: 0 })
    }
    if (eRes.ok) {
      const estimates = await eRes.json()
      stats.value.estimates = estimates.length
    }

    const pRes = await apiFetch('/api/products')
    if (pRes.ok) {
      const products = await pRes.json()
      stats.value.lowStockItems = products.filter((p: any) => p.stock <= p.minStock)
    }

    // Endpoints restritos — apenas ADMIN ou SALES
    if (auth.isAdmin || auth.isSales) {
      const rRes = await apiFetch('/api/reports/summary')
      if (rRes.ok) {
        const summary = await rRes.json()
        stats.value.totalValue = summary.revenue
        stats.value.netProfit = summary.netProfit
      }
    }

    if (auth.isAdmin) {
      const sRes = await apiFetch('/api/settings')
      if (sRes.ok) {
        const settings = await sRes.json()
        stats.value.companyName = settings.companyName
      }
    }
  } catch (e) {
    console.error('Error fetching dashboard stats', e)
  } finally {
    stats.value.loading = false
  }
}

onMounted(fetchStats)
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">

    <!-- Header -->
    <div class="bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-100">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
        </div>
        <div>
          <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight">{{ stats.companyName }}</h1>
          <p class="text-slate-500 mt-1 font-medium italic">Resumo do dia — visão geral da gráfica</p>
        </div>
      </div>
      <button @click="fetchStats" :disabled="stats.loading" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-60">
        <svg v-if="!stats.loading" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        <div v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        Atualizar
      </button>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl shadow-slate-200/60 p-6 group hover:shadow-2xl transition-all">
        <div class="flex items-center justify-between mb-4">
          <div class="p-2.5 bg-indigo-100 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </div>
          <span class="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Clientes</span>
        </div>
        <div class="text-3xl font-black text-slate-800">{{ stats.loading ? '—' : stats.customers }}</div>
        <div class="text-xs text-slate-400 font-medium mt-1">cadastrados no sistema</div>
      </div>

      <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl shadow-slate-200/60 p-6 group hover:shadow-2xl transition-all">
        <div class="flex items-center justify-between mb-4">
          <div class="p-2.5 bg-amber-100 rounded-xl text-amber-600 group-hover:scale-110 transition-transform">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <span class="text-[10px] font-black text-amber-400 uppercase tracking-widest">Pedidos</span>
        </div>
        <div class="text-3xl font-black text-slate-800">{{ stats.loading ? '—' : stats.orders }}</div>
        <div class="text-xs text-slate-400 font-medium mt-1">total no sistema</div>
      </div>

      <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl shadow-slate-200/60 p-6 group hover:shadow-2xl transition-all">
        <div class="flex items-center justify-between mb-4">
          <div class="p-2.5 bg-emerald-100 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/></svg>
          </div>
          <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Receita</span>
        </div>
        <div class="text-xl font-black text-slate-800">R$ {{ stats.loading ? '—' : stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</div>
        <div class="text-xs text-slate-400 font-medium mt-1">em vendas realizadas</div>
      </div>

      <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl shadow-slate-200/60 p-6 group hover:shadow-2xl transition-all">
        <div class="flex items-center justify-between mb-4">
          <div :class="['p-2.5 rounded-xl group-hover:scale-110 transition-transform', stats.netProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500']">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          </div>
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lucro</span>
        </div>
        <div :class="['text-xl font-black', stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500']">
          R$ {{ stats.loading ? '—' : stats.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
        </div>
        <div class="text-xs text-slate-400 font-medium mt-1">lucro líquido acumulado</div>
      </div>
    </div>

    <!-- Charts & Panels -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Donut Chart -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6 flex flex-col">
        <h3 class="font-extrabold text-slate-800 mb-6 flex items-center gap-2 text-base">
          <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>
          Status de Produção
        </h3>
        <div class="flex-1 flex flex-col items-center justify-center">
          <div class="relative w-44 h-44 mb-6">
            <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="16" fill="transparent" stroke="#f1f5f9" stroke-width="3"/>
              <template v-for="(item, index) in chartData" :key="index">
                <circle
                  v-if="item.percentage > 0"
                  cx="18" cy="18" r="16"
                  fill="transparent"
                  :stroke="item.color"
                  stroke-width="3"
                  :stroke-dasharray="`${item.percentage} ${100 - item.percentage}`"
                  :stroke-dashoffset="chartData.slice(0, index).reduce((acc, curr) => acc - curr.percentage, 0)"
                  class="transition-all duration-1000 ease-out"
                />
              </template>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-3xl font-black text-slate-800">{{ stats.orders }}</span>
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pedidos</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 w-full">
            <div v-for="item in chartData" :key="item.label" class="flex items-center gap-2 bg-slate-50/80 rounded-xl p-2.5">
              <div class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></div>
              <div class="min-w-0">
                <div class="text-[10px] font-bold text-slate-400 uppercase leading-none truncate">{{ item.label }}</div>
                <div class="text-sm font-black text-slate-700">{{ item.count }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right panel: Next Steps + Stock Alerts -->
      <div class="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6 flex flex-col gap-6">
        <div>
          <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2 text-base">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Próximos Passos Sugeridos
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
              <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm shrink-0">1</div>
              <div>
                <div class="font-bold text-slate-700 text-sm">Gere um Orçamento</div>
                <div class="text-xs text-slate-500">Simule preços para novos clientes.</div>
              </div>
            </div>
            <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
              <div class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-black text-sm shrink-0">2</div>
              <div>
                <div class="font-bold text-slate-700 text-sm">Organize a Produção</div>
                <div class="text-xs text-slate-500">Arraste orçamentos aprovados no Kanban.</div>
              </div>
            </div>
            <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
              <div class="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-sm shrink-0">3</div>
              <div>
                <div class="font-bold text-slate-700 text-sm">Acompanhe o Financeiro</div>
                <div class="text-xs text-slate-500">Veja receitas, despesas e lucro.</div>
              </div>
            </div>
            <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
              <div class="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 font-black text-sm shrink-0">4</div>
              <div>
                <div class="font-bold text-slate-700 text-sm">Reponha o Estoque</div>
                <div class="text-xs text-slate-500">Verifique insumos abaixo do mínimo.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Low Stock Alerts -->
        <div v-if="stats.lowStockItems.length > 0" class="border-t border-slate-100 pt-5">
          <h4 class="text-xs font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Alertas de Estoque Baixo
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div v-for="item in stats.lowStockItems" :key="item.id"
              class="p-3 rounded-xl bg-red-50 border border-red-100 flex justify-between items-center">
              <div>
                <div class="text-xs font-black text-red-900">{{ item.name }}</div>
                <div class="text-[10px] text-red-400 font-bold">Atual: {{ item.stock }} · Mín: {{ item.minStock }}</div>
              </div>
              <div class="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0"></div>
            </div>
          </div>
        </div>

        <div v-else class="border-t border-slate-100 pt-5 flex items-center gap-3 text-emerald-600">
          <div class="p-2 bg-emerald-50 rounded-xl">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <div class="text-sm font-bold">Estoque em dia</div>
            <div class="text-xs text-slate-400">Nenhum insumo abaixo do mínimo.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

