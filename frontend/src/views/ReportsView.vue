<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { apiFetch } from '../utils/api'

const selectedPeriod = ref('30d')
const summary = ref({
  revenue: 0,
  expenses: 0,
  netProfit: 0,
  pendingOrders: 0,
  completedOrders: 0,
  inventoryValue: 0,
  lowStockCount: 0
})

const charts = ref({
  salesTrend: [] as any[],
  productionStats: [] as any[],
  topCustomers: [] as any[],
  expenseBreakdown: [] as any[]
})

const loading = ref(true)
const chartContainer = ref<HTMLElement | null>(null)

const scrollToRight = () => {
  if (chartContainer.value) {
    chartContainer.value.scrollLeft = chartContainer.value.scrollWidth
  }
}

const fetchReports = async () => {
  loading.value = true
  try {
    const [sumRes, statsRes] = await Promise.all([
      apiFetch(`/api/reports/summary?period=${selectedPeriod.value}`),
      apiFetch(`/api/reports/stats?period=${selectedPeriod.value}`)
    ])
    
    if (sumRes.ok) summary.value = await sumRes.json()
    if (statsRes.ok) {
      charts.value = await statsRes.json()
      setTimeout(scrollToRight, 100)
    }
  } catch (e) {
    console.error('Error fetching reports', e)
  } finally {
    loading.value = false
    setTimeout(scrollToRight, 300)
  }
}

