<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted } from 'vue'

const stats = ref({
  revenue: 0,
  expenses: 0,
  netProfit: 0,
  paidTransactionsCount: 0,
  pendingTransactionsCount: 0,
  revenueToday: 0,
  revenueMonth: 0,
  loading: true
})

const showSangriaModal = ref(false)
const sangriaForm = ref({
  amount: 0,
  description: ''
})

const exportReport = () => {
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/reports/export/csv?token=${token}`, '_blank')
}

const transactions = ref<any[]>([])

const fetchFinancialData = async () => {
  stats.value.loading = true
  try {
    const [statsRes, histRes] = await Promise.all([
      apiFetch('/api/reports/summary'),
      apiFetch('/api/payments/history')
    ])

    if (statsRes.ok) {
      const data = await statsRes.json()
      stats.value = { ...data, loading: false }
    }
    if (histRes.ok) {
      transactions.value = await histRes.json()
    }
  } catch (e) {
    console.error('Error fetching financial stats', e)
  } finally {
    stats.value.loading = false
  }
}

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
        date: new Date().toISOString()
      })
    })
    if (res.ok) {
      showSangriaModal.value = false
      sangriaForm.value = { amount: 0, description: '' }
      await fetchFinancialData()
    }
  } catch (e) {
    console.error('Error saving sangria', e)
  }
}

const confirmPayment = async (id: number) => {
  if (!confirm('Deseja confirmar o pagamento manual desta transação?')) return
  try {
    const res = await apiFetch(`/api/payments/confirm/${id}`, { method: 'POST' })
    if (res.ok) {
      await fetchFinancialData()
    }
  } catch (e) {
    console.error('Error confirming payment', e)
  }
}

onMounted(fetchFinancialData)
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <div class="p-2 bg-green-500 rounded-xl text-white shadow-lg shadow-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          Gestão Financeira
        </h1>
        <p class="text-slate-500 mt-1 font-medium italic">Controle de faturamento, despesas e fluxo de caixa</p>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="showSangriaModal = true"
          class="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 border border-red-100 font-bold rounded-xl hover:bg-red-100 transition-all"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
          Gerar Sangria
        </button>
        <button
          @click="exportReport"
          class="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Exportar Planilha
        </button>
      </div>
    </div>

    <!-- Financial KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Today/Month Banner -->
      <div class="bg-indigo-600 p-6 rounded-2xl shadow-xl shadow-indigo-600/20 lg:col-span-4 border border-indigo-400/20 relative overflow-hidden">
        <div class="absolute top-0 right-0 p-6 opacity-10">
          <svg class="w-28 h-28 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        </div>
        <div class="flex flex-col md:flex-row gap-10 justify-around items-center relative z-10">
          <div class="text-center md:text-left">
            <div class="text-indigo-200 text-[11px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Faturamento Hoje</div>
            <div class="text-4xl font-black text-white tracking-tighter">
              {{ stats.loading ? '...' : 'R$ ' + stats.revenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
          <div class="w-px h-14 bg-white/20 hidden md:block"></div>
          <div class="text-center md:text-left">
            <div class="text-indigo-200 text-[11px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Faturamento este Mês</div>
            <div class="text-4xl font-black text-white tracking-tighter">
              {{ stats.loading ? '...' : 'R$ ' + stats.revenueMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Entries -->
      <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-5 group hover:shadow-xl transition-all">
        <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
        </div>
        <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Entradas (Vendas)</div>
        <div class="text-2xl font-black text-slate-800">
          {{ stats.loading ? '...' : 'R$ ' + stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
        </div>
      </div>

      <!-- Exits -->
      <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-5 group hover:shadow-xl transition-all">
        <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 mb-3 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
        </div>
        <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Saídas (Despesas)</div>
        <div class="text-2xl font-black text-red-600">
          {{ stats.loading ? '...' : 'R$ ' + stats.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
        </div>
      </div>

      <!-- Net Profit -->
      <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-5 group hover:shadow-xl transition-all">
        <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        </div>
        <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Lucro Líquido</div>
        <div :class="['text-2xl font-black', stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600']">
          {{ stats.loading ? '...' : 'R$ ' + stats.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
        </div>
      </div>

      <!-- Pending -->
      <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-5 group hover:shadow-xl transition-all">
        <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">A Receber (Pendente)</div>
        <div class="text-2xl font-black text-slate-800">{{ stats.loading ? '...' : stats.pendingTransactionsCount }}</div>
      </div>
    </div>

    <!-- History Table -->
    <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
      <div v-if="transactions.length === 0" class="p-20 text-center">
        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <h3 class="text-lg font-black text-slate-800 mb-1">Sem Transações</h3>
        <p class="text-slate-500 max-w-sm mx-auto font-medium text-sm">Você ainda não recebeu pagamentos pelo sistema.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-100">
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Transação</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Cliente</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Método</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Valor</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Data</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="t in transactions" :key="t.id" class="hover:bg-indigo-50/30 transition-colors group">
              <td class="px-6 py-4 font-mono text-xs font-bold text-slate-400">#TRX-{{ t.id }}</td>
              <td class="px-6 py-4">
                <div class="font-bold text-slate-700">{{ t.order?.customer?.name || 'Venda Avulsa' }}</div>
                <div class="text-[10px] text-slate-400 font-bold">Pedido #{{ t.orderId }}</div>
              </td>
              <td class="px-6 py-4">
                <span class="px-3 py-1 text-xs font-black rounded-lg inline-flex bg-slate-900 text-white">{{ t.paymentType }}</span>
              </td>
              <td class="px-6 py-4 font-black text-slate-800">R$ {{ t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <span :class="['px-3 py-1 text-xs font-black rounded-lg inline-flex',
                    t.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700']">
                    {{ t.status === 'PAID' ? 'Pago' : 'Pendente' }}
                  </span>

                  <button
                    v-if="t.status === 'PENDING'"
                    @click="confirmPayment(t.id)"
                    class="text-slate-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-md transition-all"
                    title="Confirmar Pagamento Manual"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  </button>
                </div>
              </td>
              <td class="px-6 py-4 text-xs text-slate-400 font-bold">{{ new Date(t.createdAt).toLocaleDateString('pt-BR') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sangria Modal -->
    <div v-if="showSangriaModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div class="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-4">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h3 class="font-extrabold text-xl text-slate-800">Retirada de Caixa (Sangria)</h3>
            <p class="text-slate-500 text-sm font-medium">Registre uma saída rápida de dinheiro.</p>
          </div>
          <button @click="showSangriaModal = false" class="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form @submit.prevent="saveSangria" class="space-y-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Valor da Retirada (R$)</label>
            <input
              v-model.number="sangriaForm.amount"
              type="number"
              step="0.01"
              required
              autofocus
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm"
            />
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Motivo / Descrição</label>
            <input
              v-model="sangriaForm.description"
              type="text"
              placeholder="Ex: Almoço, Troco, Pequena Compra..."
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div class="flex gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              @click="showSangriaModal = false"
              class="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-95 text-sm"
            >
              Confirmar Saída
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
