<script setup lang="ts">
import { ref, onMounted } from 'vue'

const stats = ref({
  revenue: 0,
  expenses: 0,
  netProfit: 0,
  paidTransactionsCount: 0,
  pendingTransactionsCount: 0,
  loading: true
})

const showSangriaModal = ref(false)
const sangriaForm = ref({
  amount: 0,
  description: ''
})

const exportReport = () => {
  window.open('/api/reports/export/csv', '_blank')
}

const transactions = ref<any[]>([])

const fetchFinancialData = async () => {
  stats.value.loading = true
  try {
    const [statsRes, histRes] = await Promise.all([
      fetch('/api/reports/summary'),
      fetch('/api/payments/history')
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
    const res = await fetch('/api/expenses', {
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
    const res = await fetch(`/api/payments/confirm/${id}`, { method: 'POST' })
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
  <div class="space-y-8 animate-in fade-in duration-500">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-3xl font-black text-slate-900 tracking-tight">Gestão Financeira</h2>
        <p class="text-slate-500 font-medium">Controle de faturamento, despesas e fluxo de caixa.</p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="showSangriaModal = true"
          class="px-6 py-3 bg-red-50 text-red-600 border border-red-100 font-black rounded-2xl hover:bg-red-100 transition-all shadow-sm flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
          Geral Sangria
        </button>
        <button 
          @click="exportReport"
          class="px-6 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-2xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Exportar Planilha
        </button>
      </div>
    </header>

    <!-- Financial KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Entries -->
      <div class="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
        <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
        </div>
        <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Entradas (Vendas)</div>
        <div class="text-2xl font-black text-slate-800">
          {{ stats.loading ? '...' : 'R$ ' + stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
        </div>
      </div>

      <!-- Exits -->
      <div class="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
        <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
        </div>
        <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Saídas (Despesas)</div>
        <div class="text-2xl font-black text-red-600">
          {{ stats.loading ? '...' : 'R$ ' + stats.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
        </div>
      </div>

      <!-- Net Profit -->
      <div class="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
        <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        </div>
        <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Lucro Líquido</div>
        <div :class="['text-2xl font-black', stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600']">
          {{ stats.loading ? '...' : 'R$ ' + stats.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
        </div>
      </div>

      <!-- Pending -->
      <div class="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
        <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">A Receber (Pendente)</div>
        <div class="text-2xl font-black text-slate-800">{{ stats.loading ? '...' : stats.pendingTransactionsCount }}</div>
      </div>
    </div>

    <!-- History Table -->
    <div class="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
      <div v-if="transactions.length === 0" class="p-20 text-center">
        <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <h3 class="text-xl font-black text-slate-800 mb-2">Sem Transações</h3>
        <p class="text-slate-500 max-w-sm mx-auto font-medium">Você ainda não recebeu pagamentos pelo sistema.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 border-b border-slate-100">
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transação</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Método</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="t in transactions" :key="t.id" class="hover:bg-slate-50/50 transition-colors group">
              <td class="px-8 py-6 font-mono text-xs font-bold text-slate-400">#TRX-{{ t.id }}</td>
              <td class="px-8 py-6">
                <div class="font-black text-slate-700">{{ t.order?.customer?.name || 'Venda Avulsa' }}</div>
                <div class="text-[10px] text-slate-400 font-bold">Pedido #{{ t.orderId }}</div>
              </td>
              <td class="px-8 py-6">
                <span class="text-[10px] font-black px-2.5 py-1 bg-slate-900 text-white rounded-lg">{{ t.paymentType }}</span>
              </td>
              <td class="px-8 py-6 font-black text-slate-800">R$ {{ t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</td>
              <td class="px-8 py-6">
                <div class="flex items-center gap-3">
                  <span :class="['px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest', 
                    t.status === 'PAID' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600']">
                    {{ t.status === 'PAID' ? 'Pago' : 'Pendente' }}
                  </span>
                  
                  <button 
                    v-if="t.status === 'PENDING'"
                    @click="confirmPayment(t.id)"
                    class="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    title="Confirmar Pagamento Manual"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  </button>
                </div>
              </td>
              <td class="px-8 py-6 text-xs text-slate-400 font-bold">{{ new Date(t.createdAt).toLocaleDateString('pt-BR') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sangria Modal -->
    <div v-if="showSangriaModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showSangriaModal = false"></div>
      <div class="bg-white w-full max-w-md rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
        <header class="p-8 border-b border-slate-100">
          <h3 class="text-2xl font-black text-slate-900 leading-tight">Retirada de Caixa (Sangria)</h3>
          <p class="text-slate-500 text-sm font-medium">Registre uma saída rápida de dinheiro.</p>
        </header>

        <form @submit.prevent="saveSangria" class="p-8 space-y-6">
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor da Retirada (R$)</label>
              <input 
                v-model.number="sangriaForm.amount"
                type="number" 
                step="0.01"
                required
                autofocus
                class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo / Descrição</label>
              <input 
                v-model="sangriaForm.description"
                type="text" 
                placeholder="Ex: Almoço, Troco, Pequena Compra..."
                class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div class="flex gap-4 pt-4">
            <button 
              type="button"
              @click="showSangriaModal = false"
              class="flex-1 px-6 py-4 border border-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              class="flex-1 px-6 py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95"
            >
              Confirmar Saída
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