const exportPdf = () => {
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/reports/export/pdf?period=${selectedPeriod.value}&token=${token}`, '_blank')
}

// Chart helper
const getBarHeight = (value: number) => {
  const maxRevenue = Math.max(...charts.value.salesTrend.map(s => s.revenue), 1)
  const maxExpense = Math.max(...charts.value.salesTrend.map(s => s.expense), 1)
  const max = Math.max(maxRevenue, maxExpense, 100)
  return (value / max) * 100
}

watch(selectedPeriod, fetchReports)
onMounted(fetchReports)
</script>

<template>
  <div class="h-full flex flex-col space-y-8 animate-in fade-in duration-500 pb-20 no-scrollbar overflow-y-auto pr-2">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center px-2 gap-4">
      <div>
        <h2 class="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          Relatórios & BI
          <span class="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest font-black">Pro</span>
        </h2>
        <p class="text-slate-500 font-medium">Análise detalhada de performance e lucratividade.</p>
      </div>
      
      <div class="flex items-center gap-3 w-full md:w-auto">
        <!-- Period Selector -->
        <div class="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
          <button 
            v-for="p in [{id: '7d', label: '7 D'}, {id: '30d', label: '30 D'}, {id: '90d', label: '90 D'}, {id: '12m', label: '12 M'}]" 
            :key="p.id"
            @click="selectedPeriod = p.id"
            :class="['px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all', selectedPeriod === p.id ? 'bg-white text-slate-900 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700']"
          >
            {{ p.label }}
          </button>
        </div>

        <button 
          @click="exportPdf"
          class="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span class="text-xs font-black uppercase tracking-widest">Gerar PDF</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center min-h-[400px]">
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Processando BI...</p>
      </div>
    </div>

    <div v-else class="space-y-8">
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Revenue Card -->
        <div class="bg-indigo-600 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-all duration-700"></div>
          <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Faturamento Bruto</p>
          <h3 class="text-3xl font-black leading-none mb-4">R$ {{ summary.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</h3>
          <div class="flex items-center gap-2 text-[10px] font-black bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md uppercase tracking-widest">
            Receita {{ selectedPeriod }}
          </div>
        </div>

        <!-- Expenses Card -->
        <div class="bg-white border border-slate-200 rounded-[32px] p-8 text-slate-900 shadow-sm relative overflow-hidden group">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Despesas Operacionais</p>
          <h3 class="text-3xl font-black leading-none mb-4">R$ {{ summary.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</h3>
          <div class="flex items-center gap-2 text-[10px] font-black text-red-500 bg-red-50 w-fit px-3 py-1.5 rounded-full uppercase tracking-widest">
            Custos Reais
          </div>
        </div>

        <!-- Profit Card -->
        <div :class="['rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden group', summary.netProfit >= 0 ? 'bg-emerald-500 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100']">
          <div class="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
          <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Lucro Líquido Real</p>
          <h3 class="text-3xl font-black leading-none mb-4">R$ {{ summary.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</h3>
          <div class="flex items-center gap-2 text-[10px] font-black bg-white/20 w-fit px-3 py-1.5 rounded-full uppercase tracking-widest">
            {{ summary.netProfit >= 0 ? 'Margem Positiva' : 'Saldo Negativo' }}
          </div>
        </div>
      </div>

      <!-- Main Charts Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- Sales Trend Chart -->
        <div class="lg:col-span-8 bg-white rounded-[40px] border border-slate-200 p-8 md:p-10 shadow-sm overflow-hidden flex flex-col">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
              <h4 class="text-lg font-black text-slate-900 tracking-tight">Crescimento de Faturamento</h4>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Análise de Receita vs Custos</p>
            </div>
            <div class="flex items-center gap-6 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 bg-indigo-600 rounded-full shadow-sm shadow-indigo-200"></div>
                <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Receita</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 bg-rose-400 rounded-full shadow-sm shadow-rose-200"></div>
                <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Custos</span>
              </div>
            </div>
          </div>

          <!-- Chart Area -->
          <div 
            ref="chartContainer"
            class="h-[350px] flex items-end gap-2 md:gap-3 px-4 pb-16 overflow-x-auto no-scrollbar scroll-smooth relative"
          >
            <!-- Grid Lines -->
            <div class="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.05] py-16 px-4">
              <div v-for="i in 5" :key="i" class="w-full border-b border-slate-900"></div>
            </div>

            <!-- Bars -->
            <div v-for="day in charts.salesTrend" :key="day.fullDate" 
              class="min-w-[32px] md:min-w-[40px] h-full flex flex-col justify-end items-center group relative transition-all duration-300"
            >
              <!-- Tooltip -->
              <div class="absolute -top-20 opacity-0 group-hover:opacity-100 transition-all bg-slate-900 text-white p-3 rounded-2xl pointer-events-none z-50 shadow-2xl border border-white/10 whitespace-nowrap">
                <p class="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">{{ day.weekday }} {{ day.date }}</p>
                <p class="text-[10px] font-black text-indigo-400">Receita: R$ {{ day.revenue.toLocaleString('pt-BR') }}</p>
                <p class="text-[10px] font-black text-rose-400">Custo: R$ {{ (day.expense || 0).toLocaleString('pt-BR') }}</p>
              </div>
              
              <!-- Bar Group -->
              <div class="w-full flex items-end justify-center gap-[2px] h-[200px] mb-2">
                <!-- Revenue Bar -->
                <div 
                  class="w-[10px] md:w-[12px] bg-indigo-600 rounded-t-md transition-all duration-1000 ease-out shadow-sm relative"
                  :style="{ height: getBarHeight(day.revenue) + '%' }"
                >
                   <span v-if="day.revenue > 30" class="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-black text-indigo-600 opacity-0 group-hover:opacity-100">R${{Math.round(day.revenue)}}</span>
                </div>
                <!-- Expense Bar -->
                <div 
                  class="w-[10px] md:w-[12px] bg-rose-400 rounded-t-md transition-all duration-1000 ease-out shadow-sm"
                  :style="{ height: getBarHeight(day.expense || 0) + '%' }"
                ></div>
              </div>

              <!-- Date Label (Simplified/Rotated if needed) -->
              <div class="absolute -bottom-10 h-10 flex flex-col items-center">
                <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{{ day.weekday }}</span>
                <span class="text-[10px] font-black text-slate-700">{{ day.date.split('/')[0] }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Expense Category Breakdown -->
        <div class="lg:col-span-4 bg-white rounded-[40px] border border-slate-200 p-8 md:p-10 shadow-sm flex flex-col">
          <h4 class="text-lg font-black text-slate-900 tracking-tight mb-8">Saídas por Categoria</h4>
          <div class="flex-1 flex flex-col justify-center space-y-6">
            <div v-for="exp in charts.expenseBreakdown" :key="exp.category" class="space-y-1.5">
              <div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span class="truncate pr-4">{{ exp.category }}</span>
                <span class="text-slate-900">R$ {{ exp.total.toLocaleString() }}</span>
              </div>
              <div class="h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <div 
                  class="h-full bg-red-500 rounded-full transition-all duration-1000"
                  :style="{ width: (exp.total / (summary.expenses || 1) * 100) + '%' }"
                ></div>
              </div>
            </div>

            <div v-if="charts.expenseBreakdown.length === 0" class="flex flex-col items-center justify-center py-10 opacity-30">
              <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <p class="text-[10px] font-black uppercase tracking-widest">Nenhuma despesa</p>
            </div>
          </div>
        </div>

        <!-- Ranking and Performance -->
        <div class="lg:col-span-6 bg-white rounded-[40px] border border-slate-200 p-8 md:p-10 shadow-sm">
          <h4 class="text-lg font-black text-slate-900 tracking-tight mb-8 flex items-center gap-3">
            <span class="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            </span>
            Top 5 Clientes (Ranking)
          </h4>
          
          <div class="space-y-4">
            <div v-for="(c, i) in charts.topCustomers" :key="c.name" class="flex items-center justify-between p-5 bg-slate-50 rounded-3xl group hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
              <div class="flex items-center gap-4">
                <div :class="['w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black', i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400']">
                  {{ i + 1 }}
                </div>
                <div>
                  <p class="text-sm font-black text-slate-800">{{ c.name }}</p>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-indigo-500">Cliente Prime</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-black text-indigo-600">R$ {{ c.total.toLocaleString() }}</p>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receita Geral</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Operational Status -->
        <div class="lg:col-span-6 bg-white rounded-[40px] border border-slate-200 p-8 md:p-10 shadow-sm">
          <h4 class="text-lg font-black text-slate-900 tracking-tight mb-8 flex items-center gap-3">
             <span class="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </span>
            Saúde da Operação
          </h4>
          
          <div class="grid grid-cols-2 gap-6">
            <div v-for="stat in charts.productionStats" :key="stat.name" class="p-8 bg-slate-50 rounded-[40px] border border-slate-100 relative group overflow-hidden">
               <div :class="['absolute right-0 top-0 w-2 h-full', 
                  stat.name === 'Aguardando' ? 'bg-amber-500' :
                  stat.name === 'Produção' ? 'bg-indigo-500' :
                  stat.name === 'Concluído' || stat.name === 'Entregue' ? 'bg-emerald-500' : 'bg-slate-300'
                ]"></div>
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{{ stat.name }}</span>
              <div class="mt-4">
                <span class="text-4xl font-black text-slate-900">{{ stat.count }}</span>
                <span class="text-[10px] font-black text-slate-400 ml-2 uppercase">Pedidos</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
