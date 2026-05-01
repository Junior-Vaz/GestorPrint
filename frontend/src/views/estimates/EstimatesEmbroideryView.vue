<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useEstimateBase } from '../../composables/useEstimateBase'
import type { EstimateRecord } from '../../composables/useEstimateBase'
import ShirtCanvas3D from '../../components/ShirtCanvas3D.vue'
import ApproveEstimateModal from '../../components/shared/ApproveEstimateModal.vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'

const { showToast } = useToast()

const TYPE = 'embroidery'
const CFG = {
 label: 'Estamparia',
 accent: 'pink',
 svgPath: 'M7 21h10M12 21V3m0 0l4 4m-4-4L8 7',
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
} = useEstimateBase('embroidery')

// ── 3D Preview state ──────────────────────────────────────────────────────────
const shirtColor = ref('#ffffff')
const canvasReady = ref(false)
const envLoading = computed(() => showForm.value && !canvasReady.value)
watch(showForm, (val) => { if (!val) canvasReady.value = false })
const shirtCanvasRef = ref<{ capturePreview: () => string; goToView?: (v: string) => void } | null>(null)
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
 if (dir === 'up') s.y += MOVE_STEP
 if (dir === 'down') s.y -= MOVE_STEP
 if (dir === 'left') s.x -= MOVE_STEP
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

const ROT_STEP = Math.PI / 12 // 15°
function rotateSticker(dir: 1 | -1) {
 const s = selectedSticker.value
 if (!s) return
 s.rotation += dir * ROT_STEP
}

const ZONES: Record<string, { x: number; y: number; z: number; faceAngle: number }> = {
 front: { x: 0, y: 0.04, z: 0.15, faceAngle: 0 },
 back: { x: 0, y: 0.04, z: -0.15, faceAngle: Math.PI },
 left: { x: -0.15, y: 0.14, z: 0.02, faceAngle: -Math.PI / 2 },
 right: { x: 0.15, y: 0.14, z: 0.02, faceAngle: Math.PI / 2 },
}
const ZONE_LABELS: Record<string, string> = { front: 'Frente', back: 'Costas', left: 'Ombro E', right: 'Ombro D' }

function getZone(key: string | symbol) { return ZONES[String(key)] }

// Mapa de zona do sticker → vista da câmera correspondente
const ZONE_TO_VIEW: Record<string, string> = {
 front: 'front',
 back: 'back',
 left: 'left-shoulder',
 right: 'right-shoulder',
}

function setZone(key: string) {
 const s = selectedSticker.value
 const z = ZONES[key]
 if (!s || !z) return
 s.x = z.x; s.y = z.y; s.z = z.z; s.faceAngle = z.faceAngle
 // Mira a câmera na zona escolhida pra dar feedback visual
 const view = ZONE_TO_VIEW[key]
 if (view) shirtCanvasRef.value?.goToView?.(view as any)
}

onUnmounted(() => {
 if (fullDecalUrl.value) URL.revokeObjectURL(fullDecalUrl.value)
 stickers.value.forEach(s => URL.revokeObjectURL(s.url))
})

// ── Type-specific form state ──────────────────────────────────────────────────
type Technique = 'silkscreen' | 'sublimation' | 'dtf' | 'transfer' | 'embroidery'
type GarmentSize = 'PP' | 'P' | 'M' | 'G' | 'GG' | 'EG' | 'EXG'
type ShirtType = 'tshirt' | 'polo' | 'sweatshirt' | 'tank' | 'longsleeve'

const TECHNIQUES: { v: Technique; label: string; hint: string }[] = [
  { v: 'silkscreen',  label: 'Serigrafia',  hint: 'cobra por nº de cores' },
  { v: 'sublimation', label: 'Sublimação',  hint: 'só em peças claras de poliéster' },
  { v: 'dtf',         label: 'DTF',         hint: 'cobra por área da arte' },
  { v: 'transfer',    label: 'Transfer',    hint: 'arte por unidade' },
  { v: 'embroidery',  label: 'Bordado',     hint: 'cobra por nº de pontos' },
]
const GARMENT_SIZES: GarmentSize[] = ['PP', 'P', 'M', 'G', 'GG', 'EG', 'EXG']
const SHIRT_TYPE_OPTIONS: { v: ShirtType; label: string }[] = [
  { v: 'tshirt',     label: 'Camiseta' },
  { v: 'polo',       label: 'Polo' },
  { v: 'sweatshirt', label: 'Moletom' },
  { v: 'tank',       label: 'Regata' },
  { v: 'longsleeve', label: 'Manga longa' },
]

