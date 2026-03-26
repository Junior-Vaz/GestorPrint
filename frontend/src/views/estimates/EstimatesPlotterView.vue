<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useEstimateBase } from '../../composables/useEstimateBase'
import type { EstimateRecord } from '../../composables/useEstimateBase'

const TYPE = 'plotter'
const CFG = {
  label: 'Impressão Plotter',
  accent: 'purple',
  svgPath: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
}

const auth = useAuthStore()

const {
  estimates, products, customers, dataLoading, listLoading, saving, showForm, editingId,
  form, attachments, uploadingFile, fileInputRef,
  handleAttachmentUpload, downloadAttachment, removeAttachment, fmtSize,
  productSearch, productsByCategory, filteredCustomers, selectCustomer, handleCustomerBlur,
  onCustomerSearchChange,
  fetchEstimates, fetchInitialData, saveEstimate, openNew, openPdf, convertToOrder, deleteEstimate, sendViaWhatsApp,
  productSummary, fmtCurrency, resetFormBase, loadEditingBase,
} = useEstimateBase()

// ── Type-specific form state (global: finishing + colors) ─────────────────────
const typeForm = reactive({
  finishingId: null as number | null,
  colors:      '4x0',
})

const selectedFinishing = computed(() => products.value.find(p => p.id === typeForm.finishingId))

watch(() => form.customerSearch, onCustomerSearchChange)

// ── Line items ────────────────────────────────────────────────────────────────
interface LineItem { key: string; materialId: number; qty: number; width: number; height: number }

const lineItems = ref<LineItem[]>([])
const showPicker = ref(false)

const getProduct = (id: number) => products.value.find(p => p.id === id)

function addItem(materialId: number) {
  const existing = lineItems.value.find(i => i.materialId === materialId)
  if (existing) { existing.qty++; showPicker.value = false; return }
  lineItems.value.push({ key: `${Date.now()}-${materialId}`, materialId, qty: 1, width: 100, height: 100 })
  showPicker.value = false
  syncProductName()
}

function removeItem(key: string) {
  lineItems.value = lineItems.value.filter(i => i.key !== key)
  syncProductName()
}

function syncProductName() {
  if (lineItems.value.length === 0) { form.productName = ''; return }
  if (lineItems.value.length === 1) {
    form.productName = getProduct(lineItems.value[0].materialId)?.name || ''
  } else {
    form.productName = `${lineItems.value.length} itens`
  }
}

// Preview for first item (used in canvas display)
const firstItem = computed(() => lineItems.value[0] ?? null)
const previewScale = computed(() => {
  const maxW = 400; const maxH = 280
  const w = firstItem.value?.width || 100; const h = firstItem.value?.height || 100
  const scale = Math.min(maxW / w, maxH / h) * 0.86
  return { w: Math.max(60, Math.round(w * scale)), h: Math.max(40, Math.round(h * scale)) }
})

// ── Price calculation ─────────────────────────────────────────────────────────
const subtotal = computed((): number => {
  const matTotal = lineItems.value.reduce((sum, item) => {
    const mat = getProduct(item.materialId)
    if (!mat) return sum
    const areaM2 = (item.width / 100) * (item.height / 100) * item.qty
    return sum + areaM2 * mat.unitPrice * (1 + (mat.markup || 0) / 100)
  }, 0)
  const fin = getProduct(typeForm.finishingId ?? -1)
  const totalQty = lineItems.value.reduce((s, i) => s + i.qty, 0)
  const finTotal = fin ? totalQty * fin.unitPrice * (1 + (fin.markup || 0) / 100) : 0
  return matTotal + finTotal
})
const discountAmount = computed((): number => {
  const s = subtotal.value
  return form.discountType === 'percent'
    ? s * (form.discount || 0) / 100
    : Math.min(form.discount || 0, s)
})
const totalPrice = computed((): number => Math.max(0, subtotal.value - discountAmount.value))

