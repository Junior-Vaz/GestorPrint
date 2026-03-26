<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useEstimateBase } from '../../composables/useEstimateBase'
import type { EstimateRecord } from '../../composables/useEstimateBase'
import ShirtCanvas3D from '../../components/ShirtCanvas3D.vue'

const TYPE = 'embroidery'
const CFG = {
  label: 'Estamparia',
  accent: 'pink',
  svgPath: 'M7 21h10M12 21V3m0 0l4 4m-4-4L8 7',
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

// ── 3D Preview state ──────────────────────────────────────────────────────────
const shirtColor = ref('#ffffff')
const canvasReady = ref(false)
const envLoading = computed(() => showForm.value && !canvasReady.value)
watch(showForm, (val) => { if (!val) canvasReady.value = false })
const shirtCanvasRef = ref<{ capturePreview: () => string } | null>(null)
const isFullTexture = ref(false)
const fullDecalUrl = ref<string | null>(null)
const fullDecalInputRef = ref<HTMLInputElement | null>(null)

interface Sticker { id: string; url: string; name: string; x: number; y: number; z: number; size: number; flipX: boolean; flipY: boolean; rotation: number; faceAngle: number }
const stickers = ref<Sticker[]>([])
const selectedStickerId = ref<string | null>(null)
const stickerInputRef = ref<HTMLInputElement | null>(null)
const selectedSticker = computed(() => stickers.value.find(s => s.id === selectedStickerId.value) ?? null)

const SHIRT_COLORS = [
  '#ffffff', '#f1f5f9', '#1e293b', '#0f172a',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#0891b2',
]

function handleFullDecalUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (fullDecalUrl.value) URL.revokeObjectURL(fullDecalUrl.value)
  fullDecalUrl.value = URL.createObjectURL(file)
  isFullTexture.value = true
  ;(e.target as HTMLInputElement).value = ''
}

function handleStickerUpload(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  for (const file of files) {
    stickers.value.push({ id: crypto.randomUUID(), url: URL.createObjectURL(file), name: file.name, x: 0, y: 0.04, z: 0.15, size: 0.15, flipX: false, flipY: false, rotation: 0, faceAngle: 0 })
  }
  ;(e.target as HTMLInputElement).value = ''
}

function removeSticker(id: string) {
  const s = stickers.value.find(s => s.id === id)
  if (!s) return
  URL.revokeObjectURL(s.url)
  stickers.value = stickers.value.filter(s => s.id !== id)
  if (selectedStickerId.value === id) selectedStickerId.value = null
}

function selectSticker(id: string) {
  selectedStickerId.value = selectedStickerId.value === id ? null : id
}

const MOVE_STEP = 0.025
const SIZE_STEP = 0.02

function moveSticker(dir: 'up' | 'down' | 'left' | 'right') {
  const s = selectedSticker.value
  if (!s) return
  if (dir === 'up')    s.y += MOVE_STEP
  if (dir === 'down')  s.y -= MOVE_STEP
  if (dir === 'left')  s.x -= MOVE_STEP
  if (dir === 'right') s.x += MOVE_STEP
}

function resizeSticker(delta: number) {
  const s = selectedSticker.value
  if (!s) return
  s.size = Math.max(0.05, Math.min(0.5, s.size + delta))
}

function flipSticker(axis: 'x' | 'y') {
  const s = selectedSticker.value
  if (!s) return
  if (axis === 'x') s.flipX = !s.flipX
  else s.flipY = !s.flipY
}

const ROT_STEP = Math.PI / 12  // 15°
function rotateSticker(dir: 1 | -1) {
  const s = selectedSticker.value
  if (!s) return
  s.rotation += dir * ROT_STEP
}