// Cores escuras que precisam de base branca (custo extra)
const isDarkColor = (hex: string): boolean => {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false
  const r = parseInt(hex.substring(1, 3), 16)
  const g = parseInt(hex.substring(3, 5), 16)
  const b = parseInt(hex.substring(5, 7), 16)
  // Luminância aproximada
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128
}

const typeForm = reactive({
 productId: null as number | null,
 embroideryMethod: 'per_piece' as 'per_piece' | 'base_plus_colors' | 'setup_plus_per_piece',
 colorsCount: 1,
 colorSurcharge: 10,
 setupCost: 0,
 pricePerPiece: 0,
 // Domínio
 technique: 'silkscreen' as Technique,
 garmentSize: 'M' as GarmentSize,
 shirtType: 'tshirt' as ShirtType,
 artWidthCm: 20,
 artHeightCm: 20,
 stitchCount: 5000, // pontos pra bordado
 darkSurcharge: 2.50,  // R$ adicional por peça escura (base branca)
 stickerSurcharge: 5,  // R$ por sticker adicional além do 1º
 stitchPricePer1k: 1.50, // R$ a cada 1.000 pontos (bordado)
 artBaselineCm2: 900,    // baseline da arte (30×30 = 900 cm²)
 artScalePerBaseline: 0.30, // +30% por baseline extra acima do baseline
})

const selectedProduct = computed(() => products.value.find(p => p.id === typeForm.productId))

watch(selectedProduct, p => {
 // Só sugere o nome se o usuário ainda não digitou nada — não sobrescreve o que ele já escreveu
 if (p && !editingId.value && !form.productName) form.productName = p.name
})
watch(() => form.customerSearch, onCustomerSearchChange)

