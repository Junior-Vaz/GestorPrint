<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'
import { usePermissionsStore } from '../../stores/permissions'
import PaginationControls from '../../components/shared/PaginationControls.vue'

const { showToast } = useToast()
const perms = usePermissionsStore()

interface OrderItem { id: number; name: string; qty: number; unitPrice: number; lineTotal: number }
interface Order {
  id: number
  uuid: string
  productDescription: string
  amount: number
  status: 'PENDING' | 'PRODUCTION' | 'FINISHED' | 'DELIVERED'
  paymentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'PARTIAL_REFUND'
  paymentMethod?: string
  paymentExternalId?: string
  shippingService?: string
  shippingCarrier?: string
  shippingCost?: number
  trackingCode?: string
  shippingStatus?: string
  shippingLabelUrl?: string
  shippingAddress?: any
  meShipmentId?: string
  details?: { items: OrderItem[]; subtotal: number; shippingCost: number; total: number }
  customer: { id: number; name: string; email: string; phone?: string }
  createdAt: string
}

interface Stats {
  awaitingPayment: number
  paidToday: number
  inProduction: number
  awaitingShipping: number
  todayCount: number
  todayRevenue: number
}

const orders = ref<Order[]>([])
const stats = ref<Stats>({ awaitingPayment: 0, paidToday: 0, inProduction: 0, awaitingShipping: 0, todayCount: 0, todayRevenue: 0 })
const loading = ref(true)
const search = ref('')
const filterStatus = ref<'all' | 'PENDING' | 'PRODUCTION' | 'FINISHED' | 'DELIVERED'>('all')
const filterPayment = ref<'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'>('all')
// Período de criação do pedido — atalhos comuns + custom range
const filterPeriod = ref<'all' | 'today' | '7d' | '30d' | '90d'>('all')
// Filtro de envio — separa pedidos por situação da etiqueta/entrega
const filterShipping = ref<'all' | 'pending_label' | 'labeled' | 'pickup'>('all')

// Computeds derivados — aplica filtros que rodam no client (período/envio)
// pra não precisar mexer no backend nessa iteração. Os filtros que vão pro
// backend (status/paymentStatus/search) já são query params na URL.
const filteredOrders = computed(() => {
  let list = orders.value
  if (filterPeriod.value !== 'all') {
    const now = Date.now()
    const days = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[filterPeriod.value as 'today' | '7d' | '30d' | '90d']
    const cutoff = now - days * 24 * 60 * 60 * 1000
    list = list.filter(o => new Date(o.createdAt).getTime() >= cutoff)
  }
  if (filterShipping.value !== 'all') {
    list = list.filter(o => {
      const isPickup = String(o.shippingCarrier || '').toLowerCase().includes('retir') ||
                       String(o.shippingService || '').toLowerCase().startsWith('retir')
      if (filterShipping.value === 'pickup') return isPickup
      if (filterShipping.value === 'labeled') return !!o.shippingLabelUrl
      if (filterShipping.value === 'pending_label') return !isPickup && !o.shippingLabelUrl && o.paymentStatus === 'APPROVED'
      return true
    })
  }
  return list
})

const hasActiveFilters = computed(() =>
  filterStatus.value !== 'all' || filterPayment.value !== 'all' ||
  filterPeriod.value !== 'all' || filterShipping.value !== 'all' ||
  !!search.value
)
const clearAllFilters = () => {
  filterStatus.value = 'all'
  filterPayment.value = 'all'
  filterPeriod.value = 'all'
  filterShipping.value = 'all'
  search.value = ''
  page.value = 1
  fetchOrders()
}

// Avatar com iniciais — colore por hash do nome
const initials = (name?: string) => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase().slice(0, 2)
}
const avatarColor = (name?: string) => {
  const colors = ['#FEE2E2', '#FEF3C7', '#DBEAFE', '#D1FAE5', '#E0E7FF', '#FCE7F3', '#FFEDD5']
  if (!name) return colors[0]
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 1000
  return colors[h % colors.length]
}
const avatarTextColor = (name?: string) => {
  const colors = ['#991B1B', '#92400E', '#1E40AF', '#065F46', '#3730A3', '#9D174D', '#9A3412']
  if (!name) return colors[0]
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 1000
  return colors[h % colors.length]
}

// Detecta pedidos que precisam de atenção — pago mas sem etiqueta há > 6h
const needsAttention = (o: Order) => {
  if (o.paymentStatus !== 'APPROVED') return false
  if (o.status !== 'PENDING') return false
  if (o.shippingLabelUrl) return false
  const isPickup = String(o.shippingCarrier || '').toLowerCase().includes('retir')
  if (isPickup) return false
  const hours = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60)
  return hours > 6
}

