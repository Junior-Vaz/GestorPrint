<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { apiFetch } from '@/utils/api'
import { useDebounceFn } from '@vueuse/core'
import { usePermissionsStore } from '../stores/permissions'
import PaginationControls from '../components/shared/PaginationControls.vue'

const perms = usePermissionsStore()

interface Bill {
 id: number
 description: string
 amount: number
 dueDate: string
 paidAt: string | null
 paidAmount: number | null
 status: string
 notes: string | null
 category: string | null
 supplierId: number | null
 supplier: { id: number; name: string } | null
}

interface Supplier { id: number; name: string }

const billList = ref<Bill[]>([])
const suppliers = ref<Supplier[]>([])
const loading = ref(true)
const saving = ref(false)
const showModal = ref(false)
const showPayModal = ref(false)
const editingBill = ref<Bill | null>(null)
const payingBill = ref<Bill | null>(null)
const statusFilter = ref('')
const search = ref('')
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)

const totals = ref({ pendingAmount: 0, pendingCount: 0, overdueAmount: 0, overdueCount: 0 })

const CATEGORIES = ['Insumos', 'Aluguel', 'Energia', 'Água', 'Internet', 'Manutenção', 'Serviços', 'Impostos', 'Outros']

const form = ref({
 description: '',
 amount: 0,
 dueDate: new Date().toISOString().split('T')[0],
 supplierId: null as number | null,
 category: 'Insumos',
 notes: '',
})

const payForm = ref({
 paidAmount: 0,
 paidAt: new Date().toISOString().split('T')[0],
})

const statusLabel: Record<string, string> = {
 PENDING: 'Pendente',
 OVERDUE: 'Vencido',
 PAID: 'Pago',
 CANCELLED: 'Cancelado',
}

const statusClass: Record<string, string> = {
 PENDING: 'bg-amber-100 text-amber-700',
 OVERDUE: 'bg-red-100 text-red-700',
 PAID: 'bg-emerald-100 text-emerald-700',
 CANCELLED: 'bg-slate-100 text-slate-500',
}

const filteredBills = computed(() => billList.value)

function formatCurrency(value: number) {
 return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
 if (!dateStr) return '—'
 return new Date(dateStr).toLocaleDateString('pt-BR')
}

async function fetchBills() {
 const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
 if (statusFilter.value) params.set('status', statusFilter.value)
 if (search.value.trim()) params.set('search', search.value.trim())
 const res = await apiFetch(`/api/payables?${params}`)
 if (!res.ok) return
 const result = await res.json()
 if (Array.isArray(result)) {
 billList.value = result; total.value = result.length; totalPages.value = 1
 } else {
 billList.value = result.data; total.value = result.total; totalPages.value = result.totalPages
 }
}

async function fetchSuppliers() {
 const res = await apiFetch('/api/suppliers?page=1&limit=200')
 if (res.ok) {
 const data = await res.json()
 const list = Array.isArray(data) ? data : (data.data ?? [])
 suppliers.value = list.map((s: any) => ({ id: s.id, name: s.name }))
 }
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; fetchBills() }, 300)
watch(search, debouncedSearch)
watch([page, limit], fetchBills)

async function fetchTotals() {
 const res = await apiFetch('/api/payables/totals')
 if (res.ok) totals.value = await res.json()
}

async function applyFilter(status: string) {
 statusFilter.value = status
 page.value = 1
 await fetchBills()
}

function openCreateModal() {
 editingBill.value = null
 form.value = {
 description: '',
 amount: 0,
 dueDate: new Date().toISOString().split('T')[0],
 supplierId: null,
 category: 'Insumos',
 notes: '',
 }
 showModal.value = true
}

function openEditModal(bill: Bill) {
 editingBill.value = bill
 form.value = {
 description: bill.description,
 amount: bill.amount,
 dueDate: bill.dueDate.split('T')[0],
 supplierId: bill.supplierId,
 category: bill.category ?? 'Insumos',
 notes: bill.notes ?? '',
 }
 showModal.value = true
}