// ── Price calculation ─────────────────────────────────────────────────────────
// Base: depende do método de cálculo (já existente)
const baseSubtotal = computed((): number => {
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

// Adicionais de domínio
const isDark = computed(() => isDarkColor(shirtColor.value))
const darkExtra = computed(() => isDark.value ? (form.quantity || 0) * typeForm.darkSurcharge : 0)
// Stickers extras (1º grátis, demais cobram)
const stickersExtra = computed(() => {
 const extra = Math.max(0, stickers.value.length - 1)
 return extra * typeForm.stickerSurcharge * (form.quantity || 0)
})
// Tamanho da arte: aumenta o preço acima do baseline configurado
const artScale = computed(() => {
 const area = (typeForm.artWidthCm || 0) * (typeForm.artHeightCm || 0)
 const baseline = typeForm.artBaselineCm2 || 900
 if (area <= baseline) return 1
 return 1 + ((area - baseline) / baseline) * (typeForm.artScalePerBaseline || 0.3)
})
// Bordado: cobra por nº de pontos quando técnica = embroidery
const stitchExtra = computed(() => {
 if (typeForm.technique !== 'embroidery') return 0
 return ((typeForm.stitchCount || 0) / 1000) * (typeForm.stitchPricePer1k || 1.5) * (form.quantity || 0)
})

const subtotal = computed((): number =>
 baseSubtotal.value * artScale.value + darkExtra.value + stickersExtra.value + stitchExtra.value
)
const discountAmount = computed((): number => {
 const s = subtotal.value
 return form.discountType === 'percent'
 ? s * (form.discount || 0) / 100
 : Math.min(form.discount || 0, s)
})
const totalPrice = computed((): number => Math.max(0, subtotal.value - discountAmount.value))

// ── Details builder ───────────────────────────────────────────────────────────
const buildDetails = () => {
 // Metadados dos stickers (sem o blob URL local — só posição/tamanho/etc)
 const stickersMeta = stickers.value.map(s => ({
   id: s.id, name: s.name,
   x: s.x, y: s.y, z: s.z, size: s.size,
   flipX: s.flipX, flipY: s.flipY, rotation: s.rotation, faceAngle: s.faceAngle,
 }))
 const base = {
   estimateType: TYPE,
   productName: form.productName,
   quantity: form.quantity,
   discount: form.discount,
   discountType: form.discountType,
   discountAmount: discountAmount.value,
   calculationMethod: typeForm.embroideryMethod,
   productId: typeForm.productId,
   shirtColor: shirtColor.value,
   isFullTexture: isFullTexture.value,
   stickers: stickersMeta,
   // Domínio
   technique: typeForm.technique,
   garmentSize: typeForm.garmentSize,
   shirtType: typeForm.shirtType,
   artWidthCm: typeForm.artWidthCm,
   artHeightCm: typeForm.artHeightCm,
   stitchCount: typeForm.stitchCount,
   darkSurcharge: typeForm.darkSurcharge,
   stickerSurcharge: typeForm.stickerSurcharge,
 }
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
 typeForm.technique = 'silkscreen'
 typeForm.garmentSize = 'M'
 typeForm.shirtType = 'tshirt'
 typeForm.artWidthCm = 20
 typeForm.artHeightCm = 20
 typeForm.stitchCount = 5000
 typeForm.darkSurcharge = 2.50
 typeForm.stickerSurcharge = 5
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

 // Restaura personalização 3D
 if (d.shirtColor) shirtColor.value = d.shirtColor
 if (typeof d.isFullTexture === 'boolean') isFullTexture.value = d.isFullTexture

 // Restaura campos de domínio
 if (d.technique) typeForm.technique = d.technique
 if (d.garmentSize) typeForm.garmentSize = d.garmentSize
 if (d.shirtType) typeForm.shirtType = d.shirtType
 if (typeof d.artWidthCm === 'number') typeForm.artWidthCm = d.artWidthCm
 if (typeof d.artHeightCm === 'number') typeForm.artHeightCm = d.artHeightCm
 if (typeof d.stitchCount === 'number') typeForm.stitchCount = d.stitchCount
 if (typeof d.darkSurcharge === 'number') typeForm.darkSurcharge = d.darkSurcharge
 if (typeof d.stickerSurcharge === 'number') typeForm.stickerSurcharge = d.stickerSurcharge

 // Limpa stickers atuais antes de carregar
 stickers.value.forEach(s => { try { URL.revokeObjectURL(s.url) } catch {} })
 stickers.value = []
 selectedStickerId.value = null

 // Restaura stickers a partir dos metadados — usuário precisa re-anexar imagem se quiser editar
 if (Array.isArray(d.stickers)) {
   stickers.value = d.stickers.map((s: any) => ({
     id: s.id || crypto.randomUUID(),
     url: '',  // placeholder vazio — sticker aparece sem imagem na restauração
     name: s.name || 'Sticker',
     x: s.x ?? 0,
     y: s.y ?? 0.04,
     z: s.z ?? 0.15,
     size: s.size ?? 0.15,
     flipX: !!s.flipX,
     flipY: !!s.flipY,
     rotation: s.rotation ?? 0,
     faceAngle: s.faceAngle ?? 0,
   }))
 }
}

// Pricing defaults vindos do Settings do tenant
async function loadPricingDefaults() {
 try {
   const res = await apiFetch('/api/settings')
   if (!res.ok) return
   const settings = await res.json()
   const cfg = settings?.pricingConfig?.embroidery
   if (cfg) {
     if (typeof cfg.colorSurcharge === 'number')      typeForm.colorSurcharge = cfg.colorSurcharge
     if (typeof cfg.darkSurcharge === 'number')       typeForm.darkSurcharge = cfg.darkSurcharge
     if (typeof cfg.stickerSurcharge === 'number')    typeForm.stickerSurcharge = cfg.stickerSurcharge
     if (typeof cfg.stitchPricePer1k === 'number')    typeForm.stitchPricePer1k = cfg.stitchPricePer1k
     if (typeof cfg.artBaselineCm2 === 'number')      typeForm.artBaselineCm2 = cfg.artBaselineCm2
     if (typeof cfg.artScalePerBaseline === 'number') typeForm.artScalePerBaseline = cfg.artScalePerBaseline
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
       embroidery: {
         colorSurcharge: typeForm.colorSurcharge,
         darkSurcharge: typeForm.darkSurcharge,
         stickerSurcharge: typeForm.stickerSurcharge,
         stitchPricePer1k: typeForm.stitchPricePer1k,
         artBaselineCm2: typeForm.artBaselineCm2,
         artScalePerBaseline: typeForm.artScalePerBaseline,
       },
     }),
   })
   if (res.ok) showToast('Tabela de preços salva como padrão!', 'success')
   else showToast('Erro ao salvar tabela de preços.', 'error')
 } finally { savingDefaults.value = false }
}

// Captura o preview 3D e envia como anexo do orçamento (em vez de gravar base64 no JSON)
async function uploadPreviewImage(estimateId: number) {
 const dataUrl = shirtCanvasRef.value?.capturePreview()
 if (!dataUrl) return
 try {
   const res = await fetch(dataUrl)
   const blob = await res.blob()
   const fd = new FormData()
   fd.append('file', new File([blob], `preview-${estimateId}.png`, { type: blob.type || 'image/png' }))
   await apiFetch(`/api/files/upload-estimate/${estimateId}`, { method: 'POST', body: fd })
 } catch (e) {
   console.error('Falha ao subir preview 3D', e)
 }
}

