<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { usePermissionsStore } from '../stores/permissions'
import { usePlanStore } from '../stores/plan'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import PaginationControls from '../components/shared/PaginationControls.vue'

const ui = useUiStore()
const auth = useAuthStore()
const perms = usePermissionsStore()
const plan = usePlanStore()
const { showToast } = useToast()
const { confirm: confirmDialog } = useConfirm()

interface Estimate {
  id: number
  uuid?: string
  customerId: number
  customer: { name: string; phone?: string | null }
  salesperson?: { id: number; name: string } | null
  status: string
  estimateType: string
  totalPrice: number
  details: any
  validUntil?: string | null
  rejectedReason?: string | null
  sentAt?: string | null
  createdAt: string
}

const estimateList = ref<Estimate[]>([])
const loading = ref(true)
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')
const statusFilter = ref('')
const typeFilter = ref('')

// Modal de novo orçamento
const showTypeModal = ref(false)

// Modal de aprovação (prazo + prioridade)
const approveTarget = ref<Estimate | null>(null)
const approveDate = ref('')
const approvePriority = ref<'NORMAL' | 'URGENT'>('NORMAL')
const approving = ref(false)

// Modal de rejeição
const rejectTarget = ref<Estimate | null>(null)
const rejectReason = ref('')
const rejecting = ref(false)

const fetchEstimates = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
    if (search.value) params.set('search', search.value)
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (typeFilter.value) params.set('type', typeFilter.value)
    const res = await apiFetch(`/api/estimates?${params}`)
    if (!res.ok) return
    const result = await res.json()
    if (Array.isArray(result)) {
      estimateList.value = result
      total.value = result.length
      totalPages.value = 1
    } else {
      estimateList.value = result.data
      total.value = result.total
      totalPages.value = result.totalPages
    }
  } catch (e) {
    console.error('Error fetching estimates', e)
  } finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; fetchEstimates() }, 300)
watch(search, debouncedSearch)
watch([page, limit, statusFilter, typeFilter], fetchEstimates)

const deleteEstimate = async (id: number) => {
  if (!await confirmDialog('Tem certeza que deseja excluir este orçamento?', { title: 'Excluir orçamento' })) return
  try {
    const res = await apiFetch(`/api/estimates/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchEstimates()
  } catch (e) { console.error('Error deleting estimate', e) }
}

const openPdf = (id: number) => {
  if (!plan.hasPdf) {
    plan.setLimitError('Geração de PDF não disponível no plano atual.')
    return
  }
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/estimates/${id}/pdf?token=${token}`, '_blank')
}

const editEstimate = (est: Estimate) => {
  // Roteia pra calculadora correspondente do tipo
  const tabByType: Record<string, string> = {
    service: 'estimates-service',
    plotter: 'estimates-plotter',
    cutting: 'estimates-cutting',
    embroidery: 'estimates-embroidery',
  }
  const target = tabByType[est.estimateType] || 'estimates-service'
  ui.setTab(target as any, est)
}

const newEstimate = (type: string) => {
  showTypeModal.value = false
  const tabByType: Record<string, string> = {
    service: 'estimates-service',
    plotter: 'estimates-plotter',
    cutting: 'estimates-cutting',
    embroidery: 'estimates-embroidery',
  }
  ui.setTab(tabByType[type] as any)
}

const startApprove = (est: Estimate) => {
  approveTarget.value = est
  approveDate.value = ''
  approvePriority.value = 'NORMAL'
}

const confirmApprove = async () => {
  if (!approveTarget.value) return
  approving.value = true
  try {
    const res = await apiFetch(`/api/estimates/${approveTarget.value.id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliveryDate: approveDate.value || null,
        priority: approvePriority.value,
      }),
    })
    if (res.ok) {
      showToast('Orçamento aprovado e enviado para produção!', 'success')
      approveTarget.value = null
      await fetchEstimates()
    } else {
      showToast('Erro ao aprovar orçamento', 'error')
    }
  } finally {
    approving.value = false
  }
}

const startReject = (est: Estimate) => {
  rejectTarget.value = est
  rejectReason.value = ''
}

const confirmReject = async () => {
  if (!rejectTarget.value) return
  rejecting.value = true
  try {
    const res = await apiFetch(`/api/estimates/${rejectTarget.value.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason.value }),
    })
    if (res.ok) {
      showToast('Orçamento rejeitado', 'success')
      rejectTarget.value = null
      await fetchEstimates()
    }
  } finally {
    rejecting.value = false
  }
}