function openPayModal(bill: Bill) {
 payingBill.value = bill
 payForm.value = {
 paidAmount: bill.amount,
 paidAt: new Date().toISOString().split('T')[0],
 }
 showPayModal.value = true
}

async function saveBill() {
 saving.value = true
 try {
 const method = editingBill.value ? 'PATCH' : 'POST'
 const url = editingBill.value ? `/api/payables/${editingBill.value.id}` : '/api/payables'
 const body = { ...form.value, supplierId: form.value.supplierId || undefined }
 const res = await apiFetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 })
 if (res.ok) {
 showModal.value = false
 await Promise.all([fetchBills(), fetchTotals()])
 }
 } finally {
 saving.value = false
 }
}

async function savePayment() {
 if (!payingBill.value) return
 saving.value = true
 try {
 const res = await apiFetch(`/api/payables/${payingBill.value.id}/pay`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payForm.value),
 })
 if (res.ok) {
 showPayModal.value = false
 await Promise.all([fetchBills(), fetchTotals()])
 }
 } finally {
 saving.value = false
 }
}

async function cancelBill(id: number) {
 if (!confirm('Cancelar esta conta?')) return
 const res = await apiFetch(`/api/payables/${id}/cancel`, { method: 'POST' })
 if (res.ok) await Promise.all([fetchBills(), fetchTotals()])
}

async function deleteBill(id: number) {
 if (!confirm('Excluir esta conta permanentemente?')) return
 const res = await apiFetch(`/api/payables/${id}`, { method: 'DELETE' })
 if (res.ok) await Promise.all([fetchBills(), fetchTotals()])
}

