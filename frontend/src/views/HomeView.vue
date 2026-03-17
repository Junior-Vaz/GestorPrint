<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

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
    const [cRes, oRes, eRes, rRes] = await Promise.all([
      fetch('http://localhost:3000/api/customers'),
      fetch('http://localhost:3000/api/orders'),
      fetch('http://localhost:3000/api/estimates'),
      fetch('http://localhost:3000/api/reports/summary'),
    ])

    if (cRes.ok) stats.value.customers = (await cRes.json()).length
    if (oRes.ok) {
      const orders = await oRes.json()
      stats.value.orders = orders.length
      // Group by status
      stats.value.ordersByStatus = orders.reduce((acc: any, order: any) => {
        acc[order.status] = (acc[order.status] || 0) + 1
        return acc
      }, { PENDING: 0, PRODUCTION: 0, FINISHED: 0, DELIVERED: 0 })
    }
    if (eRes.ok) {
      const estimates = await eRes.json()
      stats.value.estimates = estimates.length
    }
    if (rRes.ok) {
      const summary = await rRes.json()
      stats.value.totalValue = summary.revenue
      stats.value.netProfit = summary.netProfit
    }

    const pRes = await fetch('http://localhost:3000/api/products')
    if (pRes.ok) {
      const products = await pRes.json()
      stats.value.lowStockItems = products.filter((p: any) => p.stock <= p.minStock)
    }

    const sRes = await fetch('http://localhost:3000/api/settings')
    if (sRes.ok) {
      const settings = await sRes.json()
      stats.value.companyName = settings.companyName
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
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Welcome Header -->
    <header>
      <h2 class="text-3xl font-black text-slate-900 tracking-tight">Bem-vindo, {{ stats.companyName }}</h2>
      <p class="text-slate-500 font-medium">Aqui está o resumo do que está acontecendo na Gráfica hoje.</p>
    </header>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
        <div class="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
        </div>
        <div class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Clientes Ativos</div>
        <div class="text-3xl font-black text-slate-800">{{ stats.loading ? '...' : stats.customers }}</div>
      </div>

      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
        <div class="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        </div>
        <div class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Em Produção</div>
        <div class="text-3xl font-black text-slate-800">{{ stats.loading ? '...' : stats.orders }}</div>
      </div>

      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
        <div class="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
        </div>
        <div class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Receita (Vendas)</div>
        <div class="text-xl font-black text-slate-800">R$ {{ stats.loading ? '...' : stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</div>
      </div>

      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
        <div class="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
        </div>
        <div class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Lucro Líquido</div>
        <div :class="['text-xl font-black', stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500']">
          R$ {{ stats.loading ? '...' : stats.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
        </div>
      </div>
    </div>

    <!-- Charts & Next Steps -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Status Chart -->
      <div class="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col">
        <h3 class="font-bold text-slate-800 mb-8 flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>
          Status de Produção
        </h3>
        
        <div class="flex-1 flex flex-col items-center justify-center relative">
          <!-- Simple SVG Donut Chart -->
          <div class="relative w-48 h-48 mb-8">
            <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="16" fill="transparent" stroke="#f1f5f9" stroke-width="3"></circle>
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
                ></circle>
              </template>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-3xl font-black text-slate-800">{{ stats.orders }}</span>
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pedidos</span>
            </div>
          </div>

          <!-- Legend -->
          <div class="grid grid-cols-2 gap-4 w-full">
            <div v-for="item in chartData" :key="item.label" class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: item.color }"></div>
              <div class="flex-1">
                <div class="text-[10px] font-bold text-slate-400 uppercase leading-none">{{ item.label }}</div>
                <div class="text-sm font-black text-slate-700">{{ item.count }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <h3 class="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Próximos Passos Sugeridos
        </h3>
        <div class="space-y-4">
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">1</div>
            <div>
              <div class="font-bold text-slate-700 text-sm">Gere um Orçamento</div>
              <div class="text-xs text-slate-500">Comece simulando preços para novos clientes.</div>
            </div>
          </div>
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">2</div>
            <div>
              <div class="font-bold text-slate-700 text-sm">Organize a Produção</div>
              <div class="text-xs text-slate-500">Arraste orçamentos aprovados no Kanban.</div>
            </div>
          </div>
        </div>

        <!-- Low Stock Alerts Section -->
        <div v-if="stats.lowStockItems.length > 0" class="mt-8 pt-8 border-t border-slate-100">
          <h4 class="text-sm font-black text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Alertas de Estoque
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div v-for="item in stats.lowStockItems" :key="item.id" class="p-3 rounded-xl bg-red-50 border border-red-100 flex justify-between items-center group hover:bg-red-100 transition-colors">
              <div>
                <div class="text-xs font-black text-red-900">{{ item.name }}</div>
                <div class="text-[10px] text-red-500 font-bold">Estoque: {{ item.stock }} / Min: {{ item.minStock }}</div>
              </div>
              <button class="bg-white text-red-600 p-1.5 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