// Status visual do envio — pra coluna nova na tabela
const shippingBadge = (o: Order) => {
  const isPickup = String(o.shippingCarrier || '').toLowerCase().includes('retir') ||
                   String(o.shippingService || '').toLowerCase().startsWith('retir')
  if (isPickup) return { l: 'Retirada', bg: '#F0F9FF', c: '#075985', icon: 'pickup' }
  if (o.shippingLabelUrl) return { l: 'Etiquetado', bg: '#D1FAE5', c: '#065F46', icon: 'label' }
  if (o.trackingCode) return { l: 'Em trânsito', bg: '#DBEAFE', c: '#1E40AF', icon: 'truck' }
  if (o.paymentStatus === 'APPROVED') return { l: 'Aguarda etiqueta', bg: '#FEF3C7', c: '#92400E', icon: 'pending' }
  return { l: '—', bg: '#F1F5F9', c: '#94A3B8', icon: 'none' }
}

// Paginação
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const detail = ref<Order | null>(null)
const trackingInput = ref('')
const labelUrlInput = ref('')
const buyingLabel = ref(false)
const labelError = ref('')
const syncingPayment = ref(false)

const fetchOrders = async () => {
  loading.value = true
  try {
    const qs = new URLSearchParams()
    if (filterStatus.value !== 'all')   qs.set('status', filterStatus.value)
    if (filterPayment.value !== 'all')  qs.set('paymentStatus', filterPayment.value)
    if (search.value)                    qs.set('search', search.value)
    qs.set('page', String(page.value))
    qs.set('pageSize', String(pageSize.value))
    const [oRes, sRes] = await Promise.all([
      apiFetch(`/api/ecommerce/admin/orders?${qs.toString()}`),
      apiFetch('/api/ecommerce/admin/orders/stats'),
    ])
    if (oRes.ok) {
      const body = await oRes.json()
      // Compat com versão antiga do endpoint que retornava só array
      if (Array.isArray(body)) {
        orders.value = body
        total.value = body.length
      } else {
        orders.value = body.data || []
        total.value = body.total || 0
      }
    }
    if (sRes.ok) stats.value = await sRes.json()
  } finally { loading.value = false }
}

const goToPage = (p: number) => {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  fetchOrders()
}

const openDetail = async (o: Order) => {
  // Recarrega o detalhe completo (com attachments etc.)
  const res = await apiFetch(`/api/ecommerce/admin/orders/${o.id}`)
  if (res.ok) {
    detail.value = await res.json()
    trackingInput.value = detail.value?.trackingCode || ''
    labelUrlInput.value = detail.value?.shippingLabelUrl || ''
    activeOrderTab.value = 'summary'   // sempre abre na primeira tab
  }
}
const closeDetail = () => { detail.value = null }

