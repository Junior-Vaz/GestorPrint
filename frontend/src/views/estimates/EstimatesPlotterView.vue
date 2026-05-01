<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useEstimateBase } from '../../composables/useEstimateBase'
import type { EstimateRecord } from '../../composables/useEstimateBase'
import BannerCanvas3D from '../../components/BannerCanvas3D.vue'
import ApproveEstimateModal from '../../components/shared/ApproveEstimateModal.vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'

const { showToast } = useToast()

const TYPE = 'plotter'
const CFG = {
  label: 'Impressão Plotter',
  accent: 'purple',
  svgPath: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
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
} = useEstimateBase('plotter')

// ── 3D Preview state (ativo só quando lineItems.length === 1) ─────────────────
const bgColor = ref('#ffffff')
const artUrl = ref<string | null>(null)
const artInputRef = ref<HTMLInputElement | null>(null)
const canvasReady = ref(false)
const envLoading = computed(() => showForm.value && lineItems.value.length === 1 && !canvasReady.value)
watch(showForm, (val) => { if (!val) canvasReady.value = false })
const bannerCanvasRef = ref<{ capturePreview: () => string; goToView?: (v: string) => void } | null>(null)

// ── Art transformation state ──────────────────────────────────────────────────
type ArtFit = 'cover' | 'contain' | 'stretch'
const artFit = ref<ArtFit>('stretch')
const artScale = ref(1)        // 1 = 100%
const artOffsetX = ref(0)      // -0.5 a 0.5 (fração da largura)
const artOffsetY = ref(0)      // -0.5 a 0.5 (fração da altura)
const artRotation = ref(0)     // radianos
const artFlipX = ref(false)
const artFlipY = ref(false)

// ── 3D scene state ────────────────────────────────────────────────────────────
const lightIntensity = ref(1)  // 0.4 = sombrio, 1 = normal, 1.6 = claro

const ART_MOVE_STEP = 0.05      // 5% da dimensão
const ART_SCALE_STEP = 0.1      // 10%
const ART_ROT_STEP = Math.PI / 12 // 15°

function rotateArt(dir: 1 | -1) { artRotation.value += dir * ART_ROT_STEP }
function rotateArt90() { artRotation.value += Math.PI / 2 }
function flipArt(axis: 'x' | 'y') {
  if (axis === 'x') artFlipX.value = !artFlipX.value
  else artFlipY.value = !artFlipY.value
}
function moveArt(dir: 'up' | 'down' | 'left' | 'right') {
  if (dir === 'up')    artOffsetY.value += ART_MOVE_STEP
  if (dir === 'down')  artOffsetY.value -= ART_MOVE_STEP
  if (dir === 'left')  artOffsetX.value -= ART_MOVE_STEP
  if (dir === 'right') artOffsetX.value += ART_MOVE_STEP
}
function scaleArt(delta: number) {
  artScale.value = Math.max(0.2, Math.min(3, artScale.value + delta))
}
function resetArtTransform() {
  artScale.value = 1
  artOffsetX.value = 0
  artOffsetY.value = 0
  artRotation.value = 0
  artFlipX.value = false
  artFlipY.value = false
  artFit.value = 'stretch'
}

const BG_COLORS = [
  '#ffffff', '#f1f5f9', '#1e293b', '#0f172a',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#0891b2',
]

function handleArtUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (artUrl.value) URL.revokeObjectURL(artUrl.value)
  artUrl.value = URL.createObjectURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

function clearArt() {
  if (artUrl.value) URL.revokeObjectURL(artUrl.value)
  artUrl.value = null
  resetArtTransform()
}

// ── Type-specific form state ──────────────────────────────────────────────────
type Finishing = 'none' | 'hem' | 'grommet' | 'tape'
const FINISHINGS: { v: Finishing; label: string; hint: string }[] = [
  { v: 'none',    label: 'Sem acabamento', hint: 'corte simples' },
  { v: 'hem',     label: 'Bainha',         hint: 'borda dobrada e costurada' },
  { v: 'grommet', label: 'Ilhós',          hint: 'fixação para amarração' },
  { v: 'tape',    label: 'Fita dupla face', hint: 'aplicação direta na parede' },
]

