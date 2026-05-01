<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useEstimateBase } from '../../composables/useEstimateBase'
import type { EstimateRecord } from '../../composables/useEstimateBase'
import ApproveEstimateModal from '../../components/shared/ApproveEstimateModal.vue'

const TYPE = 'cutting'
const CFG = {
  label: 'Recorte',
  accent: 'orange',
  svgPath: 'M12 12L20 4M12 12l-4.5 4.5M12 12L7.5 7.5M8.12 8.12L4 4m4.12 4.12A3 3 0 106 18a3 3 0 002.12-5.88zM15.88 15.88A3 3 0 1018 18a3 3 0 00-2.12-2.12z',
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
} = useEstimateBase('cutting')

// ── Type-specific form state ──────────────────────────────────────────────────
const typeForm = reactive({
  cuttingMethod: 'area' as 'area' | 'per_piece' | 'area_complexity',
  complexity:    'simple' as 'simple' | 'medium' | 'complex',
})

watch(() => form.customerSearch, onCustomerSearchChange)

// ── Line items ────────────────────────────────────────────────────────────────
interface LineItemPerPiece { key: string; materialId: number; qty: number }
interface LineItemArea     { key: string; materialId: number; qty: number; width: number; height: number }
type LineItem = LineItemPerPiece | LineItemArea

const lineItems = ref<LineItem[]>([])
const showPicker = ref(false)

const getProduct = (id: number) => products.value.find(p => p.id === id)

function addItem(materialId: number) {
  const existing = lineItems.value.find(i => i.materialId === materialId)
  if (existing) { existing.qty++; showPicker.value = false; return }
  if (typeForm.cuttingMethod === 'per_piece') {
    lineItems.value.push({ key: `${Date.now()}-${materialId}`, materialId, qty: 1 })
  } else {
    lineItems.value.push({ key: `${Date.now()}-${materialId}`, materialId, qty: 1, width: 100, height: 100 } as LineItemArea)
  }
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
    form.productName = getProduct(lineItems.value[0]!.materialId)?.name || ''
  } else {
    form.productName = `${lineItems.value.length} itens`
  }
}

function hasArea(item: LineItem): item is LineItemArea {
  return 'width' in item
}

// Preview for area modes (first item)
const firstAreaItem = computed(() => {
  if (typeForm.cuttingMethod === 'per_piece') return null
  return lineItems.value[0] as LineItemArea | undefined ?? null
})

const previewScale = computed(() => {
  const maxW = 400; const maxH = 280
  const w = firstAreaItem.value?.width || 100; const h = firstAreaItem.value?.height || 100
  const scale = Math.min(maxW / w, maxH / h) * 0.86
  return { w: Math.max(80, Math.round(w * scale)), h: Math.max(60, Math.round(h * scale)) }
})

// ── Price calculation ─────────────────────────────────────────────────────────
const subtotal = computed((): number => {
  if (typeForm.cuttingMethod === 'per_piece') {
    return lineItems.value.reduce((sum, item) => {
      const p = getProduct(item.materialId)
      if (!p) return sum
      return sum + p.unitPrice * item.qty * (1 + (p.markup || 0) / 100)
    }, 0)
  }
  return lineItems.value.reduce((sum, item) => {
    const mat = getProduct(item.materialId)
    if (!mat || !hasArea(item)) return sum
    const areaM2 = (item.width / 100) * (item.height / 100) * item.qty
    const factor = typeForm.cuttingMethod === 'area_complexity'
      ? ({ simple: 1.0, medium: 1.5, complex: 2.0 } as Record<string, number>)[typeForm.complexity] ?? 1.0
      : 1.0
    return sum + areaM2 * mat.unitPrice * factor * (1 + (mat.markup || 0) / 100)
  }, 0)
})
const discountAmount = computed((): number => {
  const s = subtotal.value
  return form.discountType === 'percent'
    ? s * (form.discount || 0) / 100
    : Math.min(form.discount || 0, s)
})
const totalPrice = computed((): number => Math.max(0, subtotal.value - discountAmount.value))