const markSent = async (est: Estimate) => {
  try {
    const res = await apiFetch(`/api/estimates/${est.id}/send`, { method: 'POST' })
    if (res.ok) {
      showToast('Marcado como enviado', 'success')
      await fetchEstimates()
    }
  } catch {}
}

const sendViaWhatsApp = async (est: Estimate) => {
  try {
    // Marca como enviado em background (sem aguardar)
    apiFetch(`/api/estimates/${est.id}/send`, { method: 'POST' }).catch(() => {})

    const publicUrl = est.uuid
      ? `${window.location.origin}/orcamento/${est.uuid}`
      : ''

    const msg = `Olá *${est.customer.name}*!\n\n` +
      `Segue seu orçamento *#ORC-${est.id}*:\n` +
      `📦 *Produto:* ${est.details.productName || est.details.produto || 'Impresso'}\n` +
      ((est.details.width || est.details.largura) && (est.details.height || est.details.altura) ? `📐 *Tam:* ${est.details.width || est.details.largura}x${est.details.height || est.details.altura}cm\n` : '') +
      ((est.details.quantity || est.details.quantidade) ? `🔢 *Qtd:* ${est.details.quantity || est.details.quantidade} unidades\n` : '') +
      `💰 *Total:* R$ ${est.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      (publicUrl
        ? `✅ *Aprovar com 1 clique:*\n${publicUrl}\n\n`
        : '') +
      `Ficamos no aguardo! 😊`

    const phone = est.customer.phone?.replace(/\D/g, '') || ''
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank')

    fetchEstimates()
  } catch (e) {
    console.error(e)
    showToast('Erro ao gerar link de envio.', 'error')
  }
}

const copyPublicLink = (est: Estimate) => {
  if (!est.uuid) {
    showToast('Link público indisponível para este orçamento', 'error')
    return
  }
  const url = `${window.location.origin}/orcamento/${est.uuid}`
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copiado!', 'success')
  }).catch(() => {
    prompt('Copie o link:', url)
  })
}

// ── Helpers visuais ─────────────────────────────────────────────────────────
const initials = (name: string) =>
  (name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '??'
const avatarPalette = [
  { bg: '#EEEDFE', fg: '#3C3489' }, { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#EAF3DE', fg: '#3B6D11' }, { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#FBEAF0', fg: '#72243E' }, { bg: '#E1F5EE', fg: '#085041' },
]
const avatarColor = (seed: string) => {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return avatarPalette[h % avatarPalette.length] ?? { bg: '#F1EFE8', fg: '#444441' }
}

// Status — derivado: se DRAFT/SENT e validUntil no passado → EXPIRED
const computedStatus = (est: Estimate) => {
  if (['DRAFT', 'SENT'].includes(est.status) && est.validUntil) {
    const v = new Date(est.validUntil)
    if (v < new Date()) return 'EXPIRED'
  }
  return est.status
}

const statusInfo = (s: string) => {
  switch (s) {
    case 'APPROVED': return { label: 'Aprovado', bg: '#E1F5EE', fg: '#0F6E56', dot: '#1D9E75' }
    case 'REJECTED': return { label: 'Rejeitado', bg: '#FCEBEB', fg: '#A32D2D', dot: '#A32D2D' }
    case 'EXPIRED':  return { label: 'Expirado', bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' }
    case 'SENT':     return { label: 'Enviado', bg: '#E6F1FB', fg: '#0C447C', dot: '#185FA5' }
    case 'DRAFT':
    case 'PENDING':
    default:         return { label: 'Rascunho', bg: '#FAEEDA', fg: '#854F0B', dot: '#BA7517' }
  }
}

const typeInfo = (t: string) => {
  switch (t) {
    case 'plotter':    return { label: 'Plotter', icon: '📐' }
    case 'cutting':    return { label: 'Recorte', icon: '✂️' }
    case 'embroidery': return { label: 'Estamparia', icon: '👕' }
    case 'service':
    default:           return { label: 'Serviço', icon: '🧾' }
  }
}

const validityInfo = (est: Estimate) => {
  if (!est.validUntil) return null
  const v = new Date(est.validUntil)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startV = new Date(v.getFullYear(), v.getMonth(), v.getDate())
  const diffDays = Math.round((startV.getTime() - startToday.getTime()) / 86400000)
  let label = ''
  let color = '#475569'
  if (diffDays < 0) { label = `expirou há ${Math.abs(diffDays)}d`; color = '#A32D2D' }
  else if (diffDays === 0) { label = 'expira hoje'; color = '#BA7517' }
  else if (diffDays <= 3) { label = `vence em ${diffDays}d`; color = '#BA7517' }
  else label = `válido até ${v.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
  return { label, color }
}

// KPIs computados
const approvedCount = computed(() => estimateList.value.filter(e => e.status === 'APPROVED').length)
const pendingValue = computed(() =>
  estimateList.value
    .filter(e => ['DRAFT', 'PENDING', 'SENT'].includes(e.status))
    .reduce((s, e) => s + (e.totalPrice || 0), 0)
)

onMounted(fetchEstimates)
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10 space-y-5">
      <!-- Header — padrão moderno (compacto, alinha com Clientes/Produtos/Pedidos) -->
      <div class="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Orçamentos</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="total > 0">{{ total }} {{ total === 1 ? 'orçamento cadastrado' : 'orçamentos cadastrados' }}</span>
            <span v-else>Crie o primeiro orçamento da sua gráfica</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="relative">
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input v-model="search" type="text" placeholder="Buscar cliente..."
              class="pl-9 pr-3 py-2 w-56 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 transition-colors" />
          </div>
          <button v-if="perms.can.create('estimates')" @click="showTypeModal = true"
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
          <div class="text-2xl font-medium text-slate-900 mt-2">{{ total }}</div>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
          <div class="flex items-start justify-between">
            <div class="text-xs text-slate-500">Aprovados (página)</div>
            <div class="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>
          <div class="text-2xl font-medium mt-2" style="color:#1D9E75">{{ approvedCount }}</div>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
          <div class="flex items-start justify-between">
            <div class="text-xs text-slate-500">Em aberto (página)</div>
            <div class="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="text-2xl font-medium text-slate-900 mt-2">
            R$ {{ pendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}
          </div>
        </div>
      </div>

      <!-- Filtros: tipo + status (linhas separadas como na Pedidos do Ecommerce) -->
      <div class="border border-slate-200 rounded-xl p-3 space-y-2.5">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-slate-500 ml-1 w-20">Tipo</span>
          <button v-for="t in [{v:'',l:'Todos'},{v:'service',l:'Serviço'},{v:'plotter',l:'Plotter'},{v:'cutting',l:'Recorte'},{v:'embroidery',l:'Estamparia'}]"
            :key="`t-${t.v}`"
            @click="typeFilter = t.v; page = 1"
            :class="['px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              typeFilter === t.v ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
            {{ t.l }}
          </button>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-slate-500 ml-1 w-20">Status</span>
          <button v-for="s in [{v:'',l:'Todos'},{v:'DRAFT',l:'Rascunho'},{v:'SENT',l:'Enviado'},{v:'APPROVED',l:'Aprovado'},{v:'REJECTED',l:'Rejeitado'}]"
            :key="`s-${s.v}`"
            @click="statusFilter = s.v; page = 1"
            :class="['px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              statusFilter === s.v ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
            {{ s.l }}
          </button>
        </div>
      </div>

      <!-- Tabela -->
      <div class="border border-slate-200 rounded-xl overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="px-5 py-3 text-xs font-medium text-slate-500">Cliente</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500">Tipo</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500">Status / Validade</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500">Valor</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="est in estimateList" :key="est.id" class="border-b border-slate-100 hover:bg-slate-50/60 transition-colors group">
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <span class="w-8 h-8 rounded-full text-[11px] font-medium flex items-center justify-center shrink-0"
                        :style="{ background: avatarColor(est.customer.name).bg, color: avatarColor(est.customer.name).fg }">
                    {{ initials(est.customer.name) }}
                  </span>
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-slate-900 truncate">{{ est.customer.name }}</div>
                    <div class="text-[11px] text-slate-400">
                      #ORC-{{ est.id }}
                      <span v-if="est.salesperson"> · {{ est.salesperson.name.split(' ')[0] }}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3">
                <span class="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span>{{ typeInfo(est.estimateType).icon }}</span>
                  {{ typeInfo(est.estimateType).label }}
                </span>
                <div v-if="est.details.productName || est.details.produto" class="text-[11px] text-slate-400 truncate max-w-[180px]">
                  {{ est.details.productName || est.details.produto }}
                </div>
              </td>
              <td class="px-5 py-3">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                      :style="{ background: statusInfo(computedStatus(est)).bg, color: statusInfo(computedStatus(est)).fg }">
                  <span class="w-1 h-1 rounded-full" :style="{ background: statusInfo(computedStatus(est)).dot }"></span>
                  {{ statusInfo(computedStatus(est)).label }}
                </span>
                <div v-if="validityInfo(est)" class="text-[11px] mt-1" :style="{ color: validityInfo(est)!.color }">
                  {{ validityInfo(est)!.label }}
                </div>
                <div v-else-if="est.rejectedReason" class="text-[11px] text-slate-400 mt-1 truncate max-w-[200px]" :title="est.rejectedReason">
                  {{ est.rejectedReason }}
                </div>
              </td>
              <td class="px-5 py-3">
                <div class="text-sm font-medium text-slate-900">
                  R$ {{ est.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
                </div>
                <div class="text-[11px] text-slate-400">{{ new Date(est.createdAt).toLocaleDateString('pt-BR') }}</div>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button v-if="perms.can.edit('estimates')" @click="editEstimate(est)" title="Editar" class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button @click="openPdf(est.id)" title="PDF" class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
                  </button>
                  <button @click="copyPublicLink(est)" title="Copiar link público" class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                  </button>
                  <button v-if="['DRAFT','PENDING'].includes(est.status)" @click="markSent(est)" title="Marcar como enviado" class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                  </button>
                  <button @click="sendViaWhatsApp(est)" title="WhatsApp" class="w-7 h-7 rounded-lg hover:bg-[#E1F5EE] flex items-center justify-center text-slate-500 transition-colors" onmouseover="this.style.color='#1D9E75'" onmouseout="this.style.color=''">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157z"/></svg>
                  </button>
                  <button v-if="!['APPROVED','REJECTED'].includes(est.status)" @click="startApprove(est)" title="Aprovar e gerar pedido" class="w-7 h-7 rounded-lg hover:bg-[#E1F5EE] flex items-center justify-center text-slate-500 transition-colors" onmouseover="this.style.color='#1D9E75'" onmouseout="this.style.color=''">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </button>
                  <button v-if="!['APPROVED','REJECTED'].includes(est.status)" @click="startReject(est)" title="Rejeitar" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 transition-colors" onmouseover="this.style.background='#FCEBEB';this.style.color='#A32D2D'" onmouseout="this.style.background='';this.style.color=''">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                  <button v-if="perms.can.delete('estimates')" @click="deleteEstimate(est.id)" title="Excluir" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 transition-colors" onmouseover="this.style.background='#FCEBEB';this.style.color='#A32D2D'" onmouseout="this.style.background='';this.style.color=''">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="estimateList.length === 0 && !loading">
              <td colspan="5" class="px-5 py-12 text-center text-sm text-slate-400">
                Nenhum orçamento encontrado.
              </td>
            </tr>
          </tbody>
        </table>
        <div class="border-t border-slate-200 px-2">
          <PaginationControls v-model:page="page" v-model:limit="limit" :total="total" :total-pages="totalPages" />
        </div>
      </div>
    </div>

    <!-- ═══ Modal: Escolher tipo de novo orçamento ═══ -->
    <div v-if="showTypeModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="showTypeModal = false"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 z-10">
        <h3 class="text-base font-medium text-slate-900">Novo orçamento</h3>
        <p class="text-sm text-slate-500 mt-1">Escolha o tipo</p>
        <div class="grid grid-cols-2 gap-3 mt-5">
          <button v-for="t in [{v:'service',l:'Serviço',i:'🧾',d:'Cartão, panfleto, papelaria'},{v:'plotter',l:'Plotter',i:'📐',d:'Banner, lona, adesivo'},{v:'cutting',l:'Recorte',i:'✂️',d:'Adesivo recortado, vinil'},{v:'embroidery',l:'Estamparia',i:'👕',d:'Camiseta, uniforme'}]"
            :key="t.v" @click="newEstimate(t.v)"
            class="border border-slate-200 hover:border-slate-400 rounded-lg p-4 text-left transition-colors">
            <div class="text-2xl mb-1.5">{{ t.i }}</div>
            <div class="text-sm font-medium text-slate-900">{{ t.l }}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">{{ t.d }}</div>
          </button>
        </div>
        <div class="mt-5 flex justify-end">
          <button @click="showTypeModal = false" class="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">Cancelar</button>
        </div>
      </div>
    </div>

    <!-- ═══ Modal: Aprovar (prazo + prioridade) ═══ -->
    <div v-if="approveTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="approveTarget = null"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 z-10">
        <h3 class="text-base font-medium text-slate-900">Aprovar orçamento</h3>
        <p class="text-sm text-slate-500 mt-1">
          #ORC-{{ approveTarget.id }} · {{ approveTarget.customer.name }}
        </p>

        <div class="mt-5 space-y-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Data de entrega</label>
            <input v-model="approveDate" type="date"
              class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors" />
            <p class="text-[11px] text-slate-400 mt-1">Opcional — pode definir depois no Kanban</p>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Prioridade</label>
            <div class="flex items-center gap-2">
              <button @click="approvePriority = 'NORMAL'"
                :class="['flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  approvePriority === 'NORMAL' ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
                Normal
              </button>
              <button @click="approvePriority = 'URGENT'"
                :class="['flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  approvePriority === 'URGENT' ? 'text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']"
                :style="approvePriority === 'URGENT' ? { background: '#A32D2D' } : {}">
                Urgente
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button @click="approveTarget = null" class="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">Cancelar</button>
          <button @click="confirmApprove" :disabled="approving"
            class="inline-flex items-center gap-1.5 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            style="background:#1D9E75"
            onmouseover="this.style.background='#0F6E56'" onmouseout="this.style.background='#1D9E75'">
            <span v-if="approving" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
            <span v-else>Aprovar e gerar pedido</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ Modal: Rejeitar ═══ -->
    <div v-if="rejectTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="rejectTarget = null"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 z-10">
        <h3 class="text-base font-medium text-slate-900">Rejeitar orçamento</h3>
        <p class="text-sm text-slate-500 mt-1">
          #ORC-{{ rejectTarget.id }} · {{ rejectTarget.customer.name }}
        </p>

        <div class="mt-5">
          <label class="block text-xs text-slate-500 mb-1.5">Motivo (opcional)</label>
          <textarea v-model="rejectReason" rows="3"
            placeholder="Ex: cliente achou caro, prazo apertado..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors resize-none"></textarea>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button @click="rejectTarget = null" class="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">Cancelar</button>
          <button @click="confirmReject" :disabled="rejecting"
            class="inline-flex items-center gap-1.5 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            style="background:#A32D2D"
            onmouseover="this.style.background='#7E1F1F'" onmouseout="this.style.background='#A32D2D'">
            <span v-if="rejecting" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
            <span v-else>Confirmar rejeição</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>
