<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useEstimateBase } from '../../composables/useEstimateBase'
import type { EstimateRecord } from '../../composables/useEstimateBase'
import ApproveEstimateModal from '../../components/shared/ApproveEstimateModal.vue'

const TYPE = 'service'
const CFG = {
  label: 'Serviço / Insumo',
  accent: 'indigo',
  svgPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

const auth = useAuthStore()
const perms = usePermissionsStore()

const {
  estimates, products, customers, dataLoading, listLoading, saving, showForm, editingId,
  form, attachments, uploadingFile, fileInputRef,
  handleAttachmentUpload, downloadAttachment, removeAttachment, fmtSize,
  productSearch, productsByCategory, filteredCustomers, selectCustomer, handleCustomerBlur,
  onCustomerSearchChange,
  fetchEstimates, fetchInitialData, saveEstimate, openNew, openPdf, convertToOrder, deleteEstimate, sendViaWhatsApp,
  productSummary, fmtCurrency, resetFormBase, loadEditingBase,
  approveTarget, approveDate, approvePriority, approving, confirmApprove, cancelApprove,
} = useEstimateBase('service')

// ── Line items ────────────────────────────────────────────────────────────────
interface LineItem { key: string; productId: number; qty: number }

const lineItems = ref<LineItem[]>([])
const showPicker = ref(false)
const categoryFilter = ref<string | null>(null) // null = todas as categorias

// Lista filtrada por categoria selecionada (mantém o agrupamento por grupo)
const filteredProductGroups = computed(() => {
  if (!categoryFilter.value) return productsByCategory.value
  return productsByCategory.value.filter(g => g.name === categoryFilter.value)
})

// Total de produtos visíveis (pra mostrar no badge "Todos")
const totalProductsCount = computed(() =>
  productsByCategory.value.reduce((sum, g) => sum + g.products.length, 0),
)

const getProduct = (id: number) => products.value.find(p => p.id === id)

function addItem(productId: number) {
  const existing = lineItems.value.find(i => i.productId === productId)
  if (existing) { existing.qty++; showPicker.value = false; return }
  lineItems.value.push({ key: `${Date.now()}-${productId}`, productId, qty: 1 })
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
    form.productName = getProduct(lineItems.value[0]!.productId)?.name || ''
  } else {
    form.productName = `${lineItems.value.length} itens`
  }
}

watch(() => form.customerSearch, onCustomerSearchChange)

// ── Price calculation ─────────────────────────────────────────────────────────
const subtotal = computed((): number =>
  lineItems.value.reduce((sum, item) => {
    const p = getProduct(item.productId)
    if (!p) return sum
    return sum + p.unitPrice * item.qty * (1 + (p.markup || 0) / 100)
  }, 0)
)
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
  lineItems: lineItems.value.map(i => {
    const p = getProduct(i.productId)
    return { productId: i.productId, productName: p?.name, unitPrice: p?.unitPrice, markup: p?.markup, qty: i.qty }
  }),
})

// ── Reset / Load ──────────────────────────────────────────────────────────────
const resetForm = () => {
  resetFormBase()
  lineItems.value = []
  showPicker.value = false
}

const loadEditing = (est: EstimateRecord) => {
  loadEditingBase(est)
  const d = est.details
  lineItems.value = (d.lineItems || []).map((li: any, idx: number) => ({
    key: `${idx}`,
    productId: li.productId ?? 0,
    qty: li.qty || 1,
  })).filter((li: any) => li.productId > 0)
  // Fallback for old format
  if (lineItems.value.length === 0 && d.productId) {
    lineItems.value = [{ key: '0', productId: d.productId, qty: d.quantity || 1 }]
  }
}