// ── Details builder ───────────────────────────────────────────────────────────
const buildDetails = () => ({
  estimateType: TYPE,
  productName: form.productName,
  quantity: lineItems.value.reduce((s, i) => s + i.qty, 0),
  discount: form.discount,
  discountType: form.discountType,
  discountAmount: discountAmount.value,
  finishingId: typeForm.finishingId || undefined,
  finishingName: selectedFinishing.value?.name,
  colors: typeForm.colors,
  lineItems: lineItems.value.map(i => {
    const mat = getProduct(i.materialId)
    return { materialId: i.materialId, materialName: mat?.name, unitPrice: mat?.unitPrice, markup: mat?.markup, qty: i.qty, width: i.width, height: i.height }
  }),
})

// ── Reset / Load ──────────────────────────────────────────────────────────────
const resetForm = () => {
  resetFormBase()
  typeForm.finishingId = null
  typeForm.colors = '4x0'
  lineItems.value = []
  showPicker.value = false
}

const loadEditing = (est: EstimateRecord) => {
  loadEditingBase(est)
  const d = est.details
  typeForm.finishingId = d.finishingId || null
  typeForm.colors = d.colors || '4x0'
  lineItems.value = (d.lineItems || []).map((li: any, idx: number) => ({
    key: `${idx}`,
    materialId: li.materialId ?? 0,
    qty: li.qty || 1,
    width: li.width || 100,
    height: li.height || 100,
  })).filter((li: any) => li.materialId > 0)
  // Fallback for old format
  if (lineItems.value.length === 0 && d.materialId) {
    lineItems.value = [{ key: '0', materialId: d.materialId, qty: d.quantity || 1, width: d.width || 100, height: d.height || 100 }]
  }
}