const typeForm = reactive({
  colors: '4x0' as '4x0' | '4x4' | '1x0',
  finishing: 'none' as Finishing,
  // Pricing knobs (carregados do Settings)
  pricePerM2Default: 0,         // R$/m² extra (acima do material) — fallback
  finishingPrices: {
    none: 0,
    hem: 5,           // R$/m² da área
    grommet: 8,       // R$/m linear de borda (perímetro)
    tape: 3,          // R$/m² da área
  },
  artComplexitySurcharge: 20,   // % a mais quando tem arte cheia (cobre toda a lona)
  minOrderM2: 0.5,              // m² mínimo cobrado por peça (mesmo se a peça é menor)
})

watch(() => form.customerSearch, onCustomerSearchChange)

// ── Line items ────────────────────────────────────────────────────────────────
interface LineItem { key: string; materialId: number; qty: number; width: number; height: number }

const lineItems = ref<LineItem[]>([])
const showPicker = ref(false)

const getProduct = (id: number) => products.value.find(p => p.id === id)

function addItem(materialId: number) {
  const existing = lineItems.value.find(i => i.materialId === materialId)
  if (existing) { existing.qty++; showPicker.value = false; return }
  // Primeiro item herda as dimensões do "draft" (que o usuário ajustou no painel 3D)
  const isFirst = lineItems.value.length === 0
  lineItems.value.push({
    key: `${Date.now()}-${materialId}`,
    materialId,
    qty: 1,
    width: isFirst ? draftWidthCm.value : 100,
    height: isFirst ? draftHeightCm.value : 100,
  })
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

// Preview for first item — usado tanto pelo modo 3D quanto pelo substrate flat
const firstItem = computed(() => lineItems.value[0] ?? null)
// 3D ativa quando tem 0 ou 1 item (mesmo sem material escolhido, mostra a lona vazia)
const isSingleItem = computed(() => lineItems.value.length <= 1)

// Dimensões editáveis quando ainda não há item — usuário ajusta direto pelo painel 3D
const draftWidthCm = ref(150)
const draftHeightCm = ref(100)

// Dimensões da lona em metros (vai pro 3D). Se já tem item, usa as dimensões dele;
// senão usa o "draft" (bind direto nos inputs do painel 3D)
const widthM = computed(() => Math.max(0.1, ((firstItem.value?.width ?? draftWidthCm.value) || 100) / 100))
const heightM = computed(() => Math.max(0.1, ((firstItem.value?.height ?? draftHeightCm.value) || 100) / 100))

const previewScale = computed(() => {
  const maxW = 400; const maxH = 280
  const w = firstItem.value?.width || 100; const h = firstItem.value?.height || 100
  const scale = Math.min(maxW / w, maxH / h) * 0.86
  return { w: Math.max(60, Math.round(w * scale)), h: Math.max(40, Math.round(h * scale)) }
})

// ── Price calculation ─────────────────────────────────────────────────────────
// Material: m² × unitPrice × (1+markup), com mínimo configurável
function computeItemBase(item: LineItem): { areaM2: number; perimeterM: number; matCost: number } {
  const w = item.width / 100, h = item.height / 100
  const areaSingle = w * h
  const perimeter = 2 * (w + h)
  const mat = getProduct(item.materialId)
  const billedArea = Math.max(areaSingle, typeForm.minOrderM2)
  const matCost = mat
    ? billedArea * item.qty * mat.unitPrice * (1 + (mat.markup || 0) / 100)
    : 0
  return { areaM2: areaSingle * item.qty, perimeterM: perimeter * item.qty, matCost }
}

const matSubtotal = computed((): number =>
  lineItems.value.reduce((s, i) => s + computeItemBase(i).matCost, 0)
)

// Acabamento: cobra por área (hem/tape) ou perímetro (grommet)
const finishingCost = computed((): number => {
  if (typeForm.finishing === 'none') return 0
  const totals = lineItems.value.reduce(
    (acc, i) => {
      const b = computeItemBase(i)
      acc.area += b.areaM2; acc.perim += b.perimeterM
      return acc
    },
    { area: 0, perim: 0 },
  )
  const fp = typeForm.finishingPrices
  if (typeForm.finishing === 'hem')     return totals.area * (fp.hem || 0)
  if (typeForm.finishing === 'tape')    return totals.area * (fp.tape || 0)
  if (typeForm.finishing === 'grommet') return totals.perim * (fp.grommet || 0)
  return 0
})

// Surcharge de arte cheia (só aplica no modo 3D quando tem arte e é peça única)
const artComplexityCost = computed((): number => {
  if (!isSingleItem.value || !artUrl.value) return 0
  return matSubtotal.value * ((typeForm.artComplexitySurcharge || 0) / 100)
})

const subtotal = computed((): number => matSubtotal.value + finishingCost.value + artComplexityCost.value)
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
  colors: typeForm.colors,
  finishing: typeForm.finishing,
  finishingCost: finishingCost.value,
  artComplexitySurcharge: typeForm.artComplexitySurcharge,
  // 3D-only meta (preserva mesmo quando vira lista, pra restaurar)
  bgColor: bgColor.value,
  hasArt: !!artUrl.value,
  lineItems: lineItems.value.map(i => {
    const mat = getProduct(i.materialId)
    return { materialId: i.materialId, materialName: mat?.name, unitPrice: mat?.unitPrice, markup: mat?.markup, qty: i.qty, width: i.width, height: i.height }
  }),
})