const ZONES: Record<string, { x: number; y: number; z: number; faceAngle: number }> = {
  front:  { x: 0,     y: 0.04,  z:  0.15,  faceAngle: 0 },
  back:   { x: 0,     y: 0.04,  z: -0.15,  faceAngle: Math.PI },
  left:   { x: -0.15, y: 0.14,  z:  0.02,  faceAngle: -Math.PI / 2 },
  right:  { x:  0.15, y: 0.14,  z:  0.02,  faceAngle:  Math.PI / 2 },
}
const ZONE_LABELS: Record<string, string> = { front: 'Frente', back: 'Costas', left: 'Ombro E', right: 'Ombro D' }

function setZone(key: string) {
  const s = selectedSticker.value
  const z = ZONES[key]
  if (!s || !z) return
  s.x = z.x; s.y = z.y; s.z = z.z; s.faceAngle = z.faceAngle
}

onUnmounted(() => {
  if (fullDecalUrl.value) URL.revokeObjectURL(fullDecalUrl.value)
  stickers.value.forEach(s => URL.revokeObjectURL(s.url))
})

// ── Type-specific form state ──────────────────────────────────────────────────
const typeForm = reactive({
  productId:        null as number | null,
  embroideryMethod: 'per_piece' as 'per_piece' | 'base_plus_colors' | 'setup_plus_per_piece',
  colorsCount:      1,
  colorSurcharge:   10,
  setupCost:        0,
  pricePerPiece:    0,
})

const selectedProduct = computed(() => products.value.find(p => p.id === typeForm.productId))

watch(selectedProduct, p => { if (p && !editingId.value) form.productName = p.name })
watch(() => form.customerSearch, onCustomerSearchChange)