onMounted(async () => {
 loading.value = true
 try {
 await Promise.all([fetchBills(), fetchSuppliers(), fetchTotals()])
 } finally {
 loading.value = false
 }
})
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Contas a pagar</div>
          <div class="text-xs text-slate-500 mt-0.5">Obrigações com fornecedores e despesas fixas</div>
        </div>
        <button v-if="perms.can.create('payables')" @click="openCreateModal"
                class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors">
          <span class="text-base leading-none">+</span>
          Nova conta
        </button>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500">A pagar</span>
            <span class="w-1.5 h-1.5 rounded-full" style="background:#BA7517"></span>
          </div>
          <div class="text-2xl font-medium" style="color:#854F0B">R$ {{ formatCurrency(totals.pendingAmount) }}</div>
          <div class="text-[11px] text-slate-400 mt-1">{{ totals.pendingCount }} pendente{{ totals.pendingCount === 1 ? '' : 's' }}</div>
        </div>

        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500">Contas em aberto</span>
          </div>
          <div class="text-2xl font-medium text-slate-900">{{ totals.pendingCount }}</div>
          <div class="text-[11px] text-slate-400 mt-1">aguardando pagamento</div>
        </div>

        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500">Em atraso</span>
            <span class="w-1.5 h-1.5 rounded-full" style="background:#A32D2D"></span>
          </div>
          <div class="text-2xl font-medium" style="color:#A32D2D">R$ {{ formatCurrency(totals.overdueAmount) }}</div>
          <div class="text-[11px] text-slate-400 mt-1">valor vencido</div>
        </div>

        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500">Contas vencidas</span>
          </div>
          <div class="text-2xl font-medium" :style="{ color: totals.overdueCount > 0 ? '#A32D2D' : '#0F172A' }">{{ totals.overdueCount }}</div>
          <div class="text-[11px] text-slate-400 mt-1">atrasada{{ totals.overdueCount === 1 ? '' : 's' }}</div>
        </div>
      </div>

      <!-- Filtros + busca -->
      <div class="flex items-center gap-3 mb-5 flex-wrap">
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            v-for="tab in [
              { key: '',          label: 'Todos',     color: '#0F172A', soft: '#F1F5F9' },
              { key: 'PENDING',   label: 'Pendente',  color: '#BA7517', soft: '#FAEEDA' },
              { key: 'OVERDUE',   label: 'Vencido',   color: '#A32D2D', soft: '#FCEBEB' },
              { key: 'PAID',      label: 'Pago',      color: '#1D9E75', soft: '#E1F5EE' },
              { key: 'CANCELLED', label: 'Cancelado', color: '#64748B', soft: '#F1F5F9' },
            ]"
            :key="tab.key"
            @click="applyFilter(tab.key)"
            :class="['shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-colors border',
              statusFilter === tab.key ? 'font-medium' : 'bg-white hover:bg-slate-50']"
            :style="statusFilter === tab.key
              ? { backgroundColor: tab.soft, color: tab.color, borderColor: tab.color }
              : { color: '#64748B', borderColor: '#E2E8F0' }">
            <span v-if="tab.key" class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: tab.color }"></span>
            {{ tab.label }}
          </button>
        </div>
        <div class="relative flex-1 max-w-md min-w-[200px]">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" placeholder="Buscar por descrição ou fornecedor…"
                 class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
        </div>
      </div>

      <!-- Tabela -->
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div v-if="loading" class="p-1">
          <div v-for="i in 5" :key="`l${i}`"
               class="grid grid-cols-[110px_1.2fr_110px_1.2fr_130px_110px_90px] gap-4 items-center py-4 px-5 border-b border-slate-100 last:border-0">
            <div class="h-3 bg-slate-100 rounded animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-32"></div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-40"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-20"></div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-12 justify-self-end"></div>
          </div>
        </div>

        <div v-else-if="filteredBills.length === 0" class="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          </div>
          <div class="text-sm font-medium text-slate-900 mb-1">Nenhuma conta</div>
          <div class="text-xs text-slate-500 mb-4 max-w-xs">
            {{ search || statusFilter ? 'Nada bate com esses filtros.' : 'Crie a primeira conta a pagar.' }}
          </div>
          <button v-if="search || statusFilter || perms.can.create('payables')" @click="openCreateModal" class="text-xs font-medium text-slate-900 underline underline-offset-4 hover:no-underline">
            {{ search || statusFilter ? 'Limpar filtros' : 'Criar primeira conta' }}
          </button>
        </div>

        <div v-else>
          <div class="grid grid-cols-[110px_1.2fr_110px_1.2fr_130px_110px_90px] gap-4 text-[11px] text-slate-400 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <span>Vencimento</span>
            <span>Fornecedor</span>
            <span>Categoria</span>
            <span>Descrição</span>
            <span class="text-right">Valor</span>
            <span>Status</span>
            <span class="text-right">Ações</span>
          </div>

          <div v-for="bill in filteredBills" :key="bill.id"
               class="grid grid-cols-[110px_1.2fr_110px_1.2fr_130px_110px_90px] gap-4 items-center py-3.5 px-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group text-sm">
            <span class="text-xs text-slate-500">{{ formatDate(bill.dueDate) }}</span>
            <span class="text-slate-900 font-medium truncate">{{ bill.supplier?.name ?? '—' }}</span>
            <span>
              <span v-if="bill.category" class="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {{ bill.category }}
              </span>
              <span v-else class="text-xs text-slate-400">—</span>
            </span>
            <span class="text-slate-600 truncate">{{ bill.description }}</span>
            <span class="text-right font-medium" style="color:#A32D2D">R$ {{ formatCurrency(bill.amount) }}</span>
            <span>
              <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                    :style="bill.status === 'PAID' ? { background: '#E1F5EE', color: '#0F6E56' }
                          : bill.status === 'PENDING' ? { background: '#FAEEDA', color: '#854F0B' }
                          : bill.status === 'OVERDUE' ? { background: '#FCEBEB', color: '#A32D2D' }
                          : { background: '#F1EFE8', color: '#5F5E5A' }">
                <span class="w-1.5 h-1.5 rounded-full"
                      :style="bill.status === 'PAID' ? { background: '#1D9E75' }
                            : bill.status === 'PENDING' ? { background: '#BA7517' }
                            : bill.status === 'OVERDUE' ? { background: '#A32D2D' }
                            : { background: '#888780' }"></span>
                {{ statusLabel[bill.status] ?? bill.status }}
              </span>
            </span>
            <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button v-if="['PENDING','OVERDUE'].includes(bill.status) && perms.can.edit('payables')" @click="openPayModal(bill)"
                      class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
                      style="color:#1D9E75" title="Registrar pagamento"
                      onmouseover="this.style.background='#E1F5EE'" onmouseout="this.style.background='transparent'">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/></svg>
              </button>
              <button v-if="perms.can.edit('payables')" @click="openEditModal(bill)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Editar">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button v-if="!['PAID','CANCELLED'].includes(bill.status) && perms.can.edit('payables')" @click="cancelBill(bill.id)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Cancelar">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
              </button>
              <button v-if="perms.can.delete('payables')" @click="deleteBill(bill.id)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 px-4">
            <PaginationControls v-model:page="page" v-model:limit="limit" :total="total" :total-pages="totalPages"/>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal criar/editar -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showModal = false"></div>
        <div class="bg-white w-full max-w-md rounded-2xl border border-slate-200 relative z-10 flex flex-col max-h-[90vh]">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-base font-medium text-slate-900">{{ editingBill ? 'Editar conta' : 'Nova conta' }}</h3>
              <p class="text-xs text-slate-500 mt-0.5">Conta a pagar pra fornecedor</p>
            </div>
            <button @click="showModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form @submit.prevent="saveBill" class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Fornecedor</label>
                <select v-model.number="form.supplierId"
                        class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                  <option :value="null">Nenhum</option>
                  <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Categoria</label>
                <select v-model="form.category"
                        class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                  <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Descrição *</label>
              <input v-model="form.description" required maxlength="300" placeholder="Ex: aluguel de março"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Valor (R$) *</label>
                <input v-model.number="form.amount" type="number" step="0.01" min="0" required
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-400 transition-colors"
                       style="color:#A32D2D">
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Vencimento *</label>
                <input v-model="form.dueDate" type="date" required
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Observações</label>
              <textarea v-model="form.notes" rows="2" maxlength="500" placeholder="Opcional…"
                        class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors resize-none"/>
            </div>
          </form>

          <div class="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
            <button @click="showModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button @click="saveBill" :disabled="saving"
                    class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {{ saving ? 'Salvando…' : (editingBill ? 'Atualizar' : 'Criar conta') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal registrar pagamento -->
    <Teleport to="body">
      <div v-if="showPayModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showPayModal = false"></div>
        <div class="bg-white w-full max-w-sm rounded-2xl border border-slate-200 relative z-10 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 class="text-base font-medium text-slate-900">Registrar pagamento</h3>
              <p class="text-xs text-slate-500 mt-0.5">Confirma que a conta foi paga</p>
            </div>
            <button @click="showPayModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="px-6 pt-4">
            <div class="rounded-lg p-3 border" style="background:#FCEBEB; border-color:#F0C5C5">
              <div class="text-[11px]" style="color:#A32D2D">Conta</div>
              <div class="text-sm font-medium" style="color:#A32D2D">{{ payingBill?.description }}</div>
              <div class="text-xs mt-0.5" style="color:#A32D2D; opacity:.7">{{ payingBill?.supplier?.name ?? 'sem fornecedor' }} &middot; original R$ {{ formatCurrency(payingBill?.amount ?? 0) }}</div>
            </div>
          </div>

          <form @submit.prevent="savePayment" class="px-6 py-4 space-y-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Valor pago (R$) *</label>
              <input v-model.number="payForm.paidAmount" type="number" step="0.01" min="0" required
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Data do pagamento *</label>
              <input v-model="payForm.paidAt" type="date" required
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
          </form>

          <div class="px-6 py-4 border-t border-slate-100 flex gap-2">
            <button @click="showPayModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button @click="savePayment" :disabled="saving"
                    class="flex-1 py-2.5 rounded-full bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-sm font-medium transition-colors disabled:opacity-50">
              {{ saving ? 'Salvando…' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