const advanceStatus = async (newStatus: string) => {
  if (!detail.value) return
  try {
    const res = await apiFetch(`/api/ecommerce/admin/orders/${detail.value.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      showToast('Status atualizado', 'success')
      await fetchOrders()
      detail.value = await res.json()
    } else {
      showToast('Erro ao atualizar', 'error')
    }
  } catch { showToast('Erro ao atualizar', 'error') }
}

const refreshPayment = async () => {
  if (!detail.value || syncingPayment.value) return
  syncingPayment.value = true
  try {
    const res = await apiFetch(`/api/ecommerce/admin/orders/${detail.value.id}/refresh-payment`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      const newStatus = data.status || data.paymentStatus
      if (data.unchanged) {
        showToast('Status já está atualizado', 'info')
      } else if (newStatus === 'APPROVED') {
        showToast('Pagamento confirmado!', 'success')
      } else {
        showToast(`Status: ${newStatus || 'sem mudança'}`, 'info')
      }
      // Recarrega o detalhe + lista
      const r2 = await apiFetch(`/api/ecommerce/admin/orders/${detail.value.id}`)
      if (r2.ok) detail.value = await r2.json()
      await fetchOrders()
    } else {
      showToast(data.message || 'Erro ao sincronizar', 'error')
    }
  } catch (e: any) {
    showToast(e.message || 'Erro ao sincronizar', 'error')
  } finally {
    syncingPayment.value = false
  }
}

// Detecta pedidos de retirada na loja — não tem etiqueta nem rastreio.
// O backend (LabelService) também bloqueia, mas escondemos o botão aqui pra
// UX ficar limpa (admin não tenta clicar e ver erro).
const isPickupOrder = computed(() => {
  if (!detail.value) return false
  const carrier = String(detail.value.shippingCarrier || '').toLowerCase()
  const service = String(detail.value.shippingService || '').toLowerCase()
  return service.startsWith('retirar') || carrier === 'loja' || carrier.includes('retirar')
})

const canBuyLabel = computed(() => {
  if (!detail.value) return false
  if (isPickupOrder.value) return false   // retirada na loja não tem etiqueta
  return detail.value.paymentStatus === 'APPROVED'
    && !!detail.value.shippingService
    && !detail.value.shippingLabelUrl
})

/**
 * URL de download direto do PDF da etiqueta — proxy via nosso backend
 * (em vez de redirect pro CDN do ME). JWT é passado em ?token= porque
 * window.open não suporta header Authorization. JwtStrategy.fromExtractors
 * já aceita esse fallback.
 */
const labelDownloadUrl = (orderId: number): string => {
  const token = localStorage.getItem('gp_token') || ''
  return `/api/ecommerce/admin/orders/${orderId}/label/download?token=${encodeURIComponent(token)}`
}

/** URL de pré-visualização (JPEG inline) — usada na tab "Etiqueta" do modal */
const labelPreviewUrl = (orderId: number): string => {
  const token = localStorage.getItem('gp_token') || ''
  return `/api/ecommerce/admin/orders/${orderId}/label/preview?token=${encodeURIComponent(token)}`
}

// Tabs do modal de pedido — padrão do CustomersView (border-bottom selecionada)
type OrderTab = 'summary' | 'shipping' | 'label'
const activeOrderTab = ref<OrderTab>('summary')

// Refund (reembolso via MP) — só ADMIN consegue chamar (backend valida)
const userRole = ref<string>(JSON.parse(localStorage.getItem('gp_user') || '{}')?.role || '')
const isAdmin = computed(() => userRole.value === 'ADMIN')
const showRefundDialog = ref(false)
const refundType = ref<'full' | 'partial'>('full')
const refundAmount = ref<number | null>(null)
const refundReason = ref('')
const refundLoading = ref(false)
const refundError = ref('')

const canRefund = computed(() => {
  if (!detail.value) return false
  if (!isAdmin.value) return false
  if (detail.value.paymentStatus !== 'APPROVED') return false
  if (!detail.value.paymentExternalId) return false
  return true
})

const openRefund = () => {
  if (!detail.value) return
  refundType.value = 'full'
  refundAmount.value = Number(detail.value.amount)
  refundReason.value = ''
  refundError.value = ''
  showRefundDialog.value = true
}
const closeRefund = () => { showRefundDialog.value = false }

const submitRefund = async () => {
  if (!detail.value) return
  refundLoading.value = true
  refundError.value = ''
  try {
    const body: any = { reason: refundReason.value || undefined }
    if (refundType.value === 'partial') {
      const v = Number(refundAmount.value)
      if (!v || v <= 0) {
        refundError.value = 'Informe um valor maior que zero pra reembolso parcial.'
        refundLoading.value = false
        return
      }
      body.amount = v
    }
    const res = await apiFetch(`/api/ecommerce/admin/orders/${detail.value.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) {
      showToast(
        data.isFull ? 'Pedido reembolsado e cancelado' : `Reembolso parcial de R$ ${Number(data.amount).toFixed(2)} processado`,
        'success'
      )
      showRefundDialog.value = false
      // recarrega detalhe + lista
      const r2 = await apiFetch(`/api/ecommerce/admin/orders/${detail.value.id}`)
      if (r2.ok) detail.value = await r2.json()
      await fetchOrders()
    } else {
      refundError.value = data.message || 'Falha ao reembolsar'
    }
  } catch (e: any) {
    refundError.value = e?.message || 'Erro de rede'
  } finally {
    refundLoading.value = false
  }
}

const buyLabel = async () => {
  if (!detail.value) return
  if (!confirm('Comprar etiqueta no Melhor Envios? O valor será debitado do seu saldo ME.')) return
  buyingLabel.value = true
  labelError.value = ''
  try {
    const res = await apiFetch(`/api/ecommerce/admin/orders/${detail.value.id}/label`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.labelUrl) {
      showToast('Etiqueta gerada!', 'success')
      labelUrlInput.value = data.labelUrl
      // Baixa direto pelo nosso domínio com filename amigável (etiqueta-pedido-00015.pdf)
      // em vez de abrir o painel ME. Browser dispara download nativo.
      window.open(labelDownloadUrl(detail.value.id), '_blank')
      // Recarrega o detalhe
      const r2 = await apiFetch(`/api/ecommerce/admin/orders/${detail.value.id}`)
      if (r2.ok) detail.value = await r2.json()
      await fetchOrders()
    } else {
      labelError.value = data.message || 'Erro ao comprar etiqueta'
      showToast(labelError.value, 'error')
    }
  } catch (e: any) {
    labelError.value = e.message || 'Erro ao comprar etiqueta'
    showToast(labelError.value, 'error')
  } finally {
    buyingLabel.value = false
  }
}

const saveShipping = async () => {
  if (!detail.value) return
  try {
    const res = await apiFetch(`/api/ecommerce/admin/orders/${detail.value.id}/shipping`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingCode: trackingInput.value || null,
        shippingLabelUrl: labelUrlInput.value || null,
        shippingStatus: trackingInput.value ? 'POSTED' : 'PENDING',
      }),
    })
    if (res.ok) {
      showToast('Rastreio salvo', 'success')
      await fetchOrders()
      detail.value = await res.json()
    } else { showToast('Erro ao salvar', 'error') }
  } catch { showToast('Erro ao salvar', 'error') }
}

const fmtMoney = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const statusBadge = (s: string) => ({
  PENDING:    { l: 'Aguardando',  bg: '#FEF3C7', c: '#92400E' },
  PRODUCTION: { l: 'Produção',    bg: '#DBEAFE', c: '#1E3A8A' },
  FINISHED:   { l: 'Pronto',      bg: '#E0F2FE', c: '#0C4A6E' },
  DELIVERED:  { l: 'Entregue',    bg: '#D1FAE5', c: '#065F46' },
}[s] || { l: s, bg: '#F1F5F9', c: '#475569' })