// ── Price calculation ─────────────────────────────────────────────────────────
const subtotal = computed((): number => {
  const qty = form.quantity || 0
  const up = selectedProduct.value?.unitPrice || 0
  const prodMk = (selectedProduct.value?.markup || 0) / 100
  if (typeForm.embroideryMethod === 'per_piece') return up * qty * (1 + prodMk)
  if (typeForm.embroideryMethod === 'base_plus_colors')
    return qty * (up + (typeForm.colorsCount - 1) * typeForm.colorSurcharge) * (1 + prodMk)
  if (typeForm.embroideryMethod === 'setup_plus_per_piece')
    return typeForm.setupCost + qty * typeForm.pricePerPiece
  return 0
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
  const previewImage = shirtCanvasRef.value?.capturePreview() ?? ''
  const base = { estimateType: TYPE, productName: form.productName, quantity: form.quantity, discount: form.discount, discountType: form.discountType, discountAmount: discountAmount.value, calculationMethod: typeForm.embroideryMethod, productId: typeForm.productId, previewImage }
  if (typeForm.embroideryMethod === 'base_plus_colors')
    return { ...base, colors: typeForm.colorsCount, colorSurcharge: typeForm.colorSurcharge }
  if (typeForm.embroideryMethod === 'setup_plus_per_piece')
    return { ...base, setupCost: typeForm.setupCost, pricePerPiece: typeForm.pricePerPiece }
  return base
}

// ── Reset / Load ──────────────────────────────────────────────────────────────
const resetForm = () => {
  resetFormBase()
  typeForm.productId = null
  typeForm.embroideryMethod = 'per_piece'
  typeForm.colorsCount = 1
  typeForm.colorSurcharge = 10
  typeForm.setupCost = 0
  typeForm.pricePerPiece = 0
  shirtColor.value = '#ffffff'
  if (fullDecalUrl.value) { URL.revokeObjectURL(fullDecalUrl.value); fullDecalUrl.value = null }
  isFullTexture.value = false
  stickers.value.forEach(s => URL.revokeObjectURL(s.url))
  stickers.value = []
  selectedStickerId.value = null
}

const loadEditing = (est: EstimateRecord) => {
  loadEditingBase(est)
  const d = est.details
  typeForm.embroideryMethod = d.calculationMethod || 'per_piece'
  typeForm.productId = d.productId || null
  typeForm.colorsCount = d.colors || 1
  typeForm.colorSurcharge = d.colorSurcharge || 10
  typeForm.setupCost = d.setupCost || 0
  typeForm.pricePerPiece = d.pricePerPiece || 0
}

onMounted(async () => {
  await fetchInitialData(resetForm)
  await fetchEstimates(TYPE)
})
</script>

<template>
  <div :class="showForm ? 'overflow-hidden' : 'p-4 xl:p-6 max-w-7xl mx-auto space-y-6'">

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
        <!-- Full-screen 3D editor: canvas fills entire viewport, 4 cards float on top -->
        <div class="fixed inset-0 z-10 overflow-hidden">

          <!-- ─── 3D Canvas — pure full-background ─── -->
          <div class="absolute inset-0 bg-[#2d2d2d]">
            <Suspense @resolve="canvasReady = true">
              <ShirtCanvas3D
                ref="shirtCanvasRef"
                :shirt-type="'tshirt'"
                :shirt-color="shirtColor"
                :is-full-texture="isFullTexture"
                :full-decal-url="fullDecalUrl"
                :stickers="stickers"
                :selected-sticker-id="selectedStickerId"
              />
              <template #fallback>
                <div class="flex items-center justify-center h-full">
                  <div class="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </template>
            </Suspense>

            <!-- Env loading overlay — shown on first entry -->
            <Transition
              enter-active-class="transition-opacity duration-200"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition-opacity duration-500"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <div v-if="envLoading"
                class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#2d2d2d]">
                <div class="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p class="text-white text-sm font-bold tracking-wide">Carregando ambiente...</p>
              </div>
            </Transition>
          </div>

          <!-- ─── Card A: Header (top-left) ─── -->
          <div class="absolute top-5 z-20 flex items-center gap-3 px-4 py-3
                      bg-white/100 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl"
               style="left: calc(6.5rem + 1rem); width: 20rem;">
            <button @click="showForm = false; resetForm()"
              class="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-700 shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <svg class="h-4 w-4 text-pink-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="CFG.svgPath"/>
            </svg>
            <div class="min-w-0">
              <h1 class="text-sm font-extrabold text-slate-800 truncate">{{ editingId ? 'Editar Orçamento' : `Novo — ${CFG.label}` }}</h1>
              <p v-if="editingId" class="text-slate-400 text-[10px] mt-0.5">Ref #ORC-{{ editingId }}</p>
            </div>
          </div>

          <!-- ─── Card B: Form (left, scrollable) ─── -->
          <div class="absolute z-20 overflow-y-auto  no-scrollbar
                      bg-white/100 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl"
               style="left: calc(6.5rem + 1rem); top: 6rem; bottom: 1rem; width: 20rem;">
          
         
            <!-- ── Pedido ── -->
            <div class="px-4 py-4 space-y-3 border-b border-slate-100">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido</p>
              <div class="relative">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Cliente</label>
                <input v-model="form.customerSearch" @focus="form.showCustomerDrop = true" @input="form.showCustomerDrop = true" @blur="handleCustomerBlur"
                  type="text" placeholder="Buscar cliente..."
                  class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"/>
                <div v-if="form.showCustomerDrop && filteredCustomers.length > 0" class="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  <button v-for="c in filteredCustomers" :key="c.id" @mousedown.prevent="selectCustomer(c)"
                    class="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors first:rounded-t-xl last:rounded-b-xl">{{ c.name }}</button>
                </div>
              </div>
              <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Nome do Orçamento</label>
                <input v-model="form.productName" type="text" placeholder="Ex: Uniforme time A"
                  class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"/>
              </div>
            </div>

            <!-- ── Cálculo ── -->
            <div class="px-4 py-4 space-y-3 border-b border-slate-100">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cálculo</p>
              <div class="flex flex-wrap gap-1.5">
                <button v-for="(label, val) in { per_piece: 'Por Peça', base_plus_colors: 'Base + Cores', setup_plus_per_piece: 'Taxa + Peça' }" :key="val"
                  @click="typeForm.embroideryMethod = val as any"
                  :class="['px-3 py-1.5 rounded-lg text-xs font-bold border transition-all', typeForm.embroideryMethod === val ? 'bg-pink-500 text-white border-pink-500 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
                  {{ label }}
                </button>
              </div>
              <input v-model="productSearch" type="text" placeholder="Filtrar produto..."
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"/>
              <div class="grid grid-cols-2 gap-2 max-h-44 no-scrollbar overflow-y-auto pr-0.5">
                <div v-for="group in productsByCategory" :key="group.name">
                  <div class="text-[9px] font-black px-2 py-0.5 rounded text-white mb-1 truncate" :style="{ backgroundColor: group.color }">{{ group.name }}</div>
                  <div class="space-y-1">
                    <label v-for="p in group.products" :key="p.id"
                      :class="['flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all',
                        typeForm.productId === p.id ? 'border-pink-500 bg-pink-50/50 ring-1 ring-pink-500' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30']">
                      <input type="radio" :value="p.id" v-model="typeForm.productId" class="w-3 h-3 shrink-0 text-pink-600"/>
                      <div class="min-w-0">
                        <div class="text-xs font-semibold text-slate-700 truncate">{{ p.name }}</div>
                        <div class="text-[10px] text-slate-400">R$ {{ p.unitPrice.toFixed(2) }}/{{ p.unit }}</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Quantidade</label>
                  <input v-model.number="form.quantity" type="number" min="1"
                    class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"/>
                </div>
                <template v-if="typeForm.embroideryMethod === 'base_plus_colors'">
                  <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">N° Cores</label>
                    <input v-model.number="typeForm.colorsCount" type="number" min="1"
                      class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"/>
                  </div>
                  <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Adic./Cor (R$)</label>
                    <input v-model.number="typeForm.colorSurcharge" type="number" min="0" step="0.5"
                      class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"/>
                  </div>
                </template>
                <template v-if="typeForm.embroideryMethod === 'setup_plus_per_piece'">
                  <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Taxa Fixa (R$)</label>
                    <input v-model.number="typeForm.setupCost" type="number" min="0" step="0.5"
                      class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"/>
                  </div>
                  <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Preço/Peça (R$)</label>
                    <input v-model.number="typeForm.pricePerPiece" type="number" min="0" step="0.5"
                      class="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"/>
                  </div>
                </template>
              </div>
              <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Desconto</label>
                <div class="flex items-center gap-2">
                  <input v-model.number="form.discount" type="number" min="0" :max="form.discountType === 'percent' ? 100 : undefined"
                    class="w-24 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"/>
                  <div class="flex rounded-xl overflow-hidden border border-slate-200">
                    <button type="button" @click="form.discountType = 'percent'"
                      :class="form.discountType === 'percent' ? 'bg-indigo-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
                      class="px-3 py-2.5 text-sm font-bold transition-colors">%</button>
                    <button type="button" @click="form.discountType = 'fixed'"
                      :class="form.discountType === 'fixed' ? 'bg-indigo-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
                      class="px-3 py-2.5 text-sm font-bold transition-colors">R$</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── Personalização 3D ── -->
            <div class="px-4 py-4 space-y-3 border-b border-slate-100">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personalização 3D</p>

              <!-- Cor da Camiseta -->
              <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Cor da Camiseta</label>
                <div class="flex flex-wrap gap-2 items-center">
                  <button v-for="color in SHIRT_COLORS" :key="color"
                    @click="shirtColor = color"
                    class="w-7 h-7 rounded-full border-2 transition-all"
                    :style="{ backgroundColor: color, borderColor: shirtColor === color ? '#6366f1' : '#e2e8f0' }"
                  />
                  <!-- Custom color picker -->
                  <label
                    class="w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center overflow-hidden transition-all"
                    :style="{ borderColor: !SHIRT_COLORS.includes(shirtColor) ? '#6366f1' : '#e2e8f0' }"
                    title="Cor personalizada">
                    <input type="color" v-model="shirtColor" class="opacity-0 absolute w-0 h-0"/>
                    <svg class="w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
                    </svg>
                  </label>
                </div>
              </div>

              <!-- Preenchimento total (independente dos stickers) -->
              <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Arte Completa</label>
                <button @click="isFullTexture = !isFullTexture"
                  :class="['w-full py-2 rounded-xl text-xs font-bold border transition-all', isFullTexture ? 'bg-pink-500 text-white border-pink-500 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
                  {{ isFullTexture ? '✓ Camiseta Toda Ativa' : 'Camiseta Toda' }}
                </button>
                <div v-if="isFullTexture" class="mt-2 flex items-center gap-3 flex-wrap">
                  <button @click="fullDecalInputRef?.click()"
                    class="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    {{ fullDecalUrl ? 'Trocar' : 'Carregar imagem' }}
                  </button>
                  <button v-if="fullDecalUrl" @click="fullDecalUrl = null; isFullTexture = false" class="text-red-400 hover:text-red-600 text-xs font-bold">Remover</button>
                  <span v-if="fullDecalUrl" class="text-[10px] text-emerald-500 font-bold">✓ Carregada</span>
                </div>
                <input ref="fullDecalInputRef" type="file" accept="image/*" class="hidden" @change="handleFullDecalUpload"/>
              </div>

              <!-- Adesivos / Logos (múltiplos, posicionáveis por clique) -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adesivos / Logos</label>
                  <button @click="stickerInputRef?.click()"
                    class="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition-all">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Adicionar
                  </button>
                </div>
                <input ref="stickerInputRef" type="file" accept="image/*" multiple class="hidden" @change="handleStickerUpload"/>

                <!-- Lista de stickers -->
                <div v-if="stickers.length > 0" class="space-y-1.5">
                  <div v-for="s in stickers" :key="s.id"
                    @click="selectSticker(s.id)"
                    :class="['flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all',
                      selectedStickerId === s.id
                        ? 'border-pink-500 bg-pink-50 ring-1 ring-pink-500'
                        : 'border-slate-100 bg-slate-50 hover:border-slate-200']">
                    <img :src="s.url" class="w-8 h-8 object-contain rounded-lg bg-white border border-slate-100 shrink-0"/>
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-semibold text-slate-700 truncate">{{ s.name }}</div>
                      <div class="text-[10px] text-slate-400">
                        {{ selectedStickerId === s.id ? 'Use as setas →' : 'Selecionar para mover' }}
                      </div>
                    </div>
                    <button @click.stop="removeSticker(s.id)"
                      class="p-1 hover:bg-red-50 rounded-lg transition-all text-slate-400 hover:text-red-500 shrink-0">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <p v-else class="text-[10px] text-slate-400 italic">Nenhum adesivo adicionado.</p>
              </div>
            </div>

            <!-- ── Anexos ── -->
            <div class="px-4 py-4 space-y-2.5">
              <div class="flex items-center justify-between">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anexos</p>
                <button v-if="editingId" @click="fileInputRef?.click()" :disabled="uploadingFile"
                  class="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition-all disabled:opacity-50">
                  <span v-if="uploadingFile" class="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                  <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  Adicionar
                </button>
              </div>
              <input ref="fileInputRef" type="file" class="hidden" @change="handleAttachmentUpload"/>
              <div v-if="attachments.length > 0" class="space-y-1.5">
                <div v-for="a in attachments" :key="a.id" class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold text-slate-700 truncate">{{ a.originalName }}</div>
                    <div class="text-[10px] text-slate-400">{{ fmtSize(a.size) }}</div>
                  </div>
                  <button @click="downloadAttachment(a.filename)" class="p-1 hover:bg-slate-200 rounded-lg transition-all text-slate-400 hover:text-indigo-600">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  </button>
                  <button @click="removeAttachment(a.id)" class="p-1 hover:bg-red-50 rounded-lg transition-all text-slate-400 hover:text-red-500">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              <p v-if="!editingId" class="text-[10px] text-slate-400 italic">Salve primeiro para adicionar anexos.</p>
              <p v-else-if="attachments.length === 0 && !uploadingFile" class="text-[10px] text-slate-400 italic">Nenhum arquivo anexado.</p>
            </div>

          </div><!-- /Card B -->

          <!-- ─── Card C: Shirt type selector (top-right) ─── -->
          <div class="absolute bottom-5 right-2/5 z-20 flex items-center gap-1 px-3 py-2
                      bg-white/100 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl">
            <button class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-pink-600 text-white">
              Camiseta
            </button>
          </div>

          <!-- ─── Card E: Sticker position controls (center-right, only when selected) ─── -->
          <Transition
            enter-active-class="transition-all duration-200"
            enter-from-class="opacity-0 translate-x-4"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition-all duration-150"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 translate-x-4"
          >
            <div v-if="selectedSticker" class="absolute right-4 z-20
                        bg-white/100 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl p-3"
                 style="top: 50%; transform: translateY(-50%); width: 10rem;">

              <!-- Sticker name
              <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5 truncate text-center">
                {{ selectedSticker.name }}
              </div> -->

              <!-- Zone selector -->
              <div class="grid grid-cols-2 gap-1 mb-2.5">
                <button v-for="(label, key) in ZONE_LABELS" :key="key"
                  @click="setZone(key)"
                  :class="['h-7 text-[9px] font-bold rounded-lg transition-all active:scale-90',
                    ZONES[key].faceAngle === selectedSticker?.faceAngle && ZONES[key].z === selectedSticker?.z
                      ? 'bg-pink-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-pink-50 hover:text-pink-600']">
                  {{ label }}
                </button>
              </div>

              <!-- Arrow grid -->
              <div class="grid grid-cols-3 gap-1 mb-2.5">
                <div/>
                <button @click="moveSticker('up')"
                  class="h-8 flex items-center justify-center bg-slate-100 hover:bg-pink-100 hover:text-pink-600 text-slate-600 rounded-lg transition-all active:scale-90">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7"/></svg>
                </button>
                <div/>
                <button @click="moveSticker('left')"
                  class="h-8 flex items-center justify-center bg-slate-100 hover:bg-pink-100 hover:text-pink-600 text-slate-600 rounded-lg transition-all active:scale-90">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div class="h-8 flex items-center justify-center">
                  <div class="w-2 h-2 rounded-full bg-slate-300"/>
                </div>
                <button @click="moveSticker('right')"
                  class="h-8 flex items-center justify-center bg-slate-100 hover:bg-pink-100 hover:text-pink-600 text-slate-600 rounded-lg transition-all active:scale-90">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
                </button>
                <div/>
                <button @click="moveSticker('down')"
                  class="h-8 flex items-center justify-center bg-slate-100 hover:bg-pink-100 hover:text-pink-600 text-slate-600 rounded-lg transition-all active:scale-90">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <div/>
              </div>

              <!-- Size controls -->
              <div class="flex items-center gap-1 mb-2.5">
                <button @click="resizeSticker(-SIZE_STEP)"
                  class="flex-1 h-8 bg-slate-100 hover:bg-pink-100 hover:text-pink-600 text-slate-600 font-bold text-lg rounded-lg transition-all active:scale-90 flex items-center justify-center">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"/></svg>
                </button>
                <span class="text-[9px] text-slate-400 font-black uppercase tracking-wide w-8 text-center">TAM</span>
                <button @click="resizeSticker(SIZE_STEP)"
                  class="flex-1 h-8 bg-slate-100 hover:bg-pink-100 hover:text-pink-600 text-slate-600 font-bold text-lg rounded-lg transition-all active:scale-90 flex items-center justify-center">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                </button>
              </div>

              <!-- Rotate controls -->
              <div class="flex items-center gap-1 mb-1.5">
                <button @click="rotateSticker(-1)"
                  class="flex-1 h-8 bg-slate-100 hover:bg-pink-100 hover:text-pink-600 text-slate-600 rounded-lg transition-all active:scale-90 flex items-center justify-center"
                  title="Girar esquerda">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                </button>
                <span class="text-[9px] text-slate-400 font-black uppercase tracking-wide w-8 text-center">GIR</span>
                <button @click="rotateSticker(1)"
                  class="flex-1 h-8 bg-slate-100 hover:bg-pink-100 hover:text-pink-600 text-slate-600 rounded-lg transition-all active:scale-90 flex items-center justify-center"
                  title="Girar direita">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                  </svg>
                </button>
              </div>

              <!-- Flip controls -->
              <div class="flex items-center gap-1 mb-2.5">
                <button @click="flipSticker('x')"
                  :class="['flex-1 h-8 text-[10px] font-bold rounded-lg transition-all active:scale-90 flex items-center justify-center gap-1',
                    selectedSticker?.flipX ? 'bg-pink-100 text-pink-600 border border-pink-300' : 'bg-slate-100 text-slate-600 hover:bg-pink-50 hover:text-pink-600']">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3v18M4 8l4 4-4 4M20 8l-4 4 4 4"/>
                  </svg>
                  Esp H
                </button>
                <button @click="flipSticker('y')"
                  :class="['flex-1 h-8 text-[10px] font-bold rounded-lg transition-all active:scale-90 flex items-center justify-center gap-1',
                    selectedSticker?.flipY ? 'bg-pink-100 text-pink-600 border border-pink-300' : 'bg-slate-100 text-slate-600 hover:bg-pink-50 hover:text-pink-600']">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12h18M8 4l4 4 4-4M8 20l4-4 4 4"/>
                  </svg>
                  Esp V
                </button>
              </div>

              <!-- Deselect -->
              <button @click="selectedStickerId = null"
                class="w-full py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-[10px] font-bold rounded-xl transition-all active:scale-95">
                Concluir
              </button>
            </div>
          </Transition>

          <!-- ─── Card D: Summary + actions (bottom-right) ─── -->
          <div class="absolute bottom-4 right-4 z-20 overflow-hidden
                      bg-white/100 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl"
               style="width: 18rem;">
            <div class="px-5 py-3.5 flex items-center justify-between">
              <div>
                <div class="text-green-700 text-[9px] font-black uppercase tracking-widest mb-0.5">Total do Orçamento</div>
                <div class="text-[11px] text-slate-500 flex gap-2">
                  <span>{{ form.quantity }} peças</span>
                  <template v-if="typeForm.embroideryMethod === 'setup_plus_per_piece'">
                    <span>· taxa R$ {{ typeForm.setupCost.toFixed(0) }}</span>
                  </template>
                  <template v-else-if="typeForm.embroideryMethod === 'base_plus_colors'">
                    <span>· {{ typeForm.colorsCount }} cores</span>
                  </template>
                </div>
              </div>
              <span class="text-2xl font-black text-green-700 font-mono shrink-0 ml-3">{{ fmtCurrency(totalPrice) }}</span>
            </div>
            <div class="px-4 pb-4 flex gap-2 border-t border-slate-100 pt-3">
              <button @click="saveEstimate(TYPE, totalPrice, buildDetails)" :disabled="saving"
                class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-sm shadow-lg shadow-indigo-100">
                <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                {{ editingId ? 'Atualizar' : 'Salvar' }}
              </button>
              <button @click="showForm = false; resetForm()"
                class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all active:scale-95 text-sm">
                Cancelar
              </button>
            </div>
          </div><!-- /Card D -->

        </div>
      </template>
    </template>
  </div>
</template>
<style scoped>
/* 1. Esconde a barra para Chrome, Safari e novas versões do Edge */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* 2. Esconde a barra para Firefox */
.no-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none;  /* IE e Edge antigo */
}
</style>