// ── Reset / Load ──────────────────────────────────────────────────────────────
const resetForm = () => {
  resetFormBase()
  typeForm.colors = '4x0'
  typeForm.finishing = 'none'
  lineItems.value = []
  showPicker.value = false
  bgColor.value = '#ffffff'
  if (artUrl.value) URL.revokeObjectURL(artUrl.value)
  artUrl.value = null
}

const loadEditing = (est: EstimateRecord) => {
  loadEditingBase(est)
  const d = est.details
  typeForm.colors = d.colors || '4x0'
  typeForm.finishing = (d.finishing as Finishing) || 'none'
  if (d.bgColor) bgColor.value = d.bgColor
  // Arte ficou só meta (URL local expira) — usuário re-anexa se quiser editar
  if (artUrl.value) { URL.revokeObjectURL(artUrl.value); artUrl.value = null }
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

// Pricing defaults vindos do Settings do tenant
async function loadPricingDefaults() {
  try {
    const res = await apiFetch('/api/settings')
    if (!res.ok) return
    const settings = await res.json()
    const cfg = settings?.pricingConfig?.plotter
    if (cfg) {
      if (cfg.finishingPrices && typeof cfg.finishingPrices === 'object') {
        typeForm.finishingPrices = { ...typeForm.finishingPrices, ...cfg.finishingPrices }
      }
      if (typeof cfg.artComplexitySurcharge === 'number') typeForm.artComplexitySurcharge = cfg.artComplexitySurcharge
      if (typeof cfg.minOrderM2 === 'number')             typeForm.minOrderM2 = cfg.minOrderM2
    }
  } catch {}
}

const savingDefaults = ref(false)
const showPricingTable = ref(false)
async function savePricingDefaults() {
  savingDefaults.value = true
  try {
    const res = await apiFetch('/api/settings/pricing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plotter: {
          finishingPrices: typeForm.finishingPrices,
          artComplexitySurcharge: typeForm.artComplexitySurcharge,
          minOrderM2: typeForm.minOrderM2,
        },
      }),
    })
    if (res.ok) showToast('Tabela de preços salva', 'success')
    else showToast('Erro ao salvar', 'error')
  } finally {
    savingDefaults.value = false
  }
}

// Marca canvas como pronto após primeiro frame
watch(isSingleItem, (single) => {
  if (single) {
    canvasReady.value = false
    setTimeout(() => { canvasReady.value = true }, 600)
  }
})

// Captura o preview 3D e envia como anexo do orçamento (vai pro PDF)
async function uploadPreviewImage(estimateId: number) {
  const dataUrl = bannerCanvasRef.value?.capturePreview?.()
  if (!dataUrl) return
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const fd = new FormData()
    fd.append('file', new File([blob], `preview-plotter-${estimateId}.jpg`, { type: blob.type || 'image/jpeg' }))
    await apiFetch(`/api/files/upload-estimate/${estimateId}`, { method: 'POST', body: fd })
  } catch (e) {
    console.error('Falha ao subir preview 3D do plotter', e)
  }
}