onMounted(async () => {
  await fetchInitialData(resetForm)
  await fetchEstimates(TYPE)
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">

    <!-- ─── LIST VIEW ──────────────────────────────────────────────────────── -->
    <template v-if="!showForm">

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
        <div class="flex items-center gap-4">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <svg class="h-8 w-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="CFG.svgPath"/>
              </svg>
              {{ CFG.label }}</h1>
            <p class="text-slate-500 mt-1 font-medium italic text-sm">Gerencie orçamentos e acompanhe status de aprovação</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button @click="fetchEstimates(TYPE)" :disabled="listLoading" class="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-200 transition-all shadow active:scale-95">
            <div v-if="listLoading" class="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Atualizar
          </button>
          <button @click="openNew(resetForm)" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Novo Orçamento
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-5">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total</div>
          <div class="text-2xl font-black text-slate-800">{{ estimates.length }}</div>
        </div>
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-5">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Aprovados</div>
          <div class="text-2xl font-black text-emerald-500">{{ estimates.filter(e => e.status === 'APPROVED').length }}</div>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div v-if="listLoading" class="flex items-center justify-center p-20">
          <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-100">
                <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Ref / Cliente</th>
                <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Produto / Serviço</th>
                <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Valor</th>
                <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="est in estimates" :key="est.id" class="hover:bg-indigo-50/30 transition-colors">
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2 mb-0.5">
                    <div class="text-[10px] font-mono font-bold text-slate-400">#ORC-{{ est.id }}</div>
                    <div v-if="est.salesperson" class="flex items-center gap-1 bg-blue-50 text-blue-600 px-1.5 py-px rounded text-[8px] font-bold">
                      {{ est.salesperson.name.split(' ')[0] }}
                    </div>
                  </div>
                  <div class="font-bold text-slate-800 leading-none">{{ est.customer.name }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm font-semibold text-slate-700">{{ productSummary(est).name }}</div>
                  <div class="text-[10px] text-slate-400">{{ productSummary(est).sub }}</div>
                </td>
                <td class="px-6 py-4">
                  <span :class="['px-3 py-1 text-xs font-black rounded-lg inline-flex', est.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600']">
                    {{ est.status === 'APPROVED' ? 'Aprovado' : 'Pendente' }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="font-mono text-sm font-bold text-slate-800">{{ fmtCurrency(est.totalPrice) }}</div>
                  <div class="text-[10px] text-slate-400">{{ new Date(est.createdAt).toLocaleDateString('pt-BR') }}</div>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex justify-end gap-2">
                    <button v-if="auth.isAdmin" @click="loadEditing(est)" title="Editar" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-all">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button @click="openPdf(est.id)" title="PDF" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-all">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path></svg>
                    </button>
                    <button @click="sendViaWhatsApp(est)" title="WhatsApp" class="text-emerald-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-md transition-all">
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    </button>
                    <button v-if="est.status !== 'APPROVED'" @click="convertToOrder(est.id, TYPE)" title="Aprovar" class="text-slate-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-md transition-all">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                    <button v-if="auth.isAdmin" @click="deleteEstimate(est.id, TYPE)" title="Excluir" class="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-all">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="estimates.length === 0 && !listLoading">
                <td colspan="5" class="px-6 py-16 text-center text-slate-400 font-medium italic">Nenhum orçamento encontrado. Clique em <strong>Novo Orçamento</strong> para começar.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ─── FORM VIEW ──────────────────────────────────────────────────────── -->
    <template v-else>
      <div v-if="dataLoading" class="flex items-center justify-center py-24">
        <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <template v-else>
        <!-- Flex row: left scrolls with page, right is sticky -->
        <div class="flex gap-5 pb-10">

          <!-- ─── Left: Header + Fields ─── -->
          <div class="flex-1 min-w-0 flex flex-col gap-6">

            <!-- Form Header (inside left column only) -->
            <div class="bg-white/50 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50 flex items-center gap-4 shrink-0">
              <button @click="showForm = false; resetForm()" class="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-800 shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <svg class="h-6 w-6 text-slate-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="CFG.svgPath"/>
              </svg>
              <div>
                <h1 class="text-2xl font-extrabold text-slate-800">{{ editingId ? 'Editar Orçamento' : `Novo Orçamento — ${CFG.label}` }}</h1>
                <p v-if="editingId" class="text-slate-500 text-sm mt-0.5">Editando ref #ORC-{{ editingId }}</p>
              </div>
            </div>

            <!-- Fields card -->
            <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-8 space-y-8">

              <!-- Common: Customer + Product Name -->
              <div>
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4">Informações do Pedido</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Customer -->
                  <div class="relative">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Cliente</label>
                    <input v-model="form.customerSearch" @focus="form.showCustomerDrop = true" @input="form.showCustomerDrop = true" @blur="handleCustomerBlur"
                      type="text" placeholder="Buscar cliente..."
                      class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"/>
                    <div v-if="form.showCustomerDrop && filteredCustomers.length > 0" class="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                      <button v-for="c in filteredCustomers" :key="c.id" @mousedown.prevent="selectCustomer(c)"
                        class="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors first:rounded-t-xl last:rounded-b-xl">{{ c.name }}</button>
                    </div>
                  </div>
                  <!-- Product Name -->
                  <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Nome do Orçamento</label>
                    <input v-model="form.productName" type="text" placeholder="Ex: Lona fachada 3x1m"
                      class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"/>
                  </div>
                </div>
              </div>

              <!-- ── PLOTTER global options ──────────────────────────────────── -->
              <div>
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4">Especificações Globais</h3>
                <div class="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Cores</label>
                    <select v-model="typeForm.colors"
                      class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
                      <option value="4x0">4x0 (Frente)</option>
                      <option value="4x4">4x4 (F/V)</option>
                      <option value="1x0">1x0 (Preto)</option>
                    </select>
                  </div>
                </div>
                <!-- Finishing selector -->
                <div class="pt-4 border-t border-slate-100">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Acabamento (opcional)</label>
                  <div class="flex flex-wrap gap-2">
                    <template v-for="group in productsByCategory" :key="group.name">
                      <template v-for="p in group.products" :key="p.id">
                        <button type="button" @click="typeForm.finishingId = typeForm.finishingId === p.id ? null : p.id"
                          :class="['px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
                            typeForm.finishingId === p.id ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300']">
                          {{ p.name }} · R$ {{ p.unitPrice.toFixed(2) }}
                        </button>
                      </template>
                    </template>
                  </div>
                </div>
              </div>

              <!-- ── Items section ──────────────────────────────────────────── -->
              <div>
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Itens do Orçamento (Materiais)</h3>

                <!-- Items list -->
                <div class="space-y-2 mb-3">
                  <div v-for="item in lineItems" :key="item.key"
                    class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl group flex-wrap">
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-semibold text-slate-700 truncate">{{ getProduct(item.materialId)?.name ?? '—' }}</div>
                      <div class="text-[10px] text-slate-400">
                        R$ {{ (getProduct(item.materialId)?.unitPrice ?? 0).toFixed(2) }}/{{ getProduct(item.materialId)?.unit ?? 'm²' }}
                      </div>
                    </div>
                    <!-- Width × Height inputs -->
                    <div class="flex items-center gap-1 text-xs shrink-0">
                      <input v-model.number="item.width" type="number" min="1" placeholder="Larg."
                        class="w-16 text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs font-bold text-slate-700 outline-none focus:border-purple-400"/>
                      <span class="text-slate-400">×</span>
                      <input v-model.number="item.height" type="number" min="1" placeholder="Alt."
                        class="w-16 text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs font-bold text-slate-700 outline-none focus:border-purple-400"/>
                      <span class="text-slate-400 text-[10px]">cm</span>
                    </div>
                    <!-- Qty -->
                    <div class="flex items-center gap-1 shrink-0">
                      <button type="button" @click="item.qty = Math.max(1, item.qty - 1)"
                        class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center">−</button>
                      <input v-model.number="item.qty" type="number" min="1"
                        class="w-12 text-center bg-white border border-slate-200 rounded-lg py-1 text-sm font-bold text-slate-700 outline-none"/>
                      <button type="button" @click="item.qty++"
                        class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center">+</button>
                    </div>
                    <button type="button" @click="removeItem(item.key)"
                      class="shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div v-if="lineItems.length === 0" class="text-center py-5 text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhum material adicionado ainda
                  </div>
                </div>

                <!-- Add button + floating picker -->
                <div class="relative">
                  <button type="button" @click="showPicker = !showPicker"
                    class="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 border-dashed text-purple-700 font-bold rounded-xl transition-all text-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Adicionar material
                  </button>

                  <!-- Picker: positioned above button -->
                  <div v-if="showPicker"
                    class="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 flex flex-col"
                    style="max-height: 340px;">
                    <div class="p-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
                      <span class="text-xs font-black text-slate-500 uppercase tracking-widest">Selecionar material</span>
                      <button type="button" @click="showPicker = false" class="text-slate-400 hover:text-slate-600 p-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <div class="p-3 border-b border-slate-100 shrink-0">
                      <input v-model="productSearch" type="text" placeholder="Filtrar por nome..."
                        class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"/>
                    </div>
                    <div class="overflow-y-auto flex-1 p-3 space-y-3">
                      <div v-for="group in productsByCategory" :key="group.name">
                        <div class="text-[9px] font-black px-2 py-0.5 rounded text-white mb-1.5 inline-block" :style="{ backgroundColor: group.color }">{{ group.name }}</div>
                        <div class="space-y-1">
                          <button v-for="p in group.products" :key="p.id" type="button" @click="addItem(p.id)"
                            :class="['w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all text-sm',
                              lineItems.some(i => i.materialId === p.id) ? 'border-purple-400 bg-purple-50' : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50']">
                            <div class="min-w-0">
                              <span class="font-semibold text-slate-700 truncate block">{{ p.name }}</span>
                              <span class="text-[10px] text-slate-400">R$ {{ p.unitPrice.toFixed(2) }}/{{ p.unit }}</span>
                            </div>
                            <svg v-if="lineItems.some(i => i.materialId === p.id)" class="w-4 h-4 text-purple-500 shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                            <svg v-else class="w-4 h-4 text-slate-300 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Common: Desconto -->
              <div class="pt-4 border-t border-slate-100">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Desconto</label>
                <div class="flex items-center gap-2">
                  <input v-model.number="form.discount" type="number" min="0" :max="form.discountType === 'percent' ? 100 : undefined"
                    class="w-28 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"/>
                  <div class="flex rounded-xl overflow-hidden border border-slate-200">
                    <button type="button" @click="form.discountType = 'percent'"
                      :class="form.discountType === 'percent' ? 'bg-indigo-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
                      class="px-3 py-3 text-sm font-bold transition-colors">%</button>
                    <button type="button" @click="form.discountType = 'fixed'"
                      :class="form.discountType === 'fixed' ? 'bg-indigo-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
                      class="px-3 py-3 text-sm font-bold transition-colors">R$</button>
                  </div>
                </div>
              </div>

              <!-- ── Anexos ─────────────────────────────────────────────────── -->
              <div class="pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anexos</h3>
                  <button v-if="editingId" @click="fileInputRef?.click()" :disabled="uploadingFile"
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                    <span v-if="uploadingFile" class="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                    <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Adicionar arquivo
                  </button>
                </div>
                <input ref="fileInputRef" type="file" class="hidden" @change="handleAttachmentUpload"/>
                <div v-if="attachments.length > 0" class="space-y-2">
                  <div v-for="a in attachments" :key="a.id" class="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-semibold text-slate-700 truncate">{{ a.originalName }}</div>
                      <div class="text-[10px] text-slate-400">{{ fmtSize(a.size) }}</div>
                    </div>
                    <button @click="downloadAttachment(a.filename)" title="Download" class="p-1.5 hover:bg-slate-200 rounded-lg transition-all text-slate-400 hover:text-indigo-600">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    </button>
                    <button @click="removeAttachment(a.id)" title="Remover" class="p-1.5 hover:bg-red-50 rounded-lg transition-all text-slate-400 hover:text-red-500">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <p v-if="!editingId" class="text-[10px] text-slate-400 italic mt-1">Salve o orçamento primeiro para adicionar anexos.</p>
                <p v-else-if="attachments.length === 0 && !uploadingFile" class="text-[10px] text-slate-400 italic mt-1">Nenhum arquivo anexado.</p>
              </div>

            </div>
          </div><!-- /left -->

          <!-- ─── Right: Sticky Preview + Resumo ─── -->
          <div class="w-2/5 shrink-0 sticky top-0 self-start" style="max-height: calc(100vh - 7rem);">

              <!-- ── Visual Preview ── -->
              <div class="rounded-2xl shadow-2xl overflow-hidden  border-slate-700/60 flex flex-col" style="max-height: calc(100vh - 7rem);">
                <!-- Window chrome -->
                <div class="bg-[#eeeeee] px-4 py-2 flex items-center gap-2 shrink-0">
                  <div class="flex gap-1.5">
                    <div class="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                  </div>
                  <span class="text-[10px] font-mono text-slate-500 ml-2">impressao-plotter.cdr</span>
                </div>

                <!-- Canvas body -->
                <div class="bg-[#2d2d2d] flex items-center justify-center relative flex-1 overflow-hidden"
                     style="background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px); background-size: 20px 20px;">

                  <template v-if="firstItem">
                    <!-- Substrate / folha-base -->
                    <div class="relative flex items-center justify-center"
                         style="width: 500px; height: 600px; filter: drop-shadow(0 8px 36px rgba(0,0,0,0.85)) drop-shadow(0 0 60px rgba(139,92,246,0.08));">

                      <!-- A folha de mídia -->
                      <div class="absolute inset-0" style="border-radius: 2px; background: linear-gradient(180deg,#ebebeb 0%,#e0e0e0 40%,#e0e0e0 60%,#ebebeb 100%);">
                        <div class="absolute inset-0" style="background-size: 14px 14px; border-radius: 2px; background-color: white;"></div>
                        <div class="absolute bottom-1.5 right-2 text-[7px] font-mono text-slate-400/50 select-none tracking-widest">SUBSTRATE</div>
                      </div>

                      <!-- Área de impressão proporcional -->
                      <div class="absolute bottom-0 right-0 bg-white transition-all duration-300 ease-out"
                           :style="{ width: previewScale.w + 'px', height: previewScale.h + 'px' }">
                        <div class="absolute inset-0 opacity-25 pointer-events-none"
                             style="background: linear-gradient(0deg,#7c3aed 0%,#a78bfa 70%,#c084fc 100%);"></div>
                        <div class="absolute inset-0 opacity-10 pointer-events-none"
                             style="background-image: radial-gradient(circle,#6366f1 1px,transparent 1px); background-size: 7px 7px;"></div>
                        <div class="absolute inset-2 border border-dashed border-gray-800/40 pointer-events-none"></div>
                        <div class="absolute -top-3 -left-3 text-gray-600/90 text-xs font-mono select-none leading-none">+</div>
                        <div class="absolute -top-3 -right-3 text-gray-600/90 text-xs font-mono select-none leading-none">+</div>
                        <div class="absolute -bottom-3 -left-3 text-gray-600/90 text-xs font-mono select-none leading-none">+</div>
                        <div class="absolute -bottom-3 -right-3 text-gray-600/90 text-xs font-mono select-none leading-none">+</div>
                        <div class="absolute -top-8 left-0 right-0 flex items-center justify-center gap-1">
                          <div class="flex-1 h-px bg-gray-800/50"></div>
                          <span class="text-[9px] font-mono text-gray-800 whitespace-nowrap">{{ firstItem.width }} cm</span>
                          <div class="flex-1 h-px bg-gray-800/50"></div>
                        </div>
                        <div class="absolute -left-11 top-0 bottom-0 flex items-center justify-center">
                          <span class="text-[9px] font-mono text-gray-600 -rotate-90 whitespace-nowrap">{{ firstItem.height }} cm</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else>
                    <div class="flex flex-col items-center gap-3 opacity-40">
                      <svg class="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" :d="CFG.svgPath"/>
                      </svg>
                      <span class="text-[10px] font-mono text-slate-500">adicione materiais</span>
                    </div>
                  </template>
                </div>

                <!-- Status bar -->
                <div class="bg-[#f0f0f0] px-4 py-1.5 flex items-center justify-between border-t border-slate-200/50 shrink-0">
                  <span class="text-[9px] font-mono text-slate-500">{{ lineItems.length }} {{ lineItems.length === 1 ? 'material' : 'materiais' }} · {{ typeForm.colors }}</span>
                  <span class="text-[9px] font-mono text-purple-400">{{ lineItems.reduce((s,i) => s+i.qty, 0) }} un total</span>
                </div>

                <!-- ── Resumo compacto ── -->
                <div class="bg-slate-900 px-5 py-3.5 flex items-center justify-between shrink-0">
                  <div>
                    <div class="text-green-500 text-[9px] font-black uppercase tracking-widest mb-1">Resumo</div>
                    <div class="flex items-center gap-2 text-slate-400 text-xs flex-wrap">
                      <span>{{ lineItems.length }} {{ lineItems.length === 1 ? 'item' : 'itens' }}</span>
                      <span v-if="selectedFinishing" class="text-slate-500 truncate">· {{ selectedFinishing.name }}</span>
                    </div>
                  </div>
                  <span class="text-2xl font-black text-green-500 font-mono shrink-0 ml-3">{{ fmtCurrency(totalPrice) }}</span>
                </div>
                <div class="px-4 py-3 flex gap-2 bg-slate-800 shrink-0">
                  <button @click="saveEstimate(TYPE, totalPrice, buildDetails)" :disabled="saving"
                    class="flex-1 py-2.5 bg-green-700 hover:bg-green-900 cursor-pointer text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-sm">
                    <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                    {{ editingId ? 'Atualizar' : 'Salvar Orçamento' }}
                  </button>
                  <button @click="showForm = false; resetForm()"
                    class="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl border border-slate-600 transition-all active:scale-95 text-sm">
                    Cancelar
                  </button>
                </div>
              </div><!-- /preview card -->

          </div><!-- /sticky w-2/5 -->
        </div><!-- /flex gap-6 -->
      </template>
    </template>
  </div>
</template>