// Wrapper do saveEstimate que dispara o upload do preview no afterSave
async function saveWithPreview() {
 await saveEstimate(TYPE, totalPrice.value, buildDetails, uploadPreviewImage)
}

onMounted(async () => {
 await fetchInitialData(resetForm)
 await fetchEstimates(TYPE)
 await loadPricingDefaults()
})
</script>

<template>
 <div :class="showForm ? 'overflow-hidden' : 'min-h-full bg-white'">
 <div :class="showForm ? '' : 'mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10 space-y-5'">

 <!-- ─── LIST VIEW ──────────────────────────────────────────────────────── -->
 <template v-if="!showForm">

 <!-- Header — padrão moderno -->
 <div class="flex items-center justify-between mb-2 gap-4 flex-wrap">
 <div class="min-w-0">
 <div class="text-sm font-medium text-slate-900">{{ CFG.label }}</div>
 <div class="text-xs text-slate-500 mt-0.5">
 <span v-if="estimates.length > 0">{{ estimates.length }} {{ estimates.length === 1 ? 'orçamento cadastrado' : 'orçamentos cadastrados' }}</span>
 <span v-else>Crie o primeiro orçamento de estamparia</span>
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

 <!-- ─── FORM VIEW ──────────────────────────────────────────────────────── -->
 <template v-else>
 <div v-if="dataLoading" class="flex items-center justify-center py-24">
 <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
 </div>

 <template v-else>
 <!-- Full-screen 3D editor: canvas fills entire viewport, 4 cards float on top -->
 <div class="fixed inset-0 z-[60] overflow-hidden">

 <!-- ─── 3D Canvas — pure full-background ─── -->
 <div class="absolute inset-0 bg-[#2d2d2d]">
 <Suspense @resolve="canvasReady = true">
 <ShirtCanvas3D
 ref="shirtCanvasRef"
 :shirt-type="typeForm.shirtType"
 :shirt-color="shirtColor"
 :is-full-texture="isFullTexture"
 :full-decal-url="fullDecalUrl"
 :stickers="stickers"
 :selected-sticker-id="selectedStickerId"
 />
 <template #fallback>
 <div class="flex items-center justify-center h-full">
 <div class="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
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
 <div class="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
 <p class="text-white text-sm font-medium tracking-wide">Carregando ambiente...</p>
 </div>
 </Transition>
 </div>

 <!-- ─── Card A: Header (top-left) ─── -->
 <div class="absolute top-5 z-20 flex items-center gap-3 px-4 py-3
 bg-white border border-slate-200 rounded-lg shadow-lg"
 style="left: 1rem; width: 20rem;">
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
 <div class="absolute z-20 overflow-y-auto no-scrollbar
 bg-white border border-slate-200 rounded-lg shadow-lg"
 style="left: 1rem; top: 6rem; bottom: 1rem; width: 20rem;">
 
 
 <!-- ── Pedido ── -->
 <div class="px-4 py-4 space-y-3 border-b border-slate-100">
 <p class="text-xs text-slate-500">Pedido</p>
 <div class="relative">
 <label class="text-xs text-slate-500 ml-1 block mb-1">Cliente</label>
 <input v-model="form.customerSearch" @focus="form.showCustomerDrop = true" @input="form.showCustomerDrop = true" @blur="handleCustomerBlur"
 type="text" placeholder="Buscar cliente..."
 class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:outline-none focus:border-slate-400 transition-all text-sm"/>
 <div v-if="form.showCustomerDrop && filteredCustomers.length > 0" class="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
 <button v-for="c in filteredCustomers" :key="c.id" @mousedown.prevent="selectCustomer(c)"
 class="w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg">{{ c.name }}</button>
 </div>
 </div>
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Nome do Orçamento</label>
 <input v-model="form.productName" type="text" placeholder="Ex: Uniforme time A"
 class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:outline-none focus:border-slate-400 transition-all text-sm"/>
 </div>
 </div>

 <!-- ── Cálculo ── -->
 <div class="px-4 py-4 space-y-3 border-b border-slate-100">
 <p class="text-xs text-slate-500">Cálculo</p>
 <div class="flex flex-wrap gap-1.5">
 <button v-for="(label, val) in { per_piece: 'Por Peça', base_plus_colors: 'Base + Cores', setup_plus_per_piece: 'Taxa + Peça' }" :key="val"
 @click="typeForm.embroideryMethod = val as any"
 :class="['px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', typeForm.embroideryMethod === val ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
 {{ label }}
 </button>
 </div>
 <input v-model="productSearch" type="text" placeholder="Filtrar produto..."
 class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-900 transition-all"/>
 <div class="grid grid-cols-2 gap-2 max-h-44 no-scrollbar overflow-y-auto pr-0.5">
 <div v-for="group in productsByCategory" :key="group.name">
 <div class="text-[9px] font-medium px-2 py-0.5 rounded text-white mb-1 truncate" :style="{ backgroundColor: group.color }">{{ group.name }}</div>
 <div class="space-y-1">
 <label v-for="p in group.products" :key="p.id"
 :class="['flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all',
 typeForm.productId === p.id ? 'border-slate-900 bg-slate-50/50 ring-1 ring-slate-400' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30']">
 <input type="radio" :value="p.id" v-model="typeForm.productId" class="w-3 h-3 shrink-0 text-slate-900"/>
 <div class="min-w-0">
 <div class="text-xs text-slate-800 truncate">{{ p.name }}</div>
 <div class="text-[10px] text-slate-400">R$ {{ p.unitPrice.toFixed(2) }}/{{ p.unit }}</div>
 </div>
 </label>
 </div>
 </div>
 </div>
 <div class="grid grid-cols-2 gap-3">
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Quantidade</label>
 <input v-model.number="form.quantity" type="number" min="1"
 class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-900 transition-all text-sm"/>
 </div>
 <template v-if="typeForm.embroideryMethod === 'base_plus_colors'">
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">N° Cores</label>
 <input v-model.number="typeForm.colorsCount" type="number" min="1"
 class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-900 transition-all text-sm"/>
 </div>
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Adic./Cor (R$)</label>
 <input v-model.number="typeForm.colorSurcharge" type="number" min="0" step="0.5"
 class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-900 transition-all text-sm"/>
 </div>
 </template>
 <template v-if="typeForm.embroideryMethod === 'setup_plus_per_piece'">
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Taxa Fixa (R$)</label>
 <input v-model.number="typeForm.setupCost" type="number" min="0" step="0.5"
 class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-900 transition-all text-sm"/>
 </div>
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Preço/Peça (R$)</label>
 <input v-model.number="typeForm.pricePerPiece" type="number" min="0" step="0.5"
 class="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-900 transition-all text-sm"/>
 </div>
 </template>
 </div>
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Desconto</label>
 <div class="flex items-center gap-2">
 <input v-model.number="form.discount" type="number" min="0" :max="form.discountType === 'percent' ? 100 : undefined"
 class="w-24 border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-700 outline-none focus:outline-none focus:border-slate-400 transition-all text-sm"/>
 <div class="flex rounded-xl overflow-hidden border border-slate-200">
 <button type="button" @click="form.discountType = 'percent'"
 :class="form.discountType === 'percent' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
 class="px-3 py-2.5 text-sm font-medium transition-colors">%</button>
 <button type="button" @click="form.discountType = 'fixed'"
 :class="form.discountType === 'fixed' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
 class="px-3 py-2.5 text-sm font-medium transition-colors">R$</button>
 </div>
 </div>
 </div>
 </div>

 <!-- ── Especificação técnica ── -->
 <div class="px-4 py-4 space-y-3 border-b border-slate-100">
 <p class="text-xs text-slate-500">Especificação técnica</p>

 <!-- Técnica -->
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1.5">Técnica</label>
 <div class="grid grid-cols-2 gap-1.5">
 <button v-for="t in TECHNIQUES" :key="t.v" type="button"
 @click="typeForm.technique = t.v"
 :class="['px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all',
 typeForm.technique === t.v
 ? 'bg-slate-900 text-white border-slate-900'
 : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
 {{ t.label }}
 </button>
 </div>
 <p v-if="typeForm.technique" class="text-[10px] text-slate-400 mt-1.5">
 {{ TECHNIQUES.find(x => x.v === typeForm.technique)?.hint }}
 </p>
 </div>

 <!-- Tipo de peça + tamanho da peça -->
 <div class="grid grid-cols-2 gap-2">
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Tipo de peça</label>
 <select v-model="typeForm.shirtType"
 class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:border-slate-400 transition-all">
 <option v-for="o in SHIRT_TYPE_OPTIONS" :key="o.v" :value="o.v">{{ o.label }}</option>
 </select>
 </div>
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Tamanho</label>
 <select v-model="typeForm.garmentSize"
 class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:border-slate-400 transition-all">
 <option v-for="s in GARMENT_SIZES" :key="s" :value="s">{{ s }}</option>
 </select>
 </div>
 </div>

 <!-- Tamanho da arte -->
 <div v-if="typeForm.technique !== 'embroidery'" class="grid grid-cols-2 gap-2">
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Largura arte (cm)</label>
 <input v-model.number="typeForm.artWidthCm" type="number" min="1"
 class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 transition-all"/>
 </div>
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-1">Altura arte (cm)</label>
 <input v-model.number="typeForm.artHeightCm" type="number" min="1"
 class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 transition-all"/>
 </div>
 </div>

 <!-- Pontos (só pra bordado) -->
 <div v-if="typeForm.technique === 'embroidery'">
 <label class="text-xs text-slate-500 ml-1 block mb-1">Nº de pontos (stitches)</label>
 <input v-model.number="typeForm.stitchCount" type="number" min="0" step="500"
 class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 transition-all"/>
 <p class="text-[10px] text-slate-400 mt-1">R$ 1,50 a cada 1.000 pontos por peça</p>
 </div>

 <!-- Tabela de cobrança (editável) -->
 <div class="border border-slate-200 rounded-lg">
 <button type="button" @click="showPricingTable = !showPricingTable"
 class="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-between">
 <span>⚙ Tabela de cobrança</span>
 <svg :class="['w-3 h-3 transition-transform', showPricingTable ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
 </button>
 <div v-if="showPricingTable" class="px-3 py-3 space-y-3 border-t border-slate-100 bg-slate-50/50">
 <!-- Adicionais por peça -->
 <div>
 <p class="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Adicionais por peça</p>
 <div class="grid grid-cols-3 gap-2">
 <div>
 <label class="text-[10px] text-slate-500 block mb-0.5">+R$ por cor</label>
 <input v-model.number="typeForm.colorSurcharge" type="number" min="0" step="0.5"
 class="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 outline-none focus:border-slate-400 bg-white"/>
 </div>
 <div>
 <label class="text-[10px] text-slate-500 block mb-0.5">+R$ peça escura</label>
 <input v-model.number="typeForm.darkSurcharge" type="number" min="0" step="0.5"
 class="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 outline-none focus:border-slate-400 bg-white"/>
 </div>
 <div>
 <label class="text-[10px] text-slate-500 block mb-0.5">+R$ por sticker</label>
 <input v-model.number="typeForm.stickerSurcharge" type="number" min="0" step="0.5"
 class="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 outline-none focus:border-slate-400 bg-white"/>
 </div>
 </div>
 </div>

 <!-- Bordado -->
 <div>
 <p class="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Bordado</p>
 <label class="text-[10px] text-slate-500 block mb-0.5">R$ por 1.000 pontos</label>
 <input v-model.number="typeForm.stitchPricePer1k" type="number" min="0" step="0.10"
 class="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 outline-none focus:border-slate-400 bg-white"/>
 </div>

 <!-- Tamanho da arte -->
 <div>
 <p class="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Tamanho da arte</p>
 <div class="grid grid-cols-2 gap-2">
 <div>
 <label class="text-[10px] text-slate-500 block mb-0.5">Baseline (cm²)</label>
 <input v-model.number="typeForm.artBaselineCm2" type="number" min="100" step="50"
 class="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 outline-none focus:border-slate-400 bg-white"/>
 <p class="text-[9px] text-slate-400 mt-0.5">arte abaixo não tem extra</p>
 </div>
 <div>
 <label class="text-[10px] text-slate-500 block mb-0.5">% por baseline extra</label>
 <input :value="(typeForm.artScalePerBaseline * 100).toFixed(0)"
 @input="typeForm.artScalePerBaseline = (Number(($event.target as HTMLInputElement).value) || 0) / 100"
 type="number" min="0" max="200" step="5"
 class="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 outline-none focus:border-slate-400 bg-white"/>
 <p class="text-[9px] text-slate-400 mt-0.5">% extra por baseline acima</p>
 </div>
 </div>
 </div>

 <button v-if="perms.can.edit('estimates')" @click="savePricingDefaults" :disabled="savingDefaults" type="button"
 class="w-full text-[10px] text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-white rounded px-2 py-1 transition-colors disabled:opacity-50">
 <span v-if="savingDefaults">Salvando...</span>
 <span v-else>Salvar como padrão da gráfica</span>
 </button>
 <p class="text-[9px] text-slate-400 leading-snug">
 Estes valores ficam só neste orçamento. Clique em "Salvar como padrão" pra aplicar a próxima vez.
 </p>
 </div>
 </div>

 <!-- Aviso de cor escura -->
 <div v-if="isDark" class="flex items-start gap-2 p-2.5 rounded-lg" style="background:#FAEEDA; color:#854F0B">
 <svg class="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
 <span class="text-[10px] leading-snug">
 Peça escura precisa de base branca. +R$ {{ typeForm.darkSurcharge.toFixed(2) }}/peça
 </span>
 </div>
 </div>

 <!-- ── Personalização 3D ── -->
 <div class="px-4 py-4 space-y-3 border-b border-slate-100">
 <p class="text-xs text-slate-500">Personalização 3D</p>

 <!-- Cor da Camiseta -->
 <div>
 <label class="text-xs text-slate-500 ml-1 block mb-2">Cor da Camiseta</label>
 <div class="flex flex-wrap gap-2 items-center">
 <button v-for="color in SHIRT_COLORS" :key="color"
 type="button"
 @click="shirtColor = color"
 class="w-7 h-7 rounded-full border-2 transition-all"
 :style="{ backgroundColor: color, borderColor: shirtColor === color ? '#6366f1' : '#e2e8f0' }"
 ></button>
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
 <label class="text-xs text-slate-500 ml-1 block mb-2">Arte Completa</label>
 <button @click="isFullTexture = !isFullTexture"
 :class="['w-full py-2 rounded-xl text-xs font-medium border transition-all', isFullTexture ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
 {{ isFullTexture ? '✓ Camiseta Toda Ativa' : 'Camiseta Toda' }}
 </button>
 <div v-if="isFullTexture" class="mt-2 flex items-center gap-3 flex-wrap">
 <button @click="fullDecalInputRef?.click()"
 class="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-xl transition-all">
 <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
 {{ fullDecalUrl ? 'Trocar' : 'Carregar imagem' }}
 </button>
 <button v-if="fullDecalUrl" @click="fullDecalUrl = null; isFullTexture = false" class="text-red-400 hover:text-red-600 text-xs font-medium">Remover</button>
 <span v-if="fullDecalUrl" class="text-[10px] text-emerald-500 font-medium">✓ Carregada</span>
 </div>
 <input ref="fullDecalInputRef" type="file" accept="image/*" class="hidden" @change="handleFullDecalUpload"/>
 </div>

 <!-- Adesivos / Logos (múltiplos, posicionáveis por clique) -->
 <div>
 <div class="flex items-center justify-between mb-2">
 <label class="text-xs text-slate-500">Adesivos / Logos</label>
 <button @click="stickerInputRef?.click()"
 class="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium rounded-lg transition-all">
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
 ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-400'
 : 'border-slate-100 bg-slate-50 hover:border-slate-200']">
 <img :src="s.url" class="w-8 h-8 object-contain rounded-lg bg-white border border-slate-100 shrink-0"/>
 <div class="flex-1 min-w-0">
 <div class="text-xs text-slate-800 truncate">{{ s.name }}</div>
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
 <p v-else class="text-[10px] text-slate-400">Nenhum adesivo adicionado.</p>
 </div>
 </div>

 <!-- ── Anexos ── -->
 <div class="px-4 py-4 space-y-2.5">
 <div class="flex items-center justify-between">
 <p class="text-xs text-slate-500">Anexos</p>
 <button v-if="editingId" @click="fileInputRef?.click()" :disabled="uploadingFile"
 class="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium rounded-lg transition-all disabled:opacity-50">
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
 <div class="text-xs text-slate-800 truncate">{{ a.originalName }}</div>
 <div class="text-[10px] text-slate-400">{{ fmtSize(a.size) }}</div>
 </div>
 <button @click="downloadAttachment(a.filename)" class="p-1 hover:bg-slate-200 rounded-lg transition-all text-slate-400 hover:text-slate-700">
 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
 </button>
 <button @click="removeAttachment(a.id)" class="p-1 hover:bg-red-50 rounded-lg transition-all text-slate-400 hover:text-red-500">
 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
 </button>
 </div>
 </div>
 <p v-if="!editingId" class="text-[10px] text-slate-400">Salve primeiro para adicionar anexos.</p>
 <p v-else-if="attachments.length === 0 && !uploadingFile" class="text-[10px] text-slate-400">Nenhum arquivo anexado.</p>
 </div>

 </div><!-- /Card B -->

 <!-- ─── Card C: Shirt type selector (bottom-center) ─── -->
 <div class="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5
 bg-white border border-slate-200 rounded-full shadow-lg">
 <button v-for="o in SHIRT_TYPE_OPTIONS" :key="o.v" type="button"
 @click="typeForm.shirtType = o.v"
 :class="['px-3 py-1 rounded-full text-[11px] font-medium transition-colors',
 typeForm.shirtType === o.v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100']">
 {{ o.label }}
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
 bg-white border border-slate-200 rounded-lg shadow-lg p-3"
 style="top: 50%; transform: translateY(-50%); width: 10rem;">

 <!-- Sticker name
 <div class="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-2.5 truncate text-center">
 {{ selectedSticker.name }}
 </div> -->

 <!-- Zone selector -->
 <div class="grid grid-cols-2 gap-1 mb-2.5">
 <button v-for="(label, key) in ZONE_LABELS" :key="key"
 @click="setZone(key)"
 :class="['h-7 text-[9px] font-medium rounded-lg transition-all active:scale-90',
 getZone(key)?.faceAngle === selectedSticker?.faceAngle && getZone(key)?.z === selectedSticker?.z
 ? 'bg-slate-900 text-white'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200']">
 {{ label }}
 </button>
 </div>

 <!-- Arrow grid -->
 <div class="grid grid-cols-3 gap-1 mb-2.5">
 <div></div>
 <button @click="moveSticker('up')" type="button"
 class="h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90">
 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7"/></svg>
 </button>
 <div></div>
 <button @click="moveSticker('left')" type="button"
 class="h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90">
 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
 </button>
 <div class="h-8 flex items-center justify-center"><div class="w-2 h-2 rounded-full bg-slate-300"></div></div>
 <button @click="moveSticker('right')" type="button"
 class="h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90">
 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
 </button>
 <div></div>
 <button @click="moveSticker('down')" type="button"
 class="h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90">
 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
 </button>
 <div></div>
 </div>

 <!-- Size + Rotate -->
 <div class="flex items-center gap-1 mb-2.5">
 <button @click="resizeSticker(-SIZE_STEP)" type="button"
 class="flex-1 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90 flex items-center justify-center">
 <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"/></svg>
 </button>
 <span class="text-[9px] text-slate-400 font-medium uppercase tracking-wide w-8 text-center">TAM</span>
 <button @click="resizeSticker(SIZE_STEP)" type="button"
 class="flex-1 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90 flex items-center justify-center">
 <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
 </button>
 </div>
 <div class="flex items-center gap-1 mb-1.5">
 <button @click="rotateSticker(-1)" type="button" title="Girar esquerda"
 class="flex-1 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90 flex items-center justify-center">
 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
 </button>
 <span class="text-[9px] text-slate-400 font-medium uppercase tracking-wide w-8 text-center">GIR</span>
 <button @click="rotateSticker(1)" type="button" title="Girar direita"
 class="flex-1 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90 flex items-center justify-center">
 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
 </button>
 </div>

 <!-- Flip + Concluir -->
 <div class="flex items-center gap-1 mb-2.5">
 <button @click="flipSticker('x')" type="button"
 :class="['flex-1 h-8 text-[10px] font-medium rounded-lg transition-all active:scale-90 flex items-center justify-center gap-1',
 selectedSticker?.flipX ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']">
 Esp H
 </button>
 <button @click="flipSticker('y')" type="button"
 :class="['flex-1 h-8 text-[10px] font-medium rounded-lg transition-all active:scale-90 flex items-center justify-center gap-1',
 selectedSticker?.flipY ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']">
 Esp V
 </button>
 </div>
 <button @click="selectedStickerId = null" type="button"
 class="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-medium rounded-lg transition-all">
 Concluir
 </button>
 </div>
 </Transition>

 <!-- ─── Card D: Summary + actions (bottom-right) ─── -->
 <div class="absolute bottom-4 right-4 z-20 overflow-hidden bg-white border border-slate-200 rounded-lg shadow-lg" style="width: 18rem;">
 <div class="px-5 py-3.5 flex items-center justify-between">
 <div>
 <div class="text-[9px] font-medium uppercase tracking-widest mb-0.5" style="color:#0F6E56">Total do Orçamento</div>
 <div class="text-[11px] text-slate-500 flex flex-wrap gap-x-2">
 <span>{{ form.quantity }} {{ form.quantity === 1 ? 'peça' : 'peças' }}</span>
 <span v-if="isDark">· peça escura +R$ {{ darkExtra.toFixed(0) }}</span>
 <span v-if="stickers.length > 1">· {{ stickers.length - 1 }} stickers extra</span>
 <span v-if="typeForm.technique === 'embroidery'">· {{ typeForm.stitchCount }} pontos</span>
 </div>
 </div>
 <span class="text-2xl font-medium font-mono shrink-0 ml-3" style="color:#1D9E75">{{ fmtCurrency(totalPrice) }}</span>
 </div>
 <div class="px-4 pb-4 flex gap-2 border-t border-slate-100 pt-3">
 <button @click="saveWithPreview" :disabled="saving" type="button"
 class="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
 <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
 <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
 {{ editingId ? 'Atualizar' : 'Salvar' }}
 </button>
 <button @click="showForm = false; resetForm()" type="button"
 class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-xl transition-all text-sm">
 Cancelar
 </button>
 </div>
 </div>

 </div>
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
 </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
</style>