// Wrapper do saveEstimate que dispara o upload do preview no afterSave (só quando tem 3D ativo)
async function saveWithPreview() {
  const callback = isSingleItem.value ? uploadPreviewImage : undefined
  await saveEstimate(TYPE, totalPrice.value, buildDetails, callback)
}

onUnmounted(() => {
  if (artUrl.value) URL.revokeObjectURL(artUrl.value)
})

onMounted(async () => {
  await fetchInitialData(resetForm)
  await fetchEstimates(TYPE)
  await loadPricingDefaults()
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
            <span v-else>Crie o primeiro orçamento de plotter</span>
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

    <!-- ─── FORM VIEW (fullscreen 3D editor) ──────────────────────────────── -->
    <template v-if="showForm">
      <div v-if="dataLoading" class="fixed inset-0 z-[60] flex items-center justify-center bg-white">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>

      <template v-else>
        <!-- Full-screen 3D editor: canvas fills entire viewport, cards float on top -->
        <div class="fixed inset-0 z-[60] overflow-hidden">

          <!-- ─── 3D Canvas — fullscreen background ─── -->
          <div class="absolute inset-0 bg-[#2d2d2d]">
            <Suspense @resolve="canvasReady = true">
              <BannerCanvas3D
                v-if="isSingleItem"
                ref="bannerCanvasRef"
                :width-m="widthM"
                :height-m="heightM"
                :bg-color="bgColor"
                :art-url="artUrl"
                :finishing="typeForm.finishing"
                :art-fit="artFit"
                :art-scale="artScale"
                :art-offset-x="artOffsetX"
                :art-offset-y="artOffsetY"
                :art-rotation="artRotation"
                :art-flip-x="artFlipX"
                :art-flip-y="artFlipY"
                :light-intensity="lightIntensity"
              />
              <!-- Modo lista (substrate flat) quando há múltiplos itens -->
              <div v-else class="w-full h-full flex items-center justify-center"
                   style="background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px); background-size: 20px 20px;">
                <div class="relative" style="width: 500px; height: 600px; filter: drop-shadow(0 8px 36px rgba(0,0,0,0.85));">
                  <div class="absolute inset-0 bg-white" style="border-radius: 2px;"></div>
                  <div class="absolute bottom-3 right-3 text-[10px] font-mono text-slate-500 select-none">{{ lineItems.length }} ITENS</div>
                  <div class="absolute bottom-0 right-0 bg-purple-200/40 transition-all duration-300"
                       :style="{ width: previewScale.w + 'px', height: previewScale.h + 'px' }"></div>
                </div>
              </div>
              <template #fallback>
                <div class="flex items-center justify-center h-full">
                  <div class="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </template>
            </Suspense>

            <!-- Env loading overlay -->
            <Transition
              enter-active-class="transition-opacity duration-200"
              enter-from-class="opacity-0"
              leave-active-class="transition-opacity duration-500"
              leave-to-class="opacity-0">
              <div v-if="envLoading" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#2d2d2d]">
                <div class="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p class="text-white text-sm font-medium tracking-wide">Carregando ambiente...</p>
              </div>
            </Transition>
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
                <input v-model="form.productName" type="text" placeholder="Ex: Lona fachada 3x1m"
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:border-slate-400 transition-all text-sm"/>
              </div>
            </div>

            <!-- Especificações -->
            <div class="px-4 py-4 space-y-3 border-b border-slate-100">
              <p class="text-xs text-slate-500">Especificações</p>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-xs text-slate-500 ml-1 block mb-1">Cores</label>
                  <select v-model="typeForm.colors"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:border-slate-400">
                    <option value="4x0">4x0 (Frente)</option>
                    <option value="4x4">4x4 (F/V)</option>
                    <option value="1x0">1x0 (Preto)</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs text-slate-500 ml-1 block mb-1">Acabamento</label>
                  <select v-model="typeForm.finishing"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:border-slate-400">
                    <option v-for="f in FINISHINGS" :key="f.v" :value="f.v">{{ f.label }}</option>
                  </select>
                </div>
              </div>
              <p v-if="typeForm.finishing !== 'none'" class="text-[10px] text-slate-400">
                {{ FINISHINGS.find(f => f.v === typeForm.finishing)?.hint }}
              </p>
            </div>

            <!-- Materiais (Itens) -->
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
                  <div class="grid grid-cols-3 gap-1.5">
                    <input v-model.number="item.width" type="number" min="1" placeholder="Larg"
                      class="text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs outline-none focus:border-purple-400"/>
                    <input v-model.number="item.height" type="number" min="1" placeholder="Alt"
                      class="text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs outline-none focus:border-purple-400"/>
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
                </div>
              </div>

              <!-- Picker dropdown -->
              <div class="relative">
                <button type="button" @click="showPicker = !showPicker"
                  class="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-purple-300 hover:bg-purple-50 text-purple-700 text-xs font-medium rounded-lg transition-all">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  {{ lineItems.length === 0 ? 'Adicionar material' : '+ Adicionar mais' }}
                </button>
                <div v-if="showPicker"
                  class="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-50"
                  style="max-height: 300px; overflow-y: auto;">
                  <div class="p-2 border-b border-slate-100 sticky top-0 bg-white">
                    <input v-model="productSearch" type="text" placeholder="Filtrar..."
                      class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-400"/>
                  </div>
                  <div class="p-2 space-y-2">
                    <div v-for="group in productsByCategory" :key="group.name">
                      <div class="text-[9px] font-medium px-1.5 py-0.5 rounded text-white mb-1 inline-block" :style="{ backgroundColor: group.color }">{{ group.name }}</div>
                      <button v-for="p in group.products" :key="p.id" type="button" @click="addItem(p.id)"
                        :class="['w-full flex items-center justify-between px-2 py-1.5 rounded-lg border text-left transition-all text-xs',
                          lineItems.some(i => i.materialId === p.id) ? 'border-purple-400 bg-purple-50' : 'border-slate-100 hover:border-purple-200']">
                        <span class="text-slate-800 truncate">{{ p.name }}</span>
                        <span class="text-[9px] text-slate-400 shrink-0 ml-1">R$ {{ p.unitPrice.toFixed(2) }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tabela de cobrança (collapsible) -->
            <div class="px-4 py-4 space-y-2 border-b border-slate-100">
              <button type="button" @click="showPricingTable = !showPricingTable"
                class="w-full text-left text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-between">
                <span class="flex items-center gap-1.5">⚙ Tabela de cobrança</span>
                <svg :class="['w-3 h-3 transition-transform', showPricingTable ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div v-if="showPricingTable" class="space-y-2 pt-2">
                <div class="grid grid-cols-2 gap-1.5">
                  <div>
                    <label class="text-[10px] text-slate-500 block mb-0.5">Bainha (R$/m²)</label>
                    <input v-model.number="typeForm.finishingPrices.hem" type="number" min="0" step="0.5"
                      class="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-slate-400 bg-white"/>
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-500 block mb-0.5">Ilhós (R$/m)</label>
                    <input v-model.number="typeForm.finishingPrices.grommet" type="number" min="0" step="0.5"
                      class="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-slate-400 bg-white"/>
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-500 block mb-0.5">Fita (R$/m²)</label>
                    <input v-model.number="typeForm.finishingPrices.tape" type="number" min="0" step="0.5"
                      class="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-slate-400 bg-white"/>
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-500 block mb-0.5">Surcharge arte %</label>
                    <input v-model.number="typeForm.artComplexitySurcharge" type="number" min="0" step="1"
                      class="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-slate-400 bg-white"/>
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-500 block mb-0.5">Mín. cobrado (m²)</label>
                    <input v-model.number="typeForm.minOrderM2" type="number" min="0" step="0.1"
                      class="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-slate-400 bg-white"/>
                  </div>
                </div>
                <button v-if="perms.can.edit('estimates')" @click="savePricingDefaults" :disabled="savingDefaults" type="button"
                  class="w-full text-[10px] text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-white rounded px-2 py-1.5 transition-colors disabled:opacity-50">
                  <span v-if="savingDefaults">Salvando...</span>
                  <span v-else>Salvar como padrão</span>
                </button>
              </div>
            </div>

            <!-- Desconto -->
            <div class="px-4 py-4 space-y-2 border-b border-slate-100">
              <label class="text-xs text-slate-500">Desconto</label>
              <div class="flex items-center gap-2">
                <input v-model.number="form.discount" type="number" min="0" :max="form.discountType === 'percent' ? 100 : undefined"
                  class="w-20 border border-slate-200 rounded-xl px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 transition-all"/>
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
          </div><!-- /Card B Form -->

          <!-- ─── Card C: Personalização 3D — bottom-center (só se peça única) ─── -->
          <div v-if="isSingleItem" class="absolute z-20 left-1/2 -translate-x-1/2 bottom-4 px-4 py-3 bg-white border border-slate-200 rounded-full shadow-lg flex items-center gap-3 flex-wrap"
               style="max-width: calc(100vw - 24rem - 24rem);">
            <!-- Dimensões — só quando ainda não tem material escolhido -->
            <template v-if="!firstItem">
              <div class="flex items-center gap-1.5 px-2 border-r border-slate-200">
                <span class="text-[10px] text-slate-500 font-medium">Tam.</span>
                <input v-model.number="draftWidthCm" type="number" min="10" step="10"
                  class="w-14 text-center bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs outline-none focus:border-purple-400"/>
                <span class="text-[10px] text-slate-400">×</span>
                <input v-model.number="draftHeightCm" type="number" min="10" step="10"
                  class="w-14 text-center bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs outline-none focus:border-purple-400"/>
                <span class="text-[10px] text-slate-400">cm</span>
              </div>
            </template>

            <!-- Cor de fundo -->
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-500 font-medium mr-1">Cor</span>
              <button v-for="c in BG_COLORS" :key="c" type="button" @click="bgColor = c"
                :class="['w-6 h-6 rounded-full border-2 transition-all',
                  bgColor === c ? 'border-purple-500 scale-110' : 'border-slate-200 hover:border-slate-400']"
                :style="{ backgroundColor: c }"
                :title="c"></button>
              <label class="w-6 h-6 rounded-full border-2 border-slate-200 cursor-pointer flex items-center justify-center overflow-hidden" title="Cor personalizada">
                <input type="color" v-model="bgColor" class="opacity-0 absolute w-0 h-0"/>
                <svg class="w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
              </label>
            </div>

            <!-- Arte -->
            <div class="flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <input ref="artInputRef" type="file" accept="image/*" class="hidden" @change="handleArtUpload"/>
              <button type="button" @click="artInputRef?.click()"
                class="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-full transition-all">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                {{ artUrl ? 'Trocar arte' : 'Enviar arte' }}
              </button>
              <button v-if="artUrl" type="button" @click="clearArt"
                class="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <span v-if="artUrl" class="text-[9px] text-purple-600 font-medium">+{{ typeForm.artComplexitySurcharge }}%</span>
            </div>
          </div>

          <!-- ─── Card E: Controles da arte (right-middle) — só aparece quando há arte ─── -->
          <div v-if="isSingleItem && artUrl" class="absolute z-20 right-4 top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-xl shadow-lg p-3 flex flex-col gap-2"
               style="width: 11rem;">
            <div class="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Arte</div>

            <!-- Modo de ajuste -->
            <div class="grid grid-cols-3 gap-1">
              <button v-for="m in [{v:'stretch',l:'Esticar'},{v:'cover',l:'Cobrir'},{v:'contain',l:'Caber'}]" :key="m.v"
                @click="artFit = m.v as ArtFit"
                :class="['py-1 rounded-md text-[10px] font-medium border transition-colors',
                  artFit === m.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
                {{ m.l }}
              </button>
            </div>

            <!-- Mover (D-pad) -->
            <div class="grid grid-cols-3 gap-1 mt-1">
              <div></div>
              <button @click="moveArt('up')" class="py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs flex items-center justify-center" title="Subir">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              </button>
              <div></div>
              <button @click="moveArt('left')" class="py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs flex items-center justify-center" title="Esquerda">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button @click="resetArtTransform()" class="py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-medium" title="Centralizar / resetar">
                ⊙
              </button>
              <button @click="moveArt('right')" class="py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs flex items-center justify-center" title="Direita">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </button>
              <div></div>
              <button @click="moveArt('down')" class="py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs flex items-center justify-center" title="Descer">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div></div>
            </div>

            <!-- Escala -->
            <div class="flex items-center gap-1 mt-1">
              <button @click="scaleArt(-ART_SCALE_STEP)" class="flex-1 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium" title="Diminuir">−</button>
              <span class="text-[10px] font-mono text-slate-500 w-10 text-center">{{ Math.round(artScale * 100) }}%</span>
              <button @click="scaleArt(ART_SCALE_STEP)" class="flex-1 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium" title="Aumentar">+</button>
            </div>

            <!-- Rotação + Espelhar -->
            <div class="grid grid-cols-4 gap-1 mt-1">
              <button @click="rotateArt(-1)" class="py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center" title="Girar -15°">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
              </button>
              <button @click="rotateArt(1)" class="py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center" title="Girar +15°">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/></svg>
              </button>
              <button @click="flipArt('x')" :class="['py-1.5 rounded-md text-xs flex items-center justify-center', artFlipX ? 'bg-purple-100 text-purple-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-700']" title="Espelhar horizontal">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h.01M16 7h.01M12 4v16m-6-3l3 3m6-3l-3 3"/></svg>
              </button>
              <button @click="flipArt('y')" :class="['py-1.5 rounded-md text-xs flex items-center justify-center', artFlipY ? 'bg-purple-100 text-purple-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-700']" title="Espelhar vertical">
                <svg class="w-3.5 h-3.5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h.01M16 7h.01M12 4v16m-6-3l3 3m6-3l-3 3"/></svg>
              </button>
            </div>

            <button @click="rotateArt90" class="mt-1 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium">
              Rotacionar 90°
            </button>
          </div>

          <!-- ─── Card F: Controles da cena 3D (left-bottom, abaixo do form B) ─── -->
          <div class="absolute z-20 bg-white border border-slate-200 rounded-full shadow-lg flex items-center gap-1 px-3 py-1.5"
               style="left: 22rem; top: 1rem;">
            <span class="text-[10px] text-slate-500 font-medium mr-1">Luz</span>
            <button v-for="l in [{v:0.5,l:'☾'},{v:1,l:'◐'},{v:1.6,l:'☀'}]" :key="l.v"
              @click="lightIntensity = l.v"
              :class="['w-7 h-7 rounded-full text-sm transition-colors flex items-center justify-center',
                Math.abs(lightIntensity - l.v) < 0.05 ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100']"
              :title="l.v < 1 ? 'Sombrio' : l.v > 1 ? 'Claro' : 'Normal'">
              {{ l.l }}
            </button>
          </div>

          <!-- ─── Card D: Total + Salvar (bottom-right) ─── -->
          <div class="absolute z-20 right-4 bottom-4 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden" style="width: 22rem;">
            <div class="px-4 py-2.5 flex items-center justify-between bg-slate-50 border-b border-slate-100">
              <div>
                <div class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total do Orçamento</div>
                <div class="text-[10px] text-slate-400">
                  {{ lineItems.length }} {{ lineItems.length === 1 ? 'material' : 'materiais' }}
                  <span v-if="typeForm.finishing !== 'none'">· {{ FINISHINGS.find(f => f.v === typeForm.finishing)?.label }}</span>
                  <span v-if="isSingleItem && artUrl"> · arte +{{ typeForm.artComplexitySurcharge }}%</span>
                </div>
              </div>
              <span class="text-2xl font-medium font-mono shrink-0" style="color:#1D9E75">{{ fmtCurrency(totalPrice) }}</span>
            </div>
            <div class="px-3 py-2.5 flex gap-2">
              <button @click="saveWithPreview" :disabled="saving" type="button"
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
