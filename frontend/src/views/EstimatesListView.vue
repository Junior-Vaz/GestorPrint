<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()

interface Estimate {
  id: number;
  customerId: number;
  customer: { name: string, phone?: string | null };
  status: string;
  totalPrice: number;
  details: any;
  createdAt: string;
}

const estimates = ref<Estimate[]>([])
const loading = ref(true)

const fetchEstimates = async () => {
  loading.value = true
  try {
    const res = await fetch('http://localhost:3000/api/estimates')
    if (res.ok) {
      estimates.value = await res.json()
    }
  } catch (e) {
    console.error('Error fetching estimates', e)
  } finally {
    loading.value = false
  }
}

const deleteEstimate = async (id: number) => {
  if (!confirm('Tem certeza que deseja excluir este orçamento?')) return
  try {
    const res = await fetch(`http://localhost:3000/api/estimates/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchEstimates()
  } catch (e) {
    console.error('Error deleting estimate', e)
  }
}

const openPdf = (id: number) => {
  window.open(`http://localhost:3000/api/estimates/${id}/pdf`, '_blank')
}

const convertToOrder = async (id: number) => {
  if (!confirm('Deseja aprovar este orçamento e enviar para a produção?')) return
  try {
    const res = await fetch(`http://localhost:3000/api/estimates/${id}/convert`, { method: 'POST' })
    if (res.ok) await fetchEstimates()
  } catch (e) {
    console.error('Error converting estimate', e)
  }
}

const sendViaWhatsApp = async (est: Estimate) => {
  try {
    // 1. Get payment link
    const res = await fetch(`http://localhost:3000/api/estimates/${est.id}/payment`, { method: 'POST' })
    const payment = await res.json()
    const paymentUrl = payment.paymentUrl || ''

    // 2. Format message
    const msg = `Olá *${est.customer.name}*!\n\n` +
      `Segue seu orçamento *#ORC-${est.id}* na *GestorPrint*:\n` +
      `📦 *Produto:* ${est.details.productName || 'Impresso'}\n` +
      `📐 *Tam:* ${est.details.width}x${est.details.height}cm\n` +
      `🔢 *Qtd:* ${est.details.quantity} unidades\n` +
      `💰 *Total:* R$ ${est.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `Para aprovar e iniciar a produção agora, você pode pagar via Pix/Link aqui:\n` +
      `${paymentUrl}\n\n` +
      `Ficamos no aguardo! 😊`

    const phone = est.customer.phone?.replace(/\D/g, '') || ''
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    
    // Refresh to show status update if conversion happened
    fetchEstimates()
  } catch (e) {
    console.error('Error sharing via WhatsApp', e)
    alert('Erro ao gerar link de pagamento.')
  }
}

onMounted(fetchEstimates)
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Histórico de Orçamentos</h2>
        <p class="text-slate-500 text-sm">Gerencie orçamentos salvos e acompanhe status de aprovação.</p>
      </div>
    </div>

    <!-- Stats Summary (Quick Peek) -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Salvos</div>
        <div class="text-2xl font-black text-slate-800">{{ estimates.length }}</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Aprovados</div>
        <div class="text-2xl font-black text-emerald-500">{{ estimates.filter(e => e.status === 'APPROVED').length }}</div>
      </div>
    </div>

    <!-- Table Card -->
    <div class="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100">
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Ref / Cliente</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Produto</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Valor</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="est in estimates" :key="est.id" class="hover:bg-slate-50/50 transition-colors group">
              <td class="px-6 py-4">
                <div class="text-[10px] font-mono font-bold text-slate-400 mb-0.5">#ORC-{{ est.id }}</div>
                <div class="font-bold text-slate-800 leading-none">{{ est.customer.name }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm font-semibold text-slate-700">{{ est.details.productName || 'Impresso' }}</div>
                <div class="text-[10px] text-slate-400">{{ est.details.quantity }} unidades • {{ est.details.width }}x{{ est.details.height }}cm</div>
              </td>
              <td class="px-6 py-4">
                <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', 
                  est.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600']">
                  {{ est.status === 'APPROVED' ? 'Aprovado' : 'Pendente' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="font-mono text-sm font-bold text-slate-800">R$ {{ est.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</div>
                <div class="text-[10px] text-slate-400">{{ new Date(est.createdAt).toLocaleDateString('pt-BR') }}</div>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex justify-end gap-2">
                  <button @click="ui.setTab('calculator', est)" title="Editar" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button @click="openPdf(est.id)" title="Baixar PDF" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path></svg>
                  </button>
                  <button @click="sendViaWhatsApp(est)" title="Enviar WhatsApp / Gerar Pagamento" class="text-emerald-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  </button>
                  <button v-if="est.status !== 'APPROVED'" @click="convertToOrder(est.id)" title="Aprovar Manualmente" class="text-slate-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </button>
                  <button @click="deleteEstimate(est.id)" title="Excluir" class="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