const paymentBadge = (p: string) => ({
  PENDING:         { l: 'Aguardando pgto', bg: '#FEF3C7', c: '#92400E' },
  APPROVED:        { l: 'Pago',            bg: '#D1FAE5', c: '#065F46' },
  REJECTED:        { l: 'Recusado',        bg: '#FEE2E2', c: '#991B1B' },
  REFUNDED:        { l: 'Reembolsado',     bg: '#F3E8FF', c: '#6B21A8' },
  PARTIAL_REFUND:  { l: 'Reemb. parcial',  bg: '#EDE9FE', c: '#5B21B6' },
}[p] || { l: p, bg: '#F1F5F9', c: '#475569' })

let searchTimer: any
watch(search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page.value = 1; fetchOrders() }, 350) })
// Filtros que rodam no servidor: precisam refetch
watch([filterStatus, filterPayment], () => { page.value = 1; fetchOrders() })
watch([filterStatus, filterPayment], () => { page.value = 1; fetchOrders() })

onMounted(fetchOrders)
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <h1 class="text-xl font-medium text-slate-900">Pedidos do ecommerce</h1>
        <p class="text-sm text-slate-500 mt-1">Acompanhe e gerencie os pedidos vindos da sua loja online</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="text" placeholder="Buscar #ID, nome ou email..."
            class="pl-9 pr-3 py-2 w-72 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 transition-colors" />
        </div>
        <button @click="fetchOrders" :disabled="loading"
          class="p-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg text-slate-600 transition-colors"
          title="Atualizar lista">
          <svg :class="['w-4 h-4', loading ? 'animate-spin' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>
    </div>

    <!-- KPIs com ícones e contexto -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
        <div class="flex items-start justify-between">
          <div class="text-xs text-slate-500">Aguardando pagamento</div>
          <div class="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="text-2xl font-medium text-slate-900 mt-2">{{ stats.awaitingPayment }}</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
        <div class="flex items-start justify-between">
          <div class="text-xs text-slate-500">Pagos hoje</div>
          <div class="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
        </div>
        <div class="text-2xl font-medium mt-2" style="color:#1D9E75">{{ stats.paidToday }}</div>
        <div class="text-[11px] text-slate-400 mt-1">{{ fmtMoney(stats.todayRevenue) }} faturados</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
        <div class="flex items-start justify-between">
          <div class="text-xs text-slate-500">Em produção</div>
          <div class="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          </div>
        </div>
        <div class="text-2xl font-medium text-slate-900 mt-2">{{ stats.inProduction }}</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
        :class="stats.awaitingShipping > 0 ? 'border-rose-200 bg-rose-50/30' : ''">
        <div class="flex items-start justify-between">
          <div class="text-xs text-slate-500">Aguardando envio</div>
          <div :class="['w-7 h-7 rounded-lg flex items-center justify-center', stats.awaitingShipping > 0 ? 'bg-rose-100' : 'bg-slate-100']">
            <svg :class="['w-3.5 h-3.5', stats.awaitingShipping > 0 ? 'text-rose-600' : 'text-slate-600']" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
        </div>
        <div class="text-2xl font-medium mt-2" :style="{ color: stats.awaitingShipping > 0 ? '#A32D2D' : '#0F172A' }">{{ stats.awaitingShipping }}</div>
        <div v-if="stats.awaitingShipping > 0" class="text-[11px] text-rose-600 mt-1">Precisa de atenção</div>
      </div>
    </div>

    <!-- Filtros — agrupados em 3 linhas: Status / Pagamento / Período + Envio -->
    <div class="border border-slate-200 rounded-xl p-3 space-y-2.5">
      <!-- Status do pedido -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-slate-500 ml-1 w-20">Status</span>
        <button v-for="f in [
          { v: 'all',        l: 'Todos' },
          { v: 'PENDING',    l: 'Aguardando' },
          { v: 'PRODUCTION', l: 'Produção' },
          { v: 'FINISHED',   l: 'Pronto' },
          { v: 'DELIVERED',  l: 'Entregue' },
        ]" :key="f.v"
          @click="filterStatus = f.v as any"
          :class="['px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            filterStatus === f.v ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
          {{ f.l }}
        </button>
      </div>
      <!-- Pagamento -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-slate-500 ml-1 w-20">Pagamento</span>
        <button v-for="f in [
          { v: 'all',      l: 'Todos' },
          { v: 'PENDING',  l: 'Aguardando' },
          { v: 'APPROVED', l: 'Pagos' },
          { v: 'REJECTED', l: 'Recusados' },
          { v: 'REFUNDED', l: 'Reembolsados' },
        ]" :key="f.v"
          @click="filterPayment = f.v as any"
          :class="['px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            filterPayment === f.v ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
          {{ f.l }}
        </button>
      </div>
      <!-- Período + Envio + Clear -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-slate-500 ml-1 w-20">Período</span>
        <button v-for="f in [
          { v: 'all',   l: 'Tudo' },
          { v: 'today', l: 'Hoje' },
          { v: '7d',    l: '7 dias' },
          { v: '30d',   l: '30 dias' },
          { v: '90d',   l: '90 dias' },
        ]" :key="f.v"
          @click="filterPeriod = f.v as any"
          :class="['px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            filterPeriod === f.v ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
          {{ f.l }}
        </button>
        <div class="w-px h-5 bg-slate-200 mx-1"></div>
        <span class="text-xs text-slate-500">Envio</span>
        <button v-for="f in [
          { v: 'all',           l: 'Todos' },
          { v: 'pending_label', l: 'Aguardando etiqueta' },
          { v: 'labeled',       l: 'Etiquetados' },
          { v: 'pickup',        l: 'Retirada' },
        ]" :key="f.v"
          @click="filterShipping = f.v as any"
          :class="['px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            filterShipping === f.v ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
          {{ f.l }}
        </button>
        <button v-if="hasActiveFilters" @click="clearAllFilters"
          class="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 px-2 py-1 transition-colors"
          title="Limpar todos os filtros">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Limpar filtros
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
            <tr class="border-b border-slate-200 bg-slate-50/50">
              <th class="pl-5 pr-2 py-3 text-xs font-medium text-slate-500 w-1"></th>
              <th class="px-3 py-3 text-xs font-medium text-slate-500">Pedido</th>
              <th class="px-3 py-3 text-xs font-medium text-slate-500">Cliente</th>
              <th class="px-3 py-3 text-xs font-medium text-slate-500">Total</th>
              <th class="px-3 py-3 text-xs font-medium text-slate-500">Pagamento</th>
              <th class="px-3 py-3 text-xs font-medium text-slate-500">Status</th>
              <th class="px-3 py-3 text-xs font-medium text-slate-500">Envio</th>
              <th class="px-3 py-3 text-xs font-medium text-slate-500">Criado</th>
              <th class="px-3 py-3 text-xs font-medium text-slate-500"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in filteredOrders" :key="o.id"
              @click="openDetail(o)"
              class="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors group">
              <!-- Indicador lateral de atenção (paga há > 6h sem etiqueta) -->
              <td class="pl-5 pr-2 py-3 w-1">
                <div v-if="needsAttention(o)" class="w-1 h-10 rounded-full bg-rose-400" title="Pago há mais de 6h sem etiqueta"></div>
                <div v-else class="w-1 h-10"></div>
              </td>
              <td class="px-3 py-3">
                <div class="text-sm font-mono font-medium text-slate-900">#{{ String(o.id).padStart(5, '0') }}</div>
                <div class="text-[10px] text-slate-400 truncate max-w-[180px]" :title="o.productDescription">{{ o.productDescription }}</div>
              </td>
              <td class="px-3 py-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                    :style="{ background: avatarColor(o.customer.name), color: avatarTextColor(o.customer.name) }">
                    {{ initials(o.customer.name) }}
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-slate-900 truncate max-w-[180px]">{{ o.customer.name }}</div>
                    <div class="text-[11px] text-slate-400 truncate max-w-[180px]">{{ o.customer.email }}</div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3">
                <div class="text-sm font-medium text-slate-900">{{ fmtMoney(o.amount) }}</div>
                <div v-if="o.details?.items?.length" class="text-[10px] text-slate-400">
                  {{ o.details.items.length }} {{ o.details.items.length === 1 ? 'item' : 'itens' }}
                </div>
              </td>
              <td class="px-3 py-3">
                <span class="inline-block text-[10px] font-medium px-2 py-1 rounded-full"
                  :style="{ background: paymentBadge(o.paymentStatus).bg, color: paymentBadge(o.paymentStatus).c }">
                  {{ paymentBadge(o.paymentStatus).l }}
                </span>
                <div v-if="o.paymentMethod" class="text-[10px] text-slate-400 mt-1">{{ o.paymentMethod }}</div>
              </td>
              <td class="px-3 py-3">
                <span class="inline-block text-[10px] font-medium px-2 py-1 rounded-full"
                  :style="{ background: statusBadge(o.status).bg, color: statusBadge(o.status).c }">
                  {{ statusBadge(o.status).l }}
                </span>
              </td>
              <td class="px-3 py-3">
                <span class="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full"
                  :style="{ background: shippingBadge(o).bg, color: shippingBadge(o).c }">
                  <svg v-if="shippingBadge(o).icon === 'pickup'" class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M3 21h18M5 21V7l7-4 7 4v14"/></svg>
                  <svg v-else-if="shippingBadge(o).icon === 'label'" class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M9 12l2 2 4-4"/></svg>
                  <svg v-else-if="shippingBadge(o).icon === 'truck'" class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/></svg>
                  <svg v-else-if="shippingBadge(o).icon === 'pending'" class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {{ shippingBadge(o).l }}
                </span>
              </td>
              <td class="px-3 py-3 text-[11px] text-slate-500 whitespace-nowrap">{{ fmtDate(o.createdAt) }}</td>
              <td class="px-3 py-3 text-right">
                <button @click.stop="openDetail(o)"
                  class="text-xs text-slate-700 border border-slate-200 group-hover:border-slate-300 hover:bg-white rounded-full px-3 py-1.5 transition-colors whitespace-nowrap">
                  Detalhes
                </button>
              </td>
            </tr>
            <tr v-if="!filteredOrders.length && !loading">
              <td colspan="9" class="px-5 py-16 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-slate-700">
                      {{ hasActiveFilters ? 'Nenhum pedido encontrado com esses filtros' : 'Nenhum pedido ainda' }}
                    </div>
                    <div class="text-xs text-slate-400 mt-1">
                      {{ hasActiveFilters
                        ? 'Tente afrouxar os filtros ou limpar a busca.'
                        : 'Os pedidos da loja online aparecerão aqui assim que chegarem.' }}
                    </div>
                  </div>
                  <button v-if="hasActiveFilters" @click="clearAllFilters"
                    class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-1.5 transition-colors mt-1">
                    Limpar filtros
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginação — componente compartilhado -->
      <div v-if="!loading && total > 0" class="px-5 border-t border-slate-200">
        <PaginationControls
          :page="page"
          :total-pages="totalPages"
          :total="total"
          :limit="pageSize"
          @update:page="(p) => { page = p; fetchOrders() }"
          @update:limit="(n) => { pageSize = n; page = 1; fetchOrders() }"
        />
      </div>
    </div>

    <!-- Modal de detalhe -->
    <div v-if="detail" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="closeDetail"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-3xl h-[85vh] flex flex-col z-10">
        <header class="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 class="text-base font-medium text-slate-900">Pedido #{{ String(detail.id).padStart(5, '0') }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ fmtDate(detail.createdAt) }}</p>
          </div>
          <button @click="closeDetail" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <!-- Tabs -->
        <div class="px-6 border-b border-slate-100 flex items-center gap-1 shrink-0">
          <button v-for="t in ([
            { id: 'summary',  label: 'Resumo',     show: true },
            { id: 'shipping', label: 'Envio',      show: true },
            { id: 'label',    label: 'Etiqueta',   show: !!detail.shippingLabelUrl && !isPickupOrder },
          ] as const).filter(x => x.show)" :key="t.id"
            @click="activeOrderTab = t.id"
            :class="['px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeOrderTab === t.id
                ? 'text-slate-900 border-slate-900'
                : 'text-slate-500 border-transparent hover:text-slate-700']">
            {{ t.label }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <!-- ============ TAB: RESUMO ============ -->
          <div v-show="activeOrderTab === 'summary'" class="space-y-5">
          <!-- Status atual + ações -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-slate-500">Status:</span>
            <span class="text-xs font-medium px-2.5 py-1 rounded-full" :style="{ background: statusBadge(detail.status).bg, color: statusBadge(detail.status).c }">
              {{ statusBadge(detail.status).l }}
            </span>
            <span class="text-xs font-medium px-2.5 py-1 rounded-full" :style="{ background: paymentBadge(detail.paymentStatus).bg, color: paymentBadge(detail.paymentStatus).c }">
              {{ paymentBadge(detail.paymentStatus).l }}
            </span>
            <button v-if="detail.paymentStatus === 'PENDING' && detail.paymentExternalId && perms.can.edit('ecommerce-orders')"
              @click="refreshPayment" :disabled="syncingPayment"
              :title="'Consulta o Mercado Pago e atualiza o status'"
              class="inline-flex items-center gap-1.5 text-[11px] text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-full px-2.5 py-1 transition-colors">
              <span v-if="syncingPayment" class="w-3 h-3 border border-slate-300 border-t-slate-700 rounded-full animate-spin"></span>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Sincronizar com MP
            </button>
            <div class="ml-auto flex gap-2">
              <button v-if="detail.status === 'PENDING' && detail.paymentStatus === 'APPROVED' && perms.can.edit('ecommerce-orders')" @click="advanceStatus('PRODUCTION')" class="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-full transition-colors">
                → Em produção
              </button>
              <button v-if="detail.status === 'PRODUCTION' && perms.can.edit('ecommerce-orders')" @click="advanceStatus('FINISHED')" class="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-full transition-colors">
                → Marcar como pronto
              </button>
              <button v-if="detail.status === 'FINISHED' && perms.can.edit('ecommerce-orders')" @click="advanceStatus('DELIVERED')" class="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-full transition-colors">
                → Marcar como entregue
              </button>
              <button v-if="canRefund && perms.can.edit('ecommerce-orders')" @click="openRefund"
                class="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full transition-colors"
                title="Reembolsar via Mercado Pago">
                Reembolsar
              </button>
            </div>
          </div>

          <!-- Cliente -->
          <section>
            <h4 class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Cliente</h4>
            <div class="bg-slate-50 rounded-lg p-4 text-sm">
              <div class="font-medium text-slate-900">{{ detail.customer.name }}</div>
              <div class="text-slate-600">{{ detail.customer.email }}</div>
              <div v-if="detail.customer.phone" class="text-slate-600">{{ detail.customer.phone }}</div>
            </div>
          </section>

          <!-- Itens -->
          <section v-if="detail.details?.items?.length">
            <h4 class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Itens</h4>
            <div class="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div v-for="item in detail.details.items" :key="item.id" class="flex justify-between items-center px-4 py-3 text-sm">
                <div>
                  <div class="font-medium text-slate-900">{{ item.name }}</div>
                  <div class="text-xs text-slate-500">{{ item.qty }}× {{ fmtMoney(item.unitPrice) }}</div>
                </div>
                <div class="font-medium text-slate-900">{{ fmtMoney(item.lineTotal) }}</div>
              </div>
              <div class="flex justify-between items-center px-4 py-3 text-sm bg-slate-50">
                <span class="text-slate-600">Subtotal</span>
                <span>{{ fmtMoney(detail.details.subtotal) }}</span>
              </div>
              <div v-if="detail.details.shippingCost" class="flex justify-between items-center px-4 py-3 text-sm bg-slate-50">
                <span class="text-slate-600">Frete <span v-if="detail.shippingService" class="text-xs text-slate-400">({{ detail.shippingService }})</span></span>
                <span>{{ fmtMoney(detail.details.shippingCost) }}</span>
              </div>
              <div class="flex justify-between items-center px-4 py-3 text-sm bg-slate-50 font-medium">
                <span>Total</span>
                <span>{{ fmtMoney(detail.amount) }}</span>
              </div>
            </div>
          </section>
          </div><!-- /tab Resumo -->

          <!-- ============ TAB: ENVIO ============ -->
          <div v-show="activeOrderTab === 'shipping'" class="space-y-5">
          <!-- Endereço de envio -->
          <section v-if="detail.shippingAddress">
            <h4 class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Endereço de envio</h4>
            <div class="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
              {{ detail.shippingAddress.street }}, {{ detail.shippingAddress.number }}
              <span v-if="detail.shippingAddress.complement"> — {{ detail.shippingAddress.complement }}</span><br>
              {{ detail.shippingAddress.neighborhood }} · {{ detail.shippingAddress.city }}/{{ detail.shippingAddress.state }} · {{ detail.shippingAddress.cep }}
            </div>
          </section>

          <!-- Rastreio + Etiqueta (ou aviso de retirada na loja) -->
          <section>
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {{ isPickupOrder ? 'Entrega' : 'Etiqueta & rastreamento' }}
              </h4>
              <span v-if="detail.shippingService" class="text-[11px] text-slate-400">
                {{ detail.shippingService }}<span v-if="detail.shippingCarrier && !isPickupOrder"> · {{ detail.shippingCarrier }}</span>
              </span>
            </div>

            <!-- Pedido de retirada na loja: sem etiqueta nem rastreio. -->
            <div v-if="isPickupOrder" class="mb-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50 flex items-start gap-3">
              <svg class="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h6M9 13h6M9 17h6"/>
              </svg>
              <div class="text-sm text-emerald-900">
                <div class="font-medium">Retirada na loja</div>
                <div class="text-xs text-emerald-800 mt-0.5">
                  Cliente vai buscar pessoalmente. Não precisa comprar etiqueta nem código de rastreio —
                  avise por WhatsApp quando o pedido estiver pronto pra retirada.
                </div>
              </div>
            </div>

            <!-- Comprar etiqueta no ME -->
            <div v-else-if="canBuyLabel" class="mb-3 p-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-medium text-slate-900">Comprar etiqueta no Melhor Envios</div>
                <div class="text-xs text-slate-500 mt-0.5">Valor debitado do seu saldo ME · gera PDF + tracking automaticamente</div>
              </div>
              <button v-if="perms.can.edit('ecommerce-orders')" @click="buyLabel" :disabled="buyingLabel"
                class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-full px-5 py-2 transition-colors whitespace-nowrap">
                <span v-if="buyingLabel" class="w-3 h-3 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                {{ buyingLabel ? 'Gerando...' : 'Comprar etiqueta' }}
              </button>
            </div>
            <p v-if="labelError" class="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">{{ labelError }}</p>

            <div v-if="detail.shippingLabelUrl" class="mb-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-2 text-sm text-emerald-800">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>Etiqueta gerada</span>
                <span v-if="detail.meShipmentId" class="text-[10px] font-mono text-emerald-600">#{{ String(detail.meShipmentId).slice(0, 8) }}…</span>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" @click="activeOrderTab = 'label'"
                  class="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
                  title="Ver pré-visualização">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Visualizar
                </button>
                <a :href="labelDownloadUrl(detail.id)" target="_blank"
                  class="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-4 py-1.5 transition-colors whitespace-nowrap"
                  title="Baixar PDF da etiqueta">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Baixar
                </a>
              </div>
            </div>

            <!-- Manual fallback — só pra pedidos de transportadora (retirada não precisa) -->
            <div v-if="!isPickupOrder" class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Código de rastreio</label>
                <input v-model="trackingInput" type="text" placeholder="OZ123456789BR"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">URL da etiqueta (manual)</label>
                <input v-model="labelUrlInput" type="text" placeholder="https://..."
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
              </div>
            </div>
            <div v-if="!isPickupOrder" class="mt-3 flex gap-2 justify-end">
              <button v-if="perms.can.edit('ecommerce-orders')" @click="saveShipping"
                class="text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-1.5 transition-colors">
                Salvar rastreio
              </button>
            </div>
          </section>
          </div><!-- /tab Envio -->

          <!-- ============ TAB: ETIQUETA (preview JPEG inline) ============ -->
          <div v-show="activeOrderTab === 'label'" v-if="detail.shippingLabelUrl && !isPickupOrder" class="space-y-4">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 class="text-sm font-medium text-slate-900">Pré-visualização da etiqueta</h4>
                <p class="text-xs text-slate-500 mt-0.5">
                  {{ detail.shippingService }}<span v-if="detail.shippingCarrier"> · {{ detail.shippingCarrier }}</span>
                  <span v-if="detail.trackingCode"> · <span class="font-mono">{{ detail.trackingCode }}</span></span>
                </p>
              </div>
              <a :href="labelDownloadUrl(detail.id)" target="_blank"
                class="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-4 py-1.5 transition-colors whitespace-nowrap"
                title="Baixar PDF da etiqueta">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Baixar PDF
              </a>
            </div>
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 flex justify-center">
              <img :src="labelPreviewUrl(detail.id)" alt="Pré-visualização da etiqueta"
                class="max-w-full h-auto rounded shadow-sm bg-white" />
            </div>
            <p class="text-[11px] text-slate-400 text-center">
              Esta é a versão JPEG da etiqueta. Para impressão, baixe o PDF.
            </p>
          </div><!-- /tab Etiqueta -->
        </div><!-- /scroll container -->
      </div>

      <!-- Dialog de reembolso (sobreposto ao modal do pedido) -->
      <div v-if="showRefundDialog" class="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-900/40">
        <div class="bg-white rounded-xl border border-slate-200 w-full max-w-md shadow-xl">
          <header class="px-6 py-4 border-b border-slate-100">
            <h4 class="text-base font-medium text-slate-900">Reembolsar pedido</h4>
            <p class="text-xs text-slate-500 mt-0.5">
              Valor pago: <strong>R$ {{ Number(detail?.amount || 0).toFixed(2) }}</strong> via {{ detail?.paymentMethod || 'Mercado Pago' }}
            </p>
          </header>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-xs text-slate-500 mb-2">Tipo de reembolso</label>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" @click="refundType = 'full'; refundAmount = Number(detail?.amount || 0)"
                  :class="['border rounded-lg px-3 py-2 text-sm transition-colors',
                    refundType === 'full'
                      ? 'border-rose-400 bg-rose-50 text-rose-800 font-medium'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50']">
                  Total
                </button>
                <button type="button" @click="refundType = 'partial'"
                  :disabled="detail?.paymentMethod === 'BOLETO'"
                  :class="['border rounded-lg px-3 py-2 text-sm transition-colors',
                    refundType === 'partial'
                      ? 'border-rose-400 bg-rose-50 text-rose-800 font-medium'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                    detail?.paymentMethod === 'BOLETO' ? 'opacity-50 cursor-not-allowed' : '']"
                  :title="detail?.paymentMethod === 'BOLETO' ? 'Boleto só aceita reembolso total' : 'Reembolso parcial'">
                  Parcial
                </button>
              </div>
            </div>

            <div v-if="refundType === 'partial'">
              <label class="block text-xs text-slate-500 mb-1.5">Valor a reembolsar (R$)</label>
              <input v-model.number="refundAmount" type="number" step="0.01" min="0.01"
                :max="Number(detail?.amount || 0)"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 font-mono" />
              <p class="text-[11px] text-slate-400 mt-1">
                Máx: R$ {{ Number(detail?.amount || 0).toFixed(2) }}
              </p>
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Motivo (opcional)</label>
              <textarea v-model="refundReason" rows="2"
                placeholder="Ex: Produto avariado, cliente desistiu, item faltante..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"></textarea>
              <p class="text-[11px] text-slate-400 mt-1">Registrado no histórico do pedido e mencionado no email pro cliente.</p>
            </div>

            <div v-if="refundType === 'full'" class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
              <strong>Atenção:</strong> reembolso total cancela o pedido, devolve o estoque e envia email pro cliente.
              Operação irreversível.
            </div>

            <p v-if="refundError" class="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{{ refundError }}</p>
          </div>
          <footer class="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button @click="closeRefund" :disabled="refundLoading"
              class="text-xs text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 transition-colors">
              Cancelar
            </button>
            <button @click="submitRefund" :disabled="refundLoading"
              class="inline-flex items-center gap-2 text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium rounded-full px-5 py-1.5 transition-colors">
              <span v-if="refundLoading" class="w-3 h-3 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
              {{ refundLoading ? 'Processando...' : (refundType === 'full' ? 'Confirmar reembolso total' : 'Reembolsar valor parcial') }}
            </button>
          </footer>
        </div>
      </div>
    </div>
  </div>
</template>