// ── Details builder ───────────────────────────────────────────────────────────
const buildDetails = () => {
  const base = {
    estimateType: TYPE,
    productName: form.productName,
    quantity: lineItems.value.reduce((s, i) => s + i.qty, 0),
    discount: form.discount,
    discountType: form.discountType,
    discountAmount: discountAmount.value,
    calculationMethod: typeForm.cuttingMethod,
  }
  if (typeForm.cuttingMethod === 'per_piece') {
    return {
      ...base,
      lineItems: lineItems.value.map(i => {
        const p = getProduct(i.materialId)
        return { materialId: i.materialId, materialName: p?.name, unitPrice: p?.unitPrice, markup: p?.markup, qty: i.qty }
      }),
    }
  }
  return {
    ...base,
    ...(typeForm.cuttingMethod === 'area_complexity' ? { complexity: typeForm.complexity } : {}),
    lineItems: lineItems.value.map(i => {
      const p = getProduct(i.materialId)
      const aItem = i as LineItemArea
      return { materialId: i.materialId, materialName: p?.name, unitPrice: p?.unitPrice, markup: p?.markup, qty: i.qty, width: aItem.width, height: aItem.height }
    }),
  }
}

// ── Reset / Load ──────────────────────────────────────────────────────────────
const resetForm = () => {
  resetFormBase()
  typeForm.cuttingMethod = 'area'
  typeForm.complexity = 'simple'
  lineItems.value = []
  showPicker.value = false
}

const loadEditing = (est: EstimateRecord) => {
  loadEditingBase(est)
  const d = est.details
  typeForm.cuttingMethod = d.calculationMethod || 'area'
  if (d.complexity) typeForm.complexity = d.complexity
  lineItems.value = (d.lineItems || []).map((li: any, idx: number) => {
    const base = { key: `${idx}`, materialId: li.materialId ?? 0, qty: li.qty || 1 }
    if (typeForm.cuttingMethod !== 'per_piece') {
      return { ...base, width: li.width || 100, height: li.height || 100 }
    }
    return base
  }).filter((li: any) => li.materialId > 0)
  // Fallback for old format
  if (lineItems.value.length === 0) {
    const mid = d.materialId || d.productId
    if (mid) {
      if (typeForm.cuttingMethod === 'per_piece') {
        lineItems.value = [{ key: '0', materialId: mid, qty: d.quantity || 1 }]
      } else {
        lineItems.value = [{ key: '0', materialId: mid, qty: d.quantity || 1, width: d.width || 100, height: d.height || 100 }]
      }
    }
  }
}

// When cutting method changes, clear items (dimensions structure changes)
watch(() => typeForm.cuttingMethod, () => {
  lineItems.value = []
  syncProductName()
})

onMounted(async () => {
  await fetchInitialData(resetForm)
  await fetchEstimates(TYPE)
})
</script>