onMounted(async () => {
  await fetchInitialData(resetForm)
  await fetchEstimates(TYPE)
})
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10 space-y-5">

    <!-- ─── LIST VIEW ──────────────────────────────────────────────────────── -->
    <template v-if="!showForm">

      <!-- Header — padrão moderno (compacto, alinha com Clientes/Produtos/Pedidos) -->
      <div class="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">{{ CFG.label }}</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="estimates.length > 0">{{ estimates.length }} {{ estimates.length === 1 ? 'orçamento cadastrado' : 'orçamentos cadastrados' }}</span>
            <span v-else>Crie o primeiro orçamento de serviço/insumo</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button @click="fetchEstimates(TYPE)" :disabled="listLoading"
            class="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
            <div v-if="listLoading" class="h-3.5 w-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            <svg v-else class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Atualizar
          </button>
          <button v-if="perms.can.create('estimates')" @click="openNew(resetForm)"
            class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors shrink-0">
            <span class="text-base leading-none">+</span>
            Novo orçamento
          </button>
        </div>
      </div>

      <!-- KPIs com ícones (mesmo padrão da Pedidos/Resumo Ecommerce) -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
          <div class="flex items-start justify-between">
            <div class="text-xs text-slate-500">Total de orçamentos</div>
            <div class="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
          </div>
          <div class="text-2xl font-medium text-slate-900 mt-2">{{ estimates.length }}</div>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
          <div class="flex items-start justify-between">
            <div class="text-xs text-slate-500">Aprovados</div>
            <div class="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>
          <div class="text-2xl font-medium mt-2" style="color:#1D9E75">{{ estimates.filter(e => e.status === 'APPROVED').length }}</div>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
          <div class="flex items-start justify-between">
            <div class="text-xs text-slate-500">Em aberto</div>
            <div class="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="text-2xl font-medium text-slate-900 mt-2">
            R$ {{ estimates.filter(e => e.status !== 'APPROVED').reduce((s, e) => s + e.totalPrice, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}
          </div>
        </div>
      </div>

      <!-- Tabela -->
      <div class="border border-slate-200 rounded-xl overflow-hidden">
        <div v-if="listLoading" class="flex items-center justify-center py-16">
          <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-200">
                <th class="px-5 py-3 text-xs font-medium text-slate-500">Ref / Cliente</th>
                <th class="px-5 py-3 text-xs font-medium text-slate-500">Produto / Serviço</th>
                <th class="px-5 py-3 text-xs font-medium text-slate-500">Status</th>
                <th class="px-5 py-3 text-xs font-medium text-slate-500">Valor</th>
                <th class="px-5 py-3 text-xs font-medium text-slate-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="est in estimates" :key="est.id" class="border-b border-slate-100 hover:bg-slate-50/60 transition-colors group">
                <td class="px-5 py-3">
                  <div class="text-sm font-medium text-slate-900 truncate">{{ est.customer.name }}</div>
                  <div class="text-[11px] text-slate-400">
                    #ORC-{{ est.id }}
                    <span v-if="est.salesperson"> · {{ est.salesperson.name.split(' ')[0] }}</span>
                  </div>
                </td>
                <td class="px-5 py-3">
                  <div class="text-sm text-slate-700">{{ productSummary(est).name }}</div>
                  <div class="text-[11px] text-slate-400">{{ productSummary(est).sub }}</div>
                </td>
                <td class="px-5 py-3">
                  <span :class="['inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium', est.status === 'APPROVED' ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-slate-100 text-slate-600']">
                    <span :class="['w-1 h-1 rounded-full', est.status === 'APPROVED' ? 'bg-[#1D9E75]' : 'bg-slate-400']"></span>
                    {{ est.status === 'APPROVED' ? 'Aprovado' : 'Pendente' }}
                  </span>
                </td>
                <td class="px-5 py-3">
                  <div class="text-sm font-medium text-slate-900">{{ fmtCurrency(est.totalPrice) }}</div>
                  <div class="text-[11px] text-slate-400">{{ new Date(est.createdAt).toLocaleDateString('pt-BR') }}</div>
                </td>
                <td class="px-5 py-3">
                  <div class="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button v-if="perms.can.edit('estimates')" @click="loadEditing(est)" title="Editar" class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button @click="openPdf(est.id)" title="PDF" class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
                    </button>
                    <button @click="sendViaWhatsApp(est)" title="WhatsApp" class="w-7 h-7 rounded-lg hover:bg-[#E1F5EE] flex items-center justify-center text-slate-500 transition-colors" onmouseover="this.style.color='#1D9E75'" onmouseout="this.style.color=''">
                      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157z"/></svg>
                    </button>
                    <button v-if="est.status !== 'APPROVED' && perms.can.edit('estimates')" @click="convertToOrder(est.id, TYPE)" title="Aprovar" class="w-7 h-7 rounded-lg hover:bg-[#E1F5EE] flex items-center justify-center text-slate-500 transition-colors" onmouseover="this.style.color='#1D9E75'" onmouseout="this.style.color=''">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </button>
                    <button v-if="perms.can.delete('estimates')" @click="deleteEstimate(est.id, TYPE)" title="Excluir" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 transition-colors" onmouseover="this.style.background='#FCEBEB';this.style.color='#A32D2D'" onmouseout="this.style.background='';this.style.color=''">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="estimates.length === 0 && !listLoading">
                <td colspan="5" class="px-5 py-12 text-center text-sm text-slate-400">
                  Nenhum orçamento encontrado. Clique em <strong>Novo orçamento</strong> para começar.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ─── FORM VIEW ──────────────────────────────────────────────────────── -->
    <template v-else>
      <div v-if="dataLoading" class="flex items-center justify-center py-24">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>

      <template v-else>
        <!-- Form Header -->
        <div class="flex items-center gap-3 flex items-center gap-4">
          <button @click="showForm = false; resetForm()" class="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-800 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <svg class="h-6 w-6 text-slate-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="CFG.svgPath"/>
          </svg>
          <div>
            <h1 class="text-xl font-medium text-slate-900">{{ editingId ? 'Editar Orçamento' : `Novo Orçamento — ${CFG.label}` }}</h1>
            <p v-if="editingId" class="text-slate-500 text-sm mt-0.5">Editando ref #ORC-{{ editingId }}</p>
          </div>
        </div>

        <!-- Form Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 pb-10">

          <!-- ─── Left: Fields ─── -->
          <div class="lg:col-span-3 space-y-6">
            <div class="border border-slate-200 rounded-xl p-8 space-y-8">

              <!-- Common: Customer + Product Name -->
              <div>
                <h3 class="text-xs text-slate-500 ml-1 mb-4">Informações do Pedido</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Customer -->
                  <div class="relative">
                    <label class="text-xs text-slate-500 ml-1 block mb-1.5">Cliente</label>
                    <input v-model="form.customerSearch" @focus="form.showCustomerDrop = true" @input="form.showCustomerDrop = true" @blur="handleCustomerBlur"
                      type="text" placeholder="Buscar cliente..."
                      class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"/>
                    <div v-if="form.showCustomerDrop && filteredCustomers.length > 0" class="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      <button v-for="c in filteredCustomers" :key="c.id" @mousedown.prevent="selectCustomer(c)"
                        class="w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg">{{ c.name }}</button>
                    </div>
                  </div>
                  <!-- Product Name -->
                  <div>
                    <label class="text-xs text-slate-500 ml-1 block mb-1.5">Nome do Orçamento</label>
                    <input v-model="form.productName" type="text" placeholder="Ex: Lona fachada 3x1m"
                      class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"/>
                  </div>
                </div>
              </div>

              <!-- ── Items section ─────────────────────────────────────────── -->
              <div>
                <h3 class="text-xs text-slate-500 ml-1 mb-3">Itens do Orçamento</h3>

                <!-- Items list -->
                <div class="space-y-2 mb-3">
                  <div v-for="item in lineItems" :key="item.key"
                    class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl group">
                    <div class="flex-1 min-w-0">
                      <div class="text-sm text-slate-800 truncate">{{ getProduct(item.productId)?.name ?? '—' }}</div>
                      <div class="text-[10px] text-slate-400">
                        R$ {{ (getProduct(item.productId)?.unitPrice ?? 0).toFixed(2) }}/{{ getProduct(item.productId)?.unit ?? 'un' }}
                      </div>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <button type="button" @click="item.qty = Math.max(1, item.qty - 1)"
                        class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center">−</button>
                      <input v-model.number="item.qty" type="number" min="1"
                        class="w-12 text-center bg-white border border-slate-200 rounded-lg py-1 text-sm text-slate-800 outline-none"/>
                      <button type="button" @click="item.qty++"
                        class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center">+</button>
                    </div>
                    <button type="button" @click="removeItem(item.key)"
                      class="shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div v-if="lineItems.length === 0" class="text-center py-5 text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhum item adicionado ainda
                  </div>
                </div>

                <!-- Add button + floating picker -->
                <div class="relative">
                  <button type="button" @click="showPicker = !showPicker"
                    class="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg transition-all text-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Adicionar item
                  </button>

                  <!-- Picker: abre PRA BAIXO -->
                  <div v-if="showPicker"
                    class="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
                    style="max-height: 420px;">
                    <!-- Header -->
                    <div class="px-3 py-2.5 border-b border-slate-100 shrink-0 flex items-center justify-between">
                      <span class="text-xs font-medium text-slate-700">Selecionar produto</span>
                      <button type="button" @click="showPicker = false" class="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>

                    <!-- Search input -->
                    <div class="px-3 pt-3 shrink-0">
                      <div class="relative">
                        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input v-model="productSearch" type="text" placeholder="Filtrar por nome..."
                          class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"/>
                      </div>
                    </div>

                    <!-- Filtros por categoria (pills) -->
                    <div class="px-3 py-2 border-b border-slate-100 shrink-0 overflow-x-auto no-scrollbar">
                      <div class="flex items-center gap-1.5 flex-nowrap">
                        <button type="button" @click="categoryFilter = null"
                          :class="['shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border transition-all',
                            categoryFilter === null ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400']">
                          Todos <span class="opacity-60 ml-1">{{ totalProductsCount }}</span>
                        </button>
                        <button v-for="g in productsByCategory" :key="g.name" type="button" @click="categoryFilter = g.name"
                          :class="['shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1.5',
                            categoryFilter === g.name ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400']"
                          :style="categoryFilter === g.name ? { backgroundColor: g.color } : {}">
                          <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: categoryFilter === g.name ? 'rgba(255,255,255,0.8)' : g.color }"></span>
                          {{ g.name }} <span class="opacity-60">{{ g.products.length }}</span>
                        </button>
                      </div>
                    </div>

                    <!-- Lista -->
                    <div class="overflow-y-auto flex-1 p-3 space-y-3">
                      <div v-for="group in filteredProductGroups" :key="group.name">
                        <div v-if="!categoryFilter" class="text-[9px] font-medium px-2 py-0.5 rounded text-white mb-1.5 inline-block" :style="{ backgroundColor: group.color }">{{ group.name }}</div>
                        <div class="space-y-1">
                          <button v-for="p in group.products" :key="p.id" type="button" @click="addItem(p.id)"
                            :class="['w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all text-sm',
                              lineItems.some(i => i.productId === p.id) ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50']">
                            <div class="min-w-0">
                              <span class="text-slate-800 truncate block">{{ p.name }}</span>
                              <span class="text-[10px] text-slate-400">R$ {{ p.unitPrice.toFixed(2) }}/{{ p.unit }}</span>
                            </div>
                            <svg v-if="lineItems.some(i => i.productId === p.id)" class="w-4 h-4 text-indigo-600 shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                            <svg v-else class="w-4 h-4 text-slate-300 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                          </button>
                        </div>
                      </div>
                      <!-- Empty state quando não tem nenhum produto -->
                      <div v-if="filteredProductGroups.length === 0" class="text-center py-8 text-xs text-slate-400">
                        <span v-if="productSearch || categoryFilter">Nenhum produto encontrado com esse filtro.</span>
                        <span v-else>Nenhum produto cadastrado.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Common: Desconto -->
              <div class="pt-4 border-t border-slate-100">
                <label class="text-xs text-slate-500 ml-1 block mb-1.5">Desconto</label>
                <div class="flex items-center gap-2">
                  <input v-model.number="form.discount" type="number" min="0" :max="form.discountType === 'percent' ? 100 : undefined"
                    class="w-28 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"/>
                  <div class="flex rounded-xl overflow-hidden border border-slate-200">
                    <button type="button" @click="form.discountType = 'percent'"
                      :class="form.discountType === 'percent' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
                      class="px-3 py-3 text-sm font-bold transition-colors">%</button>
                    <button type="button" @click="form.discountType = 'fixed'"
                      :class="form.discountType === 'fixed' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
                      class="px-3 py-3 text-sm font-bold transition-colors">R$</button>
                  </div>
                </div>
              </div>

              <!-- ── Anexos ─────────────────────────────────────────────────── -->
              <div class="pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-xs text-slate-500">Anexos</h3>
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
                      <div class="text-xs text-slate-800 truncate">{{ a.originalName }}</div>
                      <div class="text-[10px] text-slate-400">{{ fmtSize(a.size) }}</div>
                    </div>
                    <button @click="downloadAttachment(a.filename)" title="Download" class="p-1.5 hover:bg-slate-200 rounded-lg transition-all text-slate-400 hover:text-slate-700">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    </button>
                    <button @click="removeAttachment(a.id)" title="Remover" class="p-1.5 hover:bg-red-50 rounded-lg transition-all text-slate-400 hover:text-red-500">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <p v-if="!editingId" class="text-[10px] text-slate-400  mt-1">Salve o orçamento primeiro para adicionar anexos.</p>
                <p v-else-if="attachments.length === 0 && !uploadingFile" class="text-[10px] text-slate-400  mt-1">Nenhum arquivo anexado.</p>
              </div>

            </div>
          </div>

          <!-- ─── Right: Carrinho (mesmo visual do PDV) ─── -->
          <div class="lg:col-span-2">
            <aside class="bg-slate-50 rounded-2xl border border-slate-200 flex flex-col h-fit lg:sticky lg:top-2 max-h-[calc(100vh-120px)]">

              <!-- Header do carrinho -->
              <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="text-base font-medium text-slate-900">Itens do orçamento</div>
                  <span v-if="lineItems.length" class="text-xs text-slate-400">{{ lineItems.length }}</span>
                </div>
                <button v-if="lineItems.length > 0" @click="lineItems = []; syncProductName()"
                  class="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 transition-colors">
                  Limpar
                </button>
              </div>

              <!-- Itens -->
              <div class="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
                <div v-if="lineItems.length === 0" class="h-full flex flex-col items-center justify-center py-10 text-center gap-2">
                  <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                  </div>
                  <div class="text-sm text-slate-500">Nenhum item ainda</div>
                  <div class="text-xs text-slate-400">Adicione produtos no formulário ao lado</div>
                </div>

                <TransitionGroup name="list">
                  <div v-for="item in lineItems" :key="item.key" class="bg-white border border-slate-200 rounded-lg p-3">
                    <div class="flex justify-between items-start gap-2 mb-3">
                      <div class="min-w-0">
                        <div class="text-sm text-slate-900 font-medium truncate">{{ getProduct(item.productId)?.name ?? '—' }}</div>
                        <div class="text-[11px] text-slate-400 mt-0.5">R$ {{ (getProduct(item.productId)?.unitPrice ?? 0).toFixed(2) }} / {{ getProduct(item.productId)?.unit ?? 'un' }}</div>
                      </div>
                      <div class="text-sm font-medium text-slate-900 shrink-0">
                        R$ {{ ((getProduct(item.productId)?.unitPrice ?? 0) * item.qty * (1 + (getProduct(item.productId)?.markup ?? 0) / 100)).toFixed(2) }}
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1 bg-slate-50 rounded-md">
                        <button type="button" @click="item.qty = Math.max(1, item.qty - 1)" class="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">−</button>
                        <input v-model.number="item.qty" type="number" min="1"
                          class="w-10 bg-transparent text-center text-sm text-slate-900 border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                        <button type="button" @click="item.qty++" class="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">+</button>
                      </div>
                      <button type="button" @click="removeItem(item.key)" class="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Remover">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                </TransitionGroup>
              </div>

              <!-- Checkout / Resumo -->
              <div class="px-5 py-4 border-t border-slate-200 space-y-4">
                <!-- Totais -->
                <div class="space-y-1.5 text-sm">
                  <div v-if="discountAmount > 0" class="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span>R$ {{ subtotal.toFixed(2) }}</span>
                  </div>
                  <div v-if="discountAmount > 0" class="flex justify-between" style="color:#1D9E75">
                    <span>Desconto</span>
                    <span>− R$ {{ discountAmount.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-baseline p-3 rounded-lg" style="background-color:#E1F5EE">
                    <div class="flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full" style="background:#1D9E75"></span>
                      <span class="text-xs" style="color:#0F6E56">Total do orçamento</span>
                    </div>
                    <span class="text-2xl font-medium" style="color:#0F6E56">R$ {{ totalPrice.toFixed(2) }}</span>
                  </div>
                </div>

                <!-- Salvar / Cancelar -->
                <div class="flex gap-2">
                  <button @click="saveEstimate(TYPE, totalPrice, buildDetails)" :disabled="saving" type="button"
                    class="flex-1 py-3 rounded-full bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <span v-if="saving" class="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    {{ saving ? 'Salvando…' : (editingId ? 'Atualizar' : 'Salvar orçamento') }}
                  </button>
                  <button @click="showForm = false; resetForm()" type="button"
                    class="px-4 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium border border-slate-200 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </template>
    </template>
    </div>

    <!-- Modal de aprovação (substitui prompt/confirm nativos) -->
    <ApproveEstimateModal
      :target="approveTarget"
      :date="approveDate"
      :priority="approvePriority"
      :loading="approving"
      @update:date="approveDate = $event"
      @update:priority="approvePriority = $event"
      @confirm="confirmApprove"
      @cancel="cancelApprove"
    />
  </div>
</template>