<template>
  <div :class="showForm ? 'overflow-hidden' : 'min-h-full bg-white'">
    <div v-if="!showForm" class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10 space-y-5">

    <!-- ─── LIST VIEW ──────────────────────────────────────────────────────── -->
    <template v-if="!showForm">

      <!-- Header — padrão moderno -->
      <div class="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">{{ CFG.label }}</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="estimates.length > 0">{{ estimates.length }} {{ estimates.length === 1 ? 'orçamento cadastrado' : 'orçamentos cadastrados' }}</span>
            <span v-else>Crie o primeiro orçamento de recorte</span>
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

      <!-- KPIs com ícones -->
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
    </div><!-- /max-w-1320 (list view) -->

    <!-- ─── FORM VIEW (fullscreen 2D editor) ─────────────────────────────── -->
    <template v-if="showForm">
      <div v-if="dataLoading" class="fixed inset-0 z-[60] flex items-center justify-center bg-white">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>

      <template v-else>
        <!-- Full-screen 2D editor: substrate fills viewport, cards float on top -->
        <div class="fixed inset-0 z-[60] overflow-hidden">

          <!-- ─── Substrate canvas (background) ─── -->
          <div class="absolute inset-0 bg-[#2d2d2d] flex items-center justify-center"
               style="background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px); background-size: 20px 20px;">

            <!-- Modo área / área+complexidade — mostra substrate com área de corte -->
            <template v-if="typeForm.cuttingMethod !== 'per_piece' && firstAreaItem">
              <div class="relative flex items-center justify-center"
                   style="width: 600px; height: 610px; filter: drop-shadow(0 8px 36px rgba(0,0,0,0.85)) drop-shadow(0 0 60px rgba(249,115,22,0.08));">
                <!-- Substrate (folha branca) -->
                <div class="absolute inset-0" style="border-radius: 2px; background: linear-gradient(180deg,#ebebeb 0%,#e0e0e0 40%,#e0e0e0 60%,#ebebeb 100%);">
                  <div class="absolute inset-0" style="background-color: white; border-radius: 2px;"></div>
                  <div class="absolute bottom-1.5 right-2 text-[7px] font-mono text-slate-400/60 select-none tracking-widest">SUBSTRATE</div>
                </div>
                <!-- Área de corte -->
                <div class="absolute bottom-0 right-0 transition-all duration-300 ease-out"
                     :style="{ width: previewScale.w + 'px', height: previewScale.h + 'px' }">
                  <div class="absolute inset-0 bg-orange-50/30"></div>
                  <div class="absolute inset-0 border-2 border-dashed border-orange-400"></div>
                  <div class="absolute inset-3 border border-dashed border-orange-300/40"></div>
                  <!-- Marcas de registro nos cantos -->
                  <div class="absolute -top-3 -left-3 text-gray-700 text-xs font-mono leading-none select-none">+</div>
                  <div class="absolute -top-3 -right-3 text-gray-700 text-xs font-mono leading-none select-none">+</div>
                  <div class="absolute -bottom-3 -left-3 text-gray-700 text-xs font-mono leading-none select-none">+</div>
                  <div class="absolute -bottom-3 -right-3 text-gray-700 text-xs font-mono leading-none select-none">+</div>
                  <!-- Cantos coloridos -->
                  <div class="absolute top-0 left-0 w-4 h-px bg-orange-500"></div><div class="absolute top-0 left-0 w-px h-4 bg-orange-500"></div>
                  <div class="absolute top-0 right-0 w-4 h-px bg-orange-500"></div><div class="absolute top-0 right-0 w-px h-4 bg-orange-500"></div>
                  <div class="absolute bottom-0 left-0 w-4 h-px bg-orange-500"></div><div class="absolute bottom-0 left-0 w-px h-4 bg-orange-500"></div>
                  <div class="absolute bottom-0 right-0 w-4 h-px bg-orange-500"></div><div class="absolute bottom-0 right-0 w-px h-4 bg-orange-500"></div>
                  <!-- Badge complexidade -->
                  <div v-if="typeForm.cuttingMethod === 'area_complexity'" class="absolute inset-0 flex items-center justify-center">
                    <span class="bg-orange-500/85 text-white text-xs font-bold px-3 py-1 rounded-full font-mono shadow-lg">
                      × {{ { simple: '1.0', medium: '1.5', complex: '2.0' }[typeForm.complexity] }}
                    </span>
                  </div>
                  <!-- Régua superior -->
                  <div class="absolute -top-9 left-0 right-0 flex items-center justify-center gap-1">
                    <div class="flex-1 h-px bg-gray-700"></div>
                    <span class="text-[10px] font-mono text-gray-300 whitespace-nowrap bg-[#2d2d2d] px-1.5 py-0.5 rounded">{{ firstAreaItem.width }} cm</span>
                    <div class="flex-1 h-px bg-gray-700"></div>
                  </div>
                  <!-- Régua lateral -->
                  <div class="absolute -left-12 top-0 bottom-0 flex items-center justify-center">
                    <span class="text-[10px] font-mono text-gray-300 -rotate-90 whitespace-nowrap bg-[#2d2d2d] px-1.5 py-0.5 rounded">{{ firstAreaItem.height }} cm</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Modo por peça — lista de itens em cards -->
            <template v-else-if="typeForm.cuttingMethod === 'per_piece' && lineItems.length > 0">
              <div class="w-full max-w-md max-h-[80vh] overflow-y-auto space-y-2 p-4">
                <div v-for="item in lineItems" :key="item.key"
                  class="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-orange-500/30 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="CFG.svgPath"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-white text-sm font-medium truncate">{{ getProduct(item.materialId)?.name }}</div>
                    <div class="text-slate-300 text-xs">
                      {{ item.qty }}× · R$ {{ ((getProduct(item.materialId)?.unitPrice ?? 0) * item.qty * (1 + (getProduct(item.materialId)?.markup ?? 0) / 100)).toFixed(2) }}
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Vazio -->
            <template v-else>
              <div class="flex flex-col items-center gap-4 opacity-40">
                <svg class="w-20 h-20 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" :d="CFG.svgPath"/>
                </svg>
                <span class="text-xs font-mono text-slate-400">adicione um item ao orçamento</span>
              </div>
            </template>
          </div>

          <!-- ─── Card A: Header (top-left) ─── -->
          <div class="absolute z-20 flex items-center gap-3 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-lg"
               style="left: 1rem; top: 1rem; width: 20rem;">
            <button @click="showForm = false; resetForm()"
                    class="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-700 shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <svg class="h-4 w-4 text-slate-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="CFG.svgPath"/>
            </svg>
            <div class="min-w-0">
              <h1 class="text-sm font-medium text-slate-800 truncate">{{ editingId ? 'Editar Orçamento' : `Novo — ${CFG.label}` }}</h1>
              <p v-if="editingId" class="text-slate-400 text-[10px] mt-0.5">Ref #ORC-{{ editingId }}</p>
            </div>
          </div>

          <!-- ─── Card B: Form (left, scrollable) ─── -->
          <div class="absolute z-20 overflow-y-auto no-scrollbar bg-white border border-slate-200 rounded-lg shadow-lg"
               style="left: 1rem; top: 6rem; bottom: 1rem; width: 20rem;">

            <!-- Pedido -->
            <div class="px-4 py-4 space-y-3 border-b border-slate-100">
              <p class="text-xs text-slate-500">Pedido</p>
              <div class="relative">
                <label class="text-xs text-slate-500 ml-1 block mb-1">Cliente</label>
                <input v-model="form.customerSearch" @focus="form.showCustomerDrop = true" @input="form.showCustomerDrop = true" @blur="handleCustomerBlur"
                  type="text" placeholder="Buscar cliente..."
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:border-slate-400 transition-all text-sm"/>
                <div v-if="form.showCustomerDrop && filteredCustomers.length > 0" class="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  <button v-for="c in filteredCustomers" :key="c.id" @mousedown.prevent="selectCustomer(c)"
                    class="w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg">{{ c.name }}</button>
                </div>
              </div>
              <div>
                <label class="text-xs text-slate-500 ml-1 block mb-1">Nome do Orçamento</label>
                <input v-model="form.productName" type="text" placeholder="Ex: Adesivos vinil"
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:border-slate-400 transition-all text-sm"/>
              </div>
            </div>

            <!-- Método de cálculo -->
            <div class="px-4 py-4 space-y-3 border-b border-slate-100">
              <p class="text-xs text-slate-500">Método de Cálculo</p>
              <div class="grid grid-cols-3 gap-1.5">
                <button v-for="(label, val) in { area: 'Área', per_piece: 'Peça', area_complexity: 'Área+' }" :key="val"
                  @click="typeForm.cuttingMethod = val as any"
                  :class="['px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all',
                    typeForm.cuttingMethod === val ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
                  {{ label }}
                </button>
              </div>
              <p class="text-[10px] text-slate-400">
                <span v-if="typeForm.cuttingMethod === 'area'">Cobra por m² × preço/m² do material</span>
                <span v-else-if="typeForm.cuttingMethod === 'per_piece'">Cobra unitário × quantidade</span>
                <span v-else>Área × preço × multiplicador de complexidade</span>
              </p>

              <!-- Complexity (só no modo area_complexity) -->
              <div v-if="typeForm.cuttingMethod === 'area_complexity'">
                <label class="text-xs text-slate-500 ml-1 block mb-1.5">Complexidade</label>
                <div class="grid grid-cols-3 gap-1.5">
                  <button v-for="(label, val) in { simple: 'Simples 1×', medium: 'Médio 1.5×', complex: 'Complexo 2×' }" :key="val"
                    @click="typeForm.complexity = val as any"
                    :class="['px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all',
                      typeForm.complexity === val ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
                    {{ label }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Materiais -->
            <div class="px-4 py-4 space-y-3 border-b border-slate-100">
              <p class="text-xs text-slate-500">Materiais</p>

              <!-- Items list -->
              <div v-if="lineItems.length > 0" class="space-y-2">
                <div v-for="item in lineItems" :key="item.key"
                  class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg group">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs text-slate-800 truncate flex-1">{{ getProduct(item.materialId)?.name ?? '—' }}</span>
                    <button type="button" @click="removeItem(item.key)"
                      class="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <!-- Modo área: largura/altura/qty -->
                  <template v-if="typeForm.cuttingMethod !== 'per_piece' && hasArea(item)">
                    <div class="grid grid-cols-3 gap-1.5">
                      <input v-model.number="(item as any).width" type="number" min="1" placeholder="Larg"
                        class="text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs outline-none focus:border-orange-400"/>
                      <input v-model.number="(item as any).height" type="number" min="1" placeholder="Alt"
                        class="text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs outline-none focus:border-orange-400"/>
                      <div class="flex items-center gap-0.5">
                        <button type="button" @click="item.qty = Math.max(1, item.qty - 1)"
                          class="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs flex items-center justify-center">−</button>
                        <input v-model.number="item.qty" type="number" min="1"
                          class="flex-1 w-0 text-center bg-white border border-slate-200 rounded px-0.5 py-1 text-xs outline-none"/>
                        <button type="button" @click="item.qty++"
                          class="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs flex items-center justify-center">+</button>
                      </div>
                    </div>
                    <div class="text-[9px] text-slate-400 mt-1">cm × cm × qty · R$ {{ (getProduct(item.materialId)?.unitPrice ?? 0).toFixed(2) }}/{{ getProduct(item.materialId)?.unit ?? 'm²' }}</div>
                  </template>
                  <!-- Modo por peça: só qty -->
                  <template v-else>
                    <div class="flex items-center gap-1.5">
                      <button type="button" @click="item.qty = Math.max(1, item.qty - 1)"
                        class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs flex items-center justify-center">−</button>
                      <input v-model.number="item.qty" type="number" min="1"
                        class="flex-1 text-center bg-white border border-slate-200 rounded py-1 text-xs outline-none"/>
                      <button type="button" @click="item.qty++"
                        class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs flex items-center justify-center">+</button>
                      <span class="text-[10px] text-slate-400 ml-1">R$ {{ (getProduct(item.materialId)?.unitPrice ?? 0).toFixed(2) }}/{{ getProduct(item.materialId)?.unit ?? 'un' }}</span>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Picker dropdown -->
              <div class="relative">
                <button type="button" @click="showPicker = !showPicker"
                  class="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-orange-300 hover:bg-orange-50 text-orange-700 text-xs font-medium rounded-lg transition-all">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  {{ lineItems.length === 0 ? 'Adicionar material' : '+ Adicionar mais' }}
                </button>
                <div v-if="showPicker"
                  class="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-50"
                  style="max-height: 300px; overflow-y: auto;">
                  <div class="p-2 border-b border-slate-100 sticky top-0 bg-white">
                    <input v-model="productSearch" type="text" placeholder="Filtrar..."
                      class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400"/>
                  </div>
                  <div class="p-2 space-y-2">
                    <div v-for="group in productsByCategory" :key="group.name">
                      <div class="text-[9px] font-medium px-1.5 py-0.5 rounded text-white mb-1 inline-block" :style="{ backgroundColor: group.color }">{{ group.name }}</div>
                      <button v-for="p in group.products" :key="p.id" type="button" @click="addItem(p.id)"
                        :class="['w-full flex items-center justify-between px-2 py-1.5 rounded-lg border text-left transition-all text-xs',
                          lineItems.some(i => i.materialId === p.id) ? 'border-orange-400 bg-orange-50' : 'border-slate-100 hover:border-orange-200']">
                        <span class="text-slate-800 truncate">{{ p.name }}</span>
                        <span class="text-[9px] text-slate-400 shrink-0 ml-1">R$ {{ p.unitPrice.toFixed(2) }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Desconto -->
            <div class="px-4 py-4 space-y-2 border-b border-slate-100">
              <label class="text-xs text-slate-500">Desconto</label>
              <div class="flex items-center gap-2">
                <input v-model.number="form.discount" type="number" min="0" :max="form.discountType === 'percent' ? 100 : undefined"
                  class="w-20 border border-slate-200 rounded-xl px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"/>
                <div class="flex rounded-xl overflow-hidden border border-slate-200">
                  <button type="button" @click="form.discountType = 'percent'"
                    :class="form.discountType === 'percent' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
                    class="px-3 py-2 text-xs font-medium transition-colors">%</button>
                  <button type="button" @click="form.discountType = 'fixed'"
                    :class="form.discountType === 'fixed' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
                    class="px-3 py-2 text-xs font-medium transition-colors">R$</button>
                </div>
              </div>
            </div>

            <!-- Anexos -->
            <div class="px-4 py-4 space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-xs text-slate-500">Anexos</p>
                <button v-if="editingId" @click="fileInputRef?.click()" :disabled="uploadingFile"
                  class="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium rounded transition-all disabled:opacity-50">
                  <span v-if="uploadingFile" class="w-2.5 h-2.5 border border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                  <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  Adicionar
                </button>
              </div>
              <input ref="fileInputRef" type="file" class="hidden" @change="handleAttachmentUpload"/>
              <div v-if="attachments.length > 0" class="space-y-1">
                <div v-for="a in attachments" :key="a.id" class="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded border border-slate-100 text-[10px]">
                  <div class="flex-1 min-w-0">
                    <div class="text-slate-700 truncate">{{ a.originalName }}</div>
                    <div class="text-slate-400">{{ fmtSize(a.size) }}</div>
                  </div>
                  <button @click="downloadAttachment(a.filename)" class="p-1 hover:bg-slate-200 rounded text-slate-400">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  </button>
                  <button @click="removeAttachment(a.id)" class="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              <p v-if="!editingId" class="text-[10px] text-slate-400">Salve primeiro pra anexar.</p>
              <p v-else-if="attachments.length === 0 && !uploadingFile" class="text-[10px] text-slate-400">Nenhum arquivo.</p>
            </div>
          </div><!-- /Card B -->

          <!-- ─── Card C: Info bar (top-center) ─── -->
          <div class="absolute z-20 left-1/2 -translate-x-1/2 top-3 px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[10px] font-mono text-white/80 pointer-events-none flex items-center gap-2">
            <span>{{ typeForm.cuttingMethod === 'per_piece' ? 'por peça' : typeForm.cuttingMethod === 'area' ? 'área m²' : 'área + complexidade' }}</span>
            <span class="text-white/40">·</span>
            <span>{{ lineItems.length }} {{ lineItems.length === 1 ? 'item' : 'itens' }}</span>
            <span class="text-white/40">·</span>
            <span>{{ lineItems.reduce((s,i) => s+i.qty, 0) }} un</span>
            <template v-if="typeForm.cuttingMethod === 'area_complexity'">
              <span class="text-white/40">·</span>
              <span class="text-orange-300">{{ { simple: '1.0×', medium: '1.5×', complex: '2.0×' }[typeForm.complexity] }}</span>
            </template>
          </div>

          <!-- ─── Card D: Total + Salvar (bottom-right) ─── -->
          <div class="absolute z-20 right-4 bottom-4 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden" style="width: 22rem;">
            <div class="px-4 py-2.5 flex items-center justify-between bg-slate-50 border-b border-slate-100">
              <div>
                <div class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total do Orçamento</div>
                <div class="text-[10px] text-slate-400">
                  {{ lineItems.length }} {{ lineItems.length === 1 ? 'item' : 'itens' }}
                  <span v-if="typeForm.cuttingMethod === 'area_complexity'"> · {{ { simple: 'simples', medium: 'médio', complex: 'complexo' }[typeForm.complexity] }}</span>
                </div>
              </div>
              <span class="text-2xl font-medium font-mono shrink-0" style="color:#1D9E75">{{ fmtCurrency(totalPrice) }}</span>
            </div>
            <div class="px-3 py-2.5 flex gap-2">
              <button @click="saveEstimate(TYPE, totalPrice, buildDetails)" :disabled="saving" type="button"
                class="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                {{ editingId ? 'Atualizar' : 'Salvar' }}
              </button>
              <button @click="showForm = false; resetForm()" type="button"
                class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </div>

        </div><!-- /fixed inset-0 fullscreen -->
      </template>
    </template>

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
