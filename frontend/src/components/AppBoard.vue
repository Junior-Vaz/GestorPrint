<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import draggable from 'vuedraggable'
import PaymentModal from './shared/PaymentModal.vue'
import PaymentErrorModal from './shared/PaymentErrorModal.vue'
import { useAuthStore } from '../stores/auth'
import { usePermissionsStore } from '../stores/permissions'
import { apiFetch } from '../utils/api'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'

const { showToast: addToast } = useToast()
const { confirm: confirmDialog } = useConfirm()

// Nome da gráfica vem das Settings — sem isso a mensagem do WhatsApp ficaria
// genérica. Carrega 1x no mount, fallback "nossa gráfica" se vazio.
// silentOn403: PRODUCTION tem Kanban mas geralmente NÃO tem acesso a Settings.
// Sem o flag, abrir o Kanban como production gerava popup "Recurso não disponível"
// só pra pegar o nome da empresa. Falha silenciosa preserva o fallback "nossa gráfica".
const companyName = ref('nossa gráfica')
async function loadCompanyName() {
  try {
    const res = await apiFetch('/api/settings', { silentOn403: true })
    if (!res.ok) return
    const data = await res.json()
    if (data?.companyName) companyName.value = data.companyName
  } catch { /* mantém fallback */ }
}

const authStore = useAuthStore()
const perms = usePermissionsStore()
const showStockWarningModal = ref(false)

interface Order {
  id: number;
  customerName: string;
  customerPhone?: string;
  productDescription: string;
  amount: number;
  status: string;
  salesperson?: { id: number, name: string };
  producer?: { id: number, name: string };
  createdAt: string;
  deliveryDate?: string | null;
  priority?: string;
  attachments?: any[];
  transactions?: any[];
  notes?: string | null;
  source?: string;          // ERP | ECOMMERCE | PDV | WHATSAPP | AI
  // Detalhes JSON do pedido — para Ecommerce, contém o `customerNotes`
  // (observações livres que o cliente final escreveu na tela do pedido).
  // Diferente de `notes` (que é nota do operador, editada no kanban).
  details?: { customerNotes?: string; items?: any[]; [k: string]: any } | null;
}

const socket = ref<Socket | null>(null)
const orders = ref<Order[]>([])
const selectedOrder = ref<Order | null>(null)
const isModalOpen = ref(false)
const drag = ref(false)
const searchQuery = ref('')
const connectionStatus = ref('Desconectado')
const loading = ref(true)
const paymentUrl = ref('')
const isPaymentModalOpen = ref(false)
const payingOrderId = ref<number | null>(null)
const pixQrCode = ref('')
const pixQrCodeBase64 = ref('')
const paymentAmount = ref(0)
const currentTransactionId = ref<number | null>(null)
const isConfirmingPix = ref(false)
const orderToPay = ref<number | null>(null)
const verifyingOrderId = ref<number | null>(null)
const isIntegrated = ref(true)

// New modal refs
const isErrorModalOpen = ref(false)
const isConfirmingDelete = ref(false)
const orderToDelete = ref<number | null>(null)

// Notifications
const showToast = ref(false)
const toastMessage = ref('')
const triggerToast = (msg: string) => {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => showToast.value = false, 3000)
}

const filteredOrders = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return orders.value
  return orders.value.filter(o => 
    o.customerName.toLowerCase().includes(query) || 
    o.productDescription.toLowerCase().includes(query) ||
    o.id.toString().includes(query)
  )
})

// Computed columns for draggable
const pendingOrders = computed({
  get: () => filteredOrders.value.filter(o => o.status === 'PENDING'),
  set: (val) => updateOrderStatusLocal(val, 'PENDING')
})

const productionOrders = computed({
  get: () => filteredOrders.value.filter(o => o.status === 'PRODUCTION'),
  set: (val) => updateOrderStatusLocal(val, 'PRODUCTION')
})

const finishedOrders = computed({
  get: () => filteredOrders.value.filter(o => o.status === 'FINISHED'),
  set: (val) => updateOrderStatusLocal(val, 'FINISHED')
})

const deliveredOrders = computed({
  get: () => filteredOrders.value.filter(o => o.status === 'DELIVERED'),
  set: (val) => updateOrderStatusLocal(val, 'DELIVERED')
})

const columns = computed(() => [
  { id: 'PENDING', name: 'Pendentes', color: 'bg-slate-400', orders: pendingOrders },
  { id: 'PRODUCTION', name: 'Produção', color: 'bg-amber-500', orders: productionOrders },
  { id: 'FINISHED', name: 'Finalizado', color: 'bg-emerald-500', orders: finishedOrders },
  { id: 'DELIVERED', name: 'Entregues', color: 'bg-slate-900', orders: deliveredOrders }
])

// ── Paleta de status (accent colors pros cards) ─────────────────────────────
const statusAccent: Record<string, { bar: string; text: string; bg: string; label: string }> = {
  PENDING:    { bar: '#94A3B8', text: '#475569', bg: '#F1F5F9', label: 'Aguardando' },
  PRODUCTION: { bar: '#BA7517', text: '#92400E', bg: '#FAEEDA', label: 'Em produção' },
  FINISHED:   { bar: '#1D9E75', text: '#0F6E56', bg: '#E1F5EE', label: 'Concluído' },
  DELIVERED:  { bar: '#0F172A', text: '#0F172A', bg: '#E2E8F0', label: 'Entregue' },
}
const accentFor = (s: string) => statusAccent[s] || statusAccent.PENDING!

// ── Avatar helpers (reaproveita paleta do app) ──────────────────────────────
const avatarPaletteKanban = [
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#EAF3DE', fg: '#3B6D11' },
  { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#FBEAF0', fg: '#72243E' },
  { bg: '#E1F5EE', fg: '#085041' },
]
const initialsOf = (name: string) =>
  (name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '??'
const avatarColorOf = (seed: string) => {
  let h = 0
  for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return avatarPaletteKanban[h % avatarPaletteKanban.length] ?? { bg: '#F1EFE8', fg: '#444441' }
}

// ── Prazo de entrega ────────────────────────────────────────────────────────
const deliveryInfo = (dateStr?: string | null) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startDelivery = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startDelivery.getTime() - startToday.getTime()) / 86400000)
  let label = ''
  if (diffDays < 0) label = diffDays === -1 ? 'atrasado 1d' : `atrasado ${Math.abs(diffDays)}d`
  else if (diffDays === 0) label = 'entrega hoje'
  else if (diffDays === 1) label = 'entrega amanhã'
  else if (diffDays <= 7) label = `em ${diffDays}d`
  else label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const isLate = diffDays < 0
  const isSoon = diffDays >= 0 && diffDays <= 2
  const color = isLate ? '#A32D2D' : isSoon ? '#BA7517' : '#475569'
  const bg = isLate ? '#FCEBEB' : isSoon ? '#FAEEDA' : '#F1F5F9'
  return { label, color, bg, isLate, isSoon, diffDays }
}

// ── Status de pagamento (derivado das transações) ──────────────────────────
const paymentInfo = (order: Order) => {
  const total = order.amount || 0
  const txs = order.transactions || []
  const paid = txs.filter((t: any) => t.status === 'PAID').reduce((s: number, t: any) => s + (t.amount || 0), 0)
  if (paid >= total && total > 0) return { label: 'Pago', color: '#0F6E56', bg: '#E1F5EE' }
  if (paid > 0) return { label: 'Parcial', color: '#92400E', bg: '#FAEEDA' }
  const pending = txs.some((t: any) => t.status === 'PENDING')
  if (pending) return { label: 'Pix pendente', color: '#0C447C', bg: '#E6F1FB' }
  return { label: 'A receber', color: '#A32D2D', bg: '#FCEBEB' }
}

// ── Thumbnail do primeiro anexo (imagem) ───────────────────────────────────
const firstImageThumb = (order: Order): string | null => {
  const att = (order.attachments || []).find((a: any) => /^image\//.test(a.mimetype || ''))
  if (!att) return null
  const token = localStorage.getItem('gp_token') || ''
  return `/api/files/${att.filename}?token=${token}`
}

// ── Totais por coluna ──────────────────────────────────────────────────────
const columnTotal = (orders: Order[]) => orders.reduce((s, o) => s + (o.amount || 0), 0)
const formatCurrencyCompact = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`
  return `R$ ${v.toFixed(0)}`
}

// ── Salvar data de entrega ─────────────────────────────────────────────────
async function saveDeliveryDate(order: Order, value: string) {
  const payload: any = { deliveryDate: value || null }
  const prev = order.deliveryDate
  order.deliveryDate = value ? `${value}T00:00:00.000Z` : null
  try {
    const res = await apiFetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('falhou')
    addToast(value ? 'Data de entrega atualizada' : 'Prazo removido', 'success')
  } catch {
    order.deliveryDate = prev
    addToast('Não foi possível atualizar o prazo', 'error')
  }
}

// ── Toggle de prioridade ───────────────────────────────────────────────────
async function togglePriority(order: Order, ev: Event) {
  ev.stopPropagation()
  const next = order.priority === 'URGENT' ? 'NORMAL' : 'URGENT'
  const prev = order.priority
  order.priority = next
  try {
    const res = await apiFetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: next }),
    })
    if (!res.ok) throw new Error('falhou')
    addToast(next === 'URGENT' ? 'Pedido marcado como urgente' : 'Urgência removida', 'success')
  } catch {
    order.priority = prev
    addToast('Não foi possível atualizar a prioridade', 'error')
  }
}

const updateOrderStatusLocal = async (newOrders: Order[], newStatus: string) => {
  const movedOrder = newOrders.find(o => o.status !== newStatus);
  
  if (movedOrder) {
    const oldStatus = movedOrder.status;
    movedOrder.status = newStatus;
    
    try {
      const payload: any = { status: newStatus }
      
      // Auto-assign producer & Show warning if moving to PRODUCTION
      if (newStatus === 'PRODUCTION') {
        payload.producerId = authStore.user?.id
        showStockWarningModal.value = true
      }
      
      const res = await apiFetch(`/api/orders/${movedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update status');
    } catch (e) {
      console.error('Error updating order status', e);
      movedOrder.status = oldStatus;
    }
  }
}

onMounted(async () => {
  loadCompanyName()  // background, não bloqueia render
  try {
    const res = await apiFetch('/api/orders');
    if (res.ok) {
      const result = await res.json()
      orders.value = Array.isArray(result) ? result : (result.data ?? [])
    }
  } catch(e) {
    console.error('Failed to fetch initial orders', e)
  } finally {
    loading.value = false
  }

  // Check integration status — só faz a chamada se o user pode ver financeiro.
  // PRODUCTION com só view do Kanban não precisa saber se PIX está integrado
  // (não vai gerar cobrança). silentOn403 cobre o caso de admin revogar perm
  // com sessão ativa. Sem isto, o popup "Recurso não disponível" aparecia
  // toda vez que production abria o Kanban.
  if (perms.can.view('financial')) {
    const statusRes = await apiFetch('/api/payments/config-status', { silentOn403: true })
    if (statusRes.ok) {
      const statusData = await statusRes.json()
      isIntegrated.value = statusData.integrated
    }
  }

  // Backend valida JWT no handshake; se faltar, conexão é fechada com auth_error
  const token = localStorage.getItem('gp_token')
  socket.value = io({ auth: { token } })
  socket.value.on('connect', () => connectionStatus.value = 'ON')
  socket.value.on('disconnect', () => connectionStatus.value = 'OFF')
  socket.value.on('auth_error', (err: any) => {
    connectionStatus.value = 'OFF'
    console.warn('[ws] auth_error', err?.reason)
  })
  socket.value.on('new_order', (newOrder: Order) => {
    if (!orders.value.find(o => o.id === newOrder.id)) orders.value.push(newOrder)
  })
  socket.value.on('order_updated', (updatedOrder: any) => {
    const index = orders.value.findIndex(o => o.id === updatedOrder.id)
    if (index > -1) {
      const existing = orders.value[index]!
      // Merge intelligently: preserve attachments if the update doesn't have them
      const attachments = (updatedOrder.attachments && updatedOrder.attachments.length > 0)
        ? updatedOrder.attachments
        : existing.attachments;
        
      orders.value[index] = { 
        ...existing, 
        ...updatedOrder,
        attachments: attachments || []
      }
      
      // Update selectedOrder if it's the same one
      if (selectedOrder.value && selectedOrder.value.id === updatedOrder.id) {
        selectedOrder.value = { ...selectedOrder.value, ...updatedOrder, attachments: attachments || [] }
      }
      
      // If the paying order was just paid, close the payment modal
      if (payingOrderId.value === updatedOrder.id && updatedOrder.status === 'PRODUCTION') {
        isPaymentModalOpen.value = false
        payingOrderId.value = null
      }
    }
  })
})

onUnmounted(() => {
  if (socket.value) socket.value.disconnect()
})

// Função de teste removida conforme solicitação do usuário

const confirmPix = (orderId: number) => {
  orderToPay.value = orderId
  isConfirmingPix.value = true
}

const generatePix = async (orderId: number) => {
  isConfirmingPix.value = false
  try {
    const res = await apiFetch(`/api/payments/create/${orderId}?type=PIX`, {
      method: 'POST'
    })
    if (res.status === 500) {
      isErrorModalOpen.value = true;
      return;
    }
    if (res.ok) {
      const transaction = await res.json()
      if (transaction.paymentUrl) {
        paymentUrl.value = transaction.paymentUrl
        pixQrCode.value = transaction.qrCode || ''
        pixQrCodeBase64.value = transaction.qrCodeBase64 || ''
        paymentAmount.value = transaction.amount || 0
        currentTransactionId.value = transaction.id
        payingOrderId.value = orderId
        isPaymentModalOpen.value = true
      }
    }
  } catch (e) {
    console.error('Error generating PIX', e)
  }
}

/**
 * Verifica status de pagamento de um pedido. Roteia pelo método certo:
 *  1. Se pedido já tem `paymentStatus === 'APPROVED'` → confirma direto (sem
 *     chamar gateway).
 *  2. Pedido de ECOMMERCE com paymentExternalId → consulta MP via endpoint
 *     `/api/ecommerce/orders/:uuid/refresh-payment` (sincroniza com MP, atualiza
 *     order.paymentStatus, dispara webhook fake se aprovou).
 *  3. Pedido de ERP/PDV com transações PENDING → consulta gateway via
 *     `/api/payments/check/:txId` (modelo legacy de Transaction).
 *
 * Antes esse método só fazia o caso 3 — pedido do ecommerce caía no else
 * "Nenhum Pix gerado pra este pedido" porque ECOMMERCE não cria Transaction.
 */
const verifyPaymentDirectly = async (orderId: number) => {
  if (verifyingOrderId.value) return
  verifyingOrderId.value = orderId
  try {
    const orderRes = await apiFetch(`/api/orders/${orderId}`)
    if (!orderRes.ok) {
      triggerToast('Falha ao consultar pedido.')
      return
    }
    const orderData = await orderRes.json()

    // 1. Já aprovado — apenas confirma (evita re-consulta desnecessária ao gateway)
    if (orderData.paymentStatus === 'APPROVED') {
      triggerToast('Pagamento já confirmado!')
      return
    }

    // 2. Pedido do ecommerce — usa refresh-payment (puxa do MP)
    if (orderData.source === 'ECOMMERCE' && orderData.uuid && orderData.paymentExternalId) {
      const refreshRes = await apiFetch(`/api/ecommerce/orders/${orderData.uuid}/refresh-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        if (data?.paymentStatus === 'APPROVED' || data?.unchanged) {
          triggerToast(data.unchanged ? 'Pagamento já confirmado!' : 'Pagamento confirmado!')
        } else if (data?.reason === 'no_payment_id') {
          triggerToast('Pedido sem ID de pagamento — verifique no painel da loja.')
        } else {
          triggerToast('Pagamento ainda pendente. Tente novamente em alguns segundos.')
        }
      } else {
        const err = await refreshRes.json().catch(() => ({}))
        triggerToast(err.message || 'Erro ao consultar Mercado Pago.')
      }
      return
    }

    // 3. Pedido ERP/PDV — fluxo de Transaction (PIX gerado pelo ERP)
    const lastTx = orderData.transactions?.find((t: any) => t.status === 'PENDING')
    if (lastTx) {
      const res = await apiFetch(`/api/payments/check/${lastTx.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'PAID') {
          triggerToast('Pagamento confirmado!')
        } else {
          triggerToast('Pagamento ainda pendente.')
        }
      } else {
        triggerToast('Erro ao consultar gateway de pagamento.')
      }
    } else {
      triggerToast('Nenhum Pix gerado para este pedido.')
    }
  } catch (e) {
    console.error('Error verifying directly', e)
    triggerToast('Erro ao verificar pagamento.')
  } finally {
    verifyingOrderId.value = null
  }
}

const startDeleteOrder = (id: number) => {
  orderToDelete.value = id;
  isConfirmingDelete.value = true;
}

const confirmDeleteOrder = async () => {
  if (!orderToDelete.value) return;
  try {
    const res = await apiFetch(`/api/orders/${orderToDelete.value}`, { method: 'DELETE' })
    if (res.ok) {
      orders.value = orders.value.filter(o => o.id !== orderToDelete.value)
      triggerToast('Pedido excluído com sucesso!')
      if (selectedOrder.value?.id === orderToDelete.value) {
        isModalOpen.value = false;
      }
    }
  } catch (e) {
    console.error('Error deleting order', e)
    triggerToast('Erro ao excluir pedido.')
  } finally {
    isConfirmingDelete.value = false;
    orderToDelete.value = null;
  }
}

const triggerUpload = (orderId: number) => {
  const input = document.getElementById(`file-input-${orderId}`) as HTMLInputElement;
  if (input) input.click();
}

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.ps1', '.psm1', '.vbs', '.vbe',
  '.js', '.jse', '.wsf', '.wsh', '.scr', '.pif', '.reg', '.inf', '.cpl',
  '.sh', '.bash', '.zsh', '.fish', '.py', '.rb', '.pl', '.php', '.jar',
  '.dll', '.so', '.dylib', '.app', '.dmg', '.pkg', '.deb', '.rpm',
])
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024 // 50 MB

const handleFileUpload = async (event: any, orderId: number) => {
  const file: File = event.target.files[0];
  if (!file) return;

  // Validação local antes de enviar
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (BLOCKED_EXTENSIONS.has(ext)) {
    addToast(`Tipo de arquivo não permitido: ${ext}. Executáveis e scripts são bloqueados.`, 'error')
    event.target.value = '';
    return;
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    addToast(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)} MB. Máximo permitido: 50 MB.`, 'error')
    event.target.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await apiFetch(`/api/files/upload/${orderId}`, {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const newAttachment = await res.json();
      const order = orders.value.find(o => o.id === orderId);
      if (order) {
        if (!order.attachments) order.attachments = [];
        order.attachments.push(newAttachment);
      }
    } else {
      const err = await res.json().catch(() => ({ message: 'Erro no upload' }));
      addToast(err.message || 'Erro ao enviar arquivo.', 'error')
    }
  } catch (e) {
    console.error('Upload failed', e);
  }
  event.target.value = '';
}

const downloadFile = (filename: string) => {
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/files/${filename}?token=${token}`, '_blank');
}

const deleteAttachment = async (id: number, orderId: number) => {
  try {
    const res = await apiFetch(`/api/files/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const order = orders.value.find(o => o.id === orderId);
      if (order && order.attachments) {
        order.attachments = order.attachments.filter(a => a.id !== id);
      }
    }
  } catch (e) {
    console.error('Delete attachment failed', e);
  }
}

// ── WhatsApp (Evolution API com fallback wa.me) ────────────────────────────
// Cache do status da Evolution (60s) — evita bater toda vez que clica botão.
const evolutionConnected = ref<boolean | null>(null)
let evolutionCheckedAt = 0
async function isEvolutionConnected(): Promise<boolean> {
  const now = Date.now()
  if (evolutionConnected.value !== null && now - evolutionCheckedAt < 60_000) {
    return evolutionConnected.value
  }
  try {
    const res = await apiFetch('/api/mcp/evolution/status')
    if (!res.ok) { evolutionConnected.value = false; evolutionCheckedAt = now; return false }
    const data = await res.json()
    const ok = data?.state === 'open' || data?.connected === true || data?.instance?.state === 'open'
    evolutionConnected.value = !!ok
    evolutionCheckedAt = now
    return !!ok
  } catch {
    evolutionConnected.value = false
    evolutionCheckedAt = now
    return false
  }
}

/**
 * Valida número brasileiro: ≥10 dígitos (DDD + número), não pode ser tudo zero
 * ou repetido. Retorna o número limpo ou string vazia se inválido.
 */
function sanitizePhone(input?: string | null): string {
  const digits = String(input || '').replace(/\D+/g, '')
  if (digits.length < 10) return ''
  if (/^0+$/.test(digits)) return ''
  if (/^(\d)\1+$/.test(digits)) return ''  // 1111111111, 9999999999 etc
  return digits
}

const sendingWhatsapp = ref<number | null>(null)

function buildWhatsappMessage(order: Order): string {
  // Pega só o primeiro nome — fica mais natural ("Olá Junior" vs "Olá Junior Vaz")
  const firstName = (order.customerName || '').split(' ')[0] || 'cliente'
  let msg = `Olá ${firstName}, aqui é da ${companyName.value}! `
  if (order.status === 'PENDING')    msg += `Recebemos seu pedido #${order.id} (${order.productDescription}). Vamos iniciar em breve!`
  if (order.status === 'PRODUCTION') msg += `Seu pedido #${order.id} já está em produção! 🚀`
  if (order.status === 'FINISHED')   msg += `Boas notícias! Seu pedido #${order.id} está pronto para retirada. ✅`
  if (order.status === 'DELIVERED')  msg += `Seu pedido #${order.id} foi entregue. Esperamos que tenha gostado! 😊`
  return msg
}

const openWhatsApp = async (order: Order) => {
  // 1) Telefone ausente
  if (!order.customerPhone) {
    addToast('Cliente sem telefone cadastrado. Edite o cadastro do cliente antes de enviar.', 'warning')
    return
  }

  // 2) Telefone inválido (cliente "Balcão" do PDV, número fictício, etc)
  const phone = sanitizePhone(order.customerPhone)
  if (!phone) {
    addToast(`Telefone inválido (${order.customerPhone}). Verifique o cadastro do cliente.`, 'error')
    return
  }

  const msg = buildWhatsappMessage(order)
  const evolutionOn = await isEvolutionConnected()
  const phoneFmt = phone.length === 11
    ? `(${phone.slice(0,2)}) ${phone.slice(2,7)}-${phone.slice(7)}`
    : `(${phone.slice(0,2)}) ${phone.slice(2,6)}-${phone.slice(6)}`

  // 3) Confirmação antes de disparar — mostra preview da mensagem + canal
  const channel = evolutionOn ? 'enviada via WhatsApp (Evolution)' : 'aberta no WhatsApp Web'
  const ok = await confirmDialog(
    `Mensagem que será ${channel} para ${order.customerName} (${phoneFmt}):\n\n` +
    `"${msg}"`,
    {
      title:        'Enviar mensagem no WhatsApp?',
      confirmLabel: evolutionOn ? 'Enviar' : 'Abrir WhatsApp',
      danger:       false,
    },
  )
  if (!ok) return

  // 4) Evolution OFF → abre wa.me
  if (!evolutionOn) {
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    return
  }

  // 4) Evolution ON → tenta enviar pela API
  sendingWhatsapp.value = order.id
  try {
    const res = await apiFetch('/api/whatsapp/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, message: msg }),
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok && data?.ok) {
      addToast(`WhatsApp enviado pra ${order.customerName} ✓`, 'success')
      return
    }

    // Evolution caiu desde o último check — atualiza cache e abre wa.me
    if (data?.reason === 'NOT_CONFIGURED') {
      evolutionConnected.value = false
      evolutionCheckedAt = Date.now()
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank')
      return
    }

    // Evolution rejeitou (número não existe no WhatsApp, sessão expirada, etc).
    // NÃO abre wa.me — mostra a mensagem e deixa o operador decidir o que fazer.
    const errMsg = parseEvolutionError(data?.error || 'Falha ao enviar pelo WhatsApp.')
    addToast(errMsg, 'error')
  } catch (e: any) {
    addToast(e?.message || 'Erro ao enviar WhatsApp.', 'error')
  } finally {
    sendingWhatsapp.value = null
  }
}

/** Traduz erro técnico do Evolution pra mensagem útil pro operador. */
function parseEvolutionError(raw: string): string {
  if (/exists.*false|"exists":false|n[aã]o existe/i.test(raw)) {
    return 'Esse número não está registrado no WhatsApp. Confirme o cadastro do cliente.'
  }
  if (/timeout|conexão|connection/i.test(raw)) {
    return 'Tempo limite ao falar com o WhatsApp. Tente de novo em instantes.'
  }
  if (/n[aã]o configurad/i.test(raw)) {
    return 'WhatsApp não conectado. Vá em IA → WhatsApp pra reativar a sessão.'
  }
  // Limpa stack trace ou JSON cru pra leitura humana
  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw
}

const openOrderDetails = (order: Order) => {
  selectedOrder.value = order
  isModalOpen.value = true
}

const downloadReceipt = (orderId: number) => {
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/orders/${orderId}/receipt?token=${token}`, '_blank');
}

const closeOrderDetails = () => {
  isModalOpen.value = false
  selectedOrder.value = null
}

const getPreviewUrl = (filename: string) => {
  return `/api/files/${filename}`
}

const isImage = (mimetype: string) => {
  return mimetype.startsWith('image/')
}

const isPDF = (mimetype: string) => {
  return mimetype === 'application/pdf'
}

const formatRelativeDate = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate  = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays > 0 && diffDays < 7) return `há ${diffDays}d`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

// ── Notas do pedido ─────────────────────────────────────────────────────────
// Cada card permite editar uma nota livre (textarea no detail modal). Também
// é editável inline no próprio card via "+ Adicionar nota" pra agilidade do
// chão de produção.
const editingNotesId = ref<number | null>(null)
const notesDraft = ref<string>('')
const savingNotes = ref(false)

function startEditNotes(order: Order) {
  editingNotesId.value = order.id
  notesDraft.value = order.notes || ''
}

function cancelEditNotes() {
  editingNotesId.value = null
  notesDraft.value = ''
}

async function saveNotes(order: Order) {
  const value = notesDraft.value.trim()
  if (savingNotes.value) return
  savingNotes.value = true
  try {
    const res = await apiFetch(`/api/orders/${order.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ notes: value || null }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.message || 'Falha ao salvar nota.')
    }
    // Atualiza local — evita esperar o socket
    const local = orders.value.find(o => o.id === order.id)
    if (local) local.notes = value || null
    if (selectedOrder.value?.id === order.id) selectedOrder.value.notes = value || null
    addToast('Nota salva ✓', 'success')
    editingNotesId.value = null
  } catch (e: any) {
    addToast(e?.message || 'Erro ao salvar nota.', 'error')
  } finally {
    savingNotes.value = false
  }
}

// ── Origem do pedido (badges) ───────────────────────────────────────────────
function sourceLabel(source?: string): string {
  switch (source) {
    case 'ECOMMERCE': return '🛒 Loja'
    case 'PDV':       return '🛍 PDV'
    case 'WHATSAPP':  return '💬 WhatsApp'
    case 'AI':        return '🤖 IA'
    default:          return ''
  }
}

function sourceBadgeClass(source?: string): string {
  switch (source) {
    case 'ECOMMERCE': return 'bg-violet-100 text-violet-700 border border-violet-200'
    case 'PDV':       return 'bg-amber-100 text-amber-700 border border-amber-200'
    case 'WHATSAPP':  return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    case 'AI':        return 'bg-sky-100 text-sky-700 border border-sky-200'
    default:          return ''
  }
}

</script>

<template>
  <div class="relative flex flex-col h-full overflow-hidden" style="background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 45%, #FFFFFF 100%);">
    <!-- ═══ Fundo decorativo ════════════════════════════════════════ -->
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <!-- Grid sutil -->
      <div class="absolute inset-0 opacity-50" style="background-image: linear-gradient(to right, #E2E8F0 1px, transparent 1px), linear-gradient(to bottom, #E2E8F0 1px, transparent 1px); background-size: 18px 18px;"></div>
      <!-- Orbes claros flutuando -->
      <div class="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-70 blur-3xl prod-float-slow" style="background: radial-gradient(circle at center, #D1F0E2 0%, transparent 70%)"></div>
      <div class="absolute -bottom-40 -left-24 w-[520px] h-[520px] rounded-full opacity-65 blur-3xl prod-float" style="background: radial-gradient(circle at center, #E0E7FF 0%, transparent 70%)"></div>
      <div class="absolute top-1/3 right-1/4 w-[320px] h-[320px] rounded-full opacity-55 blur-3xl prod-float-slower" style="background: radial-gradient(circle at center, #FDE8CC 0%, transparent 70%)"></div>
    </div>

    <!-- Header -->
    <header class="relative flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 md:px-8 pt-4 pb-5 shrink-0">
      <div class="flex-1 max-w-md">
        <div class="relative">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por cliente, produto ou #ID…"
            class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 text-xs">
        <div class="flex items-center gap-1.5 text-slate-500">
          <span :class="['w-1.5 h-1.5 rounded-full', isIntegrated ? 'bg-emerald-500' : 'bg-red-500']"></span>
          Mercado Pago
        </div>
        <span class="text-slate-200">•</span>
        <div class="flex items-center gap-1.5 text-slate-500">
          <span :class="['w-1.5 h-1.5 rounded-full', connectionStatus === 'ON' ? 'bg-emerald-500' : 'bg-red-500']"></span>
          Tempo real
        </div>
      </div>
    </header>

    <!-- Kanban -->
    <div class="relative flex-1 overflow-x-auto overflow-y-hidden pb-6 px-6 md:px-8">
      <div class="flex gap-4 h-full items-start min-w-[1100px]">
        <div v-for="col in columns" :key="col.id" class="flex flex-col w-[272px] max-h-full shrink-0">

          <div class="flex justify-between items-center px-1 py-2 mb-2 shrink-0">
            <h3 class="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span :class="['w-1.5 h-1.5 rounded-full', col.color]"></span>
              {{ col.name }}
              <span class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded-full">{{ col.orders.value.length }}</span>
            </h3>
            <span v-if="col.orders.value.length > 0" class="text-[11px] font-medium text-slate-500">
              {{ formatCurrencyCompact(columnTotal(col.orders.value)) }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-[200px] pr-0.5">
            <!-- Loading skeleton -->
            <div v-if="loading" class="space-y-2">
              <div v-for="i in 3" :key="`s${col.id}${i}`" class="bg-white p-4 rounded-lg border border-slate-200">
                <div class="flex justify-between items-start mb-2.5">
                  <div class="h-3 bg-slate-100 rounded animate-pulse w-20"></div>
                  <div class="h-3 bg-slate-100 rounded animate-pulse w-16"></div>
                </div>
                <div class="h-3.5 bg-slate-100 rounded animate-pulse w-32 mb-2"></div>
                <div class="h-2.5 bg-slate-50 rounded animate-pulse w-full mb-1"></div>
                <div class="h-2.5 bg-slate-50 rounded animate-pulse w-3/4"></div>
              </div>
            </div>

            <!-- Draggable com cards e empty state via footer -->
            <draggable
              v-else
              v-model="col.orders.value"
              group="orders"
              item-key="id"
              class="space-y-2 min-h-[140px]"
              ghost-class="ghost"
            >
              <template #item="{ element }">
                <div
                  @click="openOrderDetails(element)"
                  :class="['kanban-card relative rounded-xl border hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing group overflow-hidden',
                           element.source === 'ECOMMERCE'
                             ? ['kanban-card--ecommerce', element.status === 'PENDING' && 'kanban-card--shake']
                             : (element.priority === 'URGENT'
                                ? 'bg-white border-[#A32D2D]/40 ring-2 ring-[#A32D2D]/10'
                                : 'bg-white border-slate-200 hover:border-slate-300')]">
                  <!-- Faixa URGENTE no topo — pra ecommerce vem com tag "LOJA"
                       extra à direita pra reforçar a origem. -->
                  <div v-if="element.priority === 'URGENT'"
                       class="px-3.5 py-1 flex items-center gap-1.5 text-[10px] font-medium"
                       style="background:#FCEBEB; color:#A32D2D">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 5.5L18.5 20H5.5L12 7.5zM11 11v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                    URGENTE
                    <span v-if="element.source === 'ECOMMERCE'" class="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider"
                          style="background:#1D9E75; color:#fff">
                      <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 21h18V8l-9-5-9 5v13zm9-2H5v-9.5l7-3.9 7 3.9V19h-7zM10 11h4v6h-4z"/></svg>
                      LOJA
                    </span>
                  </div>

                  <div class="px-3.5 py-3.5">
                    <!-- Topo: pill de status + valor -->
                    <div class="flex items-start justify-between mb-2 gap-2">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                              :style="{ background: accentFor(element.status).bg, color: accentFor(element.status).text }">
                          <span class="w-1 h-1 rounded-full" :style="{ background: accentFor(element.status).bar }"></span>
                          {{ accentFor(element.status).label }}
                        </span>
                        <!-- Origem do pedido (Loja, PDV, WhatsApp, IA) — só aparece pra origens não-ERP -->
                        <span v-if="element.source && element.source !== 'ERP'"
                              :class="['inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-medium', sourceBadgeClass(element.source)]"
                              :title="`Origem: ${element.source}`">
                          {{ sourceLabel(element.source) }}
                        </span>
                      </div>
                      <span class="text-sm font-medium shrink-0"
                            :style="{ color: element.status === 'FINISHED' || element.status === 'DELIVERED' ? '#1D9E75' : '#0F172A' }">
                        R$ {{ element.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
                      </span>
                    </div>

                    <!-- Pagamento + prazo -->
                    <div class="flex items-center gap-1.5 flex-wrap mb-2.5">
                      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                            :style="{ background: paymentInfo(element).bg, color: paymentInfo(element).color }">
                        <span class="w-1 h-1 rounded-full" :style="{ background: paymentInfo(element).color }"></span>
                        {{ paymentInfo(element).label }}
                      </span>
                      <span v-if="deliveryInfo(element.deliveryDate)"
                            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                            :style="{ background: deliveryInfo(element.deliveryDate)!.bg, color: deliveryInfo(element.deliveryDate)!.color }">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        {{ deliveryInfo(element.deliveryDate)!.label }}
                      </span>
                    </div>

                    <!-- ID + data de criação -->
                    <div class="flex items-center gap-1.5 text-[11px] text-slate-400 mb-2.5">
                      <span class="font-medium">#{{ element.id.toString().padStart(4, '0') }}</span>
                      <span>·</span>
                      <span>{{ formatRelativeDate(element.createdAt) }}</span>
                    </div>

                    <!-- Cliente: avatar + nome -->
                    <div class="flex items-center gap-2.5 mb-2">
                      <span class="w-7 h-7 rounded-full text-[10px] font-medium flex items-center justify-center shrink-0"
                            :style="{ background: avatarColorOf(element.customerName).bg, color: avatarColorOf(element.customerName).fg }">
                        {{ initialsOf(element.customerName) }}
                      </span>
                      <h4 class="text-sm font-medium text-slate-900 leading-tight truncate">{{ element.customerName }}</h4>
                    </div>

                    <!-- Descrição do produto -->
                    <p class="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">
                      {{ element.productDescription }}
                    </p>

                    <!-- ── Observação enviada pelo cliente final (ecommerce) ──
                         Visual distinto da nota do operador: fundo azul claro,
                         badge "Cliente", balão de mensagem. Read-only no kanban
                         (cliente edita pela tela do pedido na SPA). -->
                    <div v-if="element.details?.customerNotes"
                         class="mb-3 p-2 rounded-lg bg-blue-50 border border-blue-200">
                      <div class="flex items-start gap-1.5">
                        <svg class="w-3 h-3 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        <div class="min-w-0 flex-1">
                          <span class="inline-block text-[9px] font-bold text-blue-700 uppercase tracking-wider mb-0.5">Cliente</span>
                          <p class="text-[11px] text-blue-900 leading-snug whitespace-pre-wrap line-clamp-3">{{ element.details.customerNotes }}</p>
                        </div>
                      </div>
                    </div>

                    <!-- ── Nota livre do operador ────────────────────────── -->
                    <div v-if="editingNotesId === element.id"
                         class="mb-3 p-2 rounded-lg bg-slate-50 border border-slate-200"
                         @click.stop>
                      <textarea v-model="notesDraft"
                                rows="3"
                                placeholder="Anotações (medidas, arte, observações…)"
                                class="w-full text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-slate-400 resize-y"
                                maxlength="2000"></textarea>
                      <div class="flex justify-end gap-1 mt-1.5">
                        <button @click.stop="cancelEditNotes"
                                class="px-2 py-1 rounded-md text-[10px] text-slate-500 hover:bg-slate-100">
                          Cancelar
                        </button>
                        <button @click.stop="saveNotes(element)"
                                :disabled="savingNotes"
                                class="px-2.5 py-1 rounded-md text-[10px] font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50">
                          {{ savingNotes ? 'Salvando…' : 'Salvar' }}
                        </button>
                      </div>
                    </div>
                    <div v-else-if="element.notes"
                         class="mb-3 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                         @click.stop="startEditNotes(element)">
                      <div class="flex items-start gap-1.5">
                        <svg class="w-3 h-3 text-slate-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        <p class="text-[11px] text-slate-700 leading-snug whitespace-pre-wrap line-clamp-3">{{ element.notes }}</p>
                      </div>
                    </div>
                    <button v-else
                            @click.stop="startEditNotes(element)"
                            class="mb-3 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700 transition-colors">
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                      Adicionar nota
                    </button>

                    <!-- Thumbnail do anexo (primeira imagem) -->
                    <div v-if="firstImageThumb(element)" class="mb-3 relative rounded-lg overflow-hidden border border-slate-200">
                      <img :src="firstImageThumb(element)!" alt="Arte do cliente" class="w-full h-28 object-cover" @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')" />
                      <span v-if="(element.attachments || []).length > 1"
                            class="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/60 text-white">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        +{{ (element.attachments || []).length - 1 }}
                      </span>
                    </div>

                    <!-- Meta row: vendedor / produtor / anexos -->
                    <div v-if="element.salesperson || element.producer || (element.attachments && element.attachments.length > 0)"
                         class="flex items-center gap-1.5 pt-2.5 border-t border-slate-100 flex-wrap">
                      <span v-if="element.salesperson" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600" :title="`Vendedor: ${element.salesperson.name}`">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        {{ element.salesperson.name.split(' ')[0] }}
                      </span>
                      <span v-if="element.producer" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px]"
                            style="background:#FAEEDA; color:#92400E" :title="`Produtor: ${element.producer.name}`">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                        {{ element.producer.name.split(' ')[0] }}
                      </span>
                      <span v-if="element.attachments && element.attachments.length > 0"
                            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        {{ element.attachments.length }}
                      </span>
                    </div>

                    <input :id="'file-input-' + element.id" type="file" class="hidden" @change="handleFileUpload($event, element.id)" />

                    <!-- Action bar (aparece no hover) -->
                    <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <div class="flex items-center gap-1">
                        <button @click="togglePriority(element, $event)"
                                :class="['w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                                         element.priority === 'URGENT' ? 'text-[#A32D2D]' : 'text-slate-500 hover:text-[#A32D2D] hover:bg-[#FCEBEB]']"
                                :title="element.priority === 'URGENT' ? 'Remover urgência' : 'Marcar como urgente'">
                          <svg class="w-3.5 h-3.5" :fill="element.priority === 'URGENT' ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                          </svg>
                        </button>
                        <button @click.stop="triggerUpload(element.id)"
                                class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors" title="Anexar arquivo">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        </button>
                        <button @click.stop="openWhatsApp(element)"
                                class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 transition-colors hover:text-white"
                                style="--hover-bg:#1D9E75"
                                onmouseover="this.style.background='#1D9E75';this.style.color='#fff'"
                                onmouseout="this.style.background='';this.style.color=''"
                                title="Enviar WhatsApp">
                          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6z"/></svg>
                        </button>
                        <button v-if="!authStore.isOnlyProduction" @click.stop="startDeleteOrder(element.id)"
                                class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 transition-colors"
                                onmouseover="this.style.background='#FCEBEB';this.style.color='#A32D2D'"
                                onmouseout="this.style.background='';this.style.color=''"
                                title="Excluir">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <button v-if="element.status === 'PENDING'"
                                @click.stop="verifyPaymentDirectly(element.id)"
                                :disabled="verifyingOrderId === element.id"
                                class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-full px-2.5 py-1 transition-colors disabled:opacity-50">
                          <span v-if="verifyingOrderId === element.id" class="inline-block w-2.5 h-2.5 border border-slate-300 border-t-slate-900 rounded-full animate-spin"></span>
                          <svg v-else class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                          <span>Verificar</span>
                        </button>
                        <button @click.stop="confirmPix(element.id)"
                                class="inline-flex items-center gap-1 text-[11px] font-medium text-white rounded-full px-2.5 py-1 transition-colors"
                                style="background:#1D9E75"
                                onmouseover="this.style.background='#0F6E56'"
                                onmouseout="this.style.background='#1D9E75'">
                          <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 2.5c-1.14 0-2.229.45-3.036 1.257l-7.224 7.224A4.3 4.3 0 001.5 12c0 1.14.45 2.229 1.257 3.036l7.224 7.224a4.3 4.3 0 006.072 0l7.224-7.224A4.3 4.3 0 0024.5 12c0-1.14-.45-2.229-1.257-3.036l-7.224-7.224A4.3 4.3 0 0012.017 2.5z"/></svg>
                          Pix
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Empty state dentro do draggable (footer slot) — aceita drop -->
              <template #footer>
                <div v-if="col.orders.value.length === 0"
                     class="border border-dashed border-slate-200 rounded-lg py-8 px-3 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                  <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 8h16M4 16h16"/></svg>
                  Arraste pedidos para cá
                </div>
              </template>
            </draggable>
          </div>
        </div>
      </div>
    </div>
    <!-- Order Details Modal -->
    <div v-if="isModalOpen && selectedOrder" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50" @click="closeOrderDetails"></div>

      <div class="bg-white w-full max-w-6xl h-full max-h-[92vh] rounded-2xl border border-slate-200 relative z-10 overflow-hidden flex flex-col md:flex-row shadow-2xl">
        <button @click="closeOrderDetails" class="absolute top-4 right-4 z-20 w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <!-- Left Column: Details -->
        <div class="w-full md:w-[420px] border-r border-slate-100 flex flex-col h-full">
          <div class="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            <!-- ── Header — ID, data, origem, status, valor ───────────── -->
            <header class="space-y-3">
              <div class="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span>#{{ selectedOrder.id.toString().padStart(4, '0') }}</span>
                <span>·</span>
                <span>{{ new Date(selectedOrder.createdAt).toLocaleDateString('pt-BR') }}</span>
                <span v-if="selectedOrder.source && selectedOrder.source !== 'ERP'"
                      :class="['inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-medium', sourceBadgeClass(selectedOrder.source)]">
                  {{ sourceLabel(selectedOrder.source) }}
                </span>
              </div>
              <h2 class="text-lg font-medium text-slate-900 leading-tight">{{ selectedOrder.productDescription }}</h2>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                      :style="{ background: accentFor(selectedOrder.status).bg, color: accentFor(selectedOrder.status).text }">
                  <span class="w-1.5 h-1.5 rounded-full" :style="{ background: accentFor(selectedOrder.status).bar }"></span>
                  {{ accentFor(selectedOrder.status).label }}
                </span>
                <span class="text-base font-medium ml-auto"
                      :style="{ color: selectedOrder.status === 'FINISHED' || selectedOrder.status === 'DELIVERED' ? '#1D9E75' : '#0F172A' }">
                  R$ {{ selectedOrder.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
                </span>
              </div>
            </header>

            <!-- ── Observação do cliente final (ecommerce) ─────────────────
                 Aparece antes da nota do operador — é o que o cliente
                 escreveu na tela do pedido na SPA. Read-only aqui, cliente
                 edita pela `/pedido/:uuid/acompanhar`. Visual diferenciado
                 (azul) pra deixar claro a origem. -->
            <div v-if="selectedOrder.details?.customerNotes"
                 class="p-3 rounded-lg border border-blue-200 bg-blue-50">
              <div class="flex items-center gap-1.5 mb-1.5">
                <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                <span class="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Observação do cliente</span>
              </div>
              <p class="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">{{ selectedOrder.details.customerNotes }}</p>
            </div>

            <!-- ── Notas (destaque — primeira coisa logo após header) ──── -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs text-slate-500">Anotações internas</div>
                <button v-if="editingNotesId !== selectedOrder.id && selectedOrder.notes"
                        @click="startEditNotes(selectedOrder)"
                        class="text-[11px] text-slate-500 hover:text-slate-900 font-medium transition-colors">
                  Editar
                </button>
              </div>
              <div v-if="editingNotesId === selectedOrder.id"
                   class="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <textarea v-model="notesDraft"
                          rows="6"
                          placeholder="Medidas, observações de arte, decisões de produção…"
                          class="w-full text-sm bg-white border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-slate-400 resize-y leading-relaxed"
                          maxlength="2000"></textarea>
                <div class="flex items-center justify-between mt-2">
                  <span class="text-[10px] text-slate-400">{{ notesDraft.length }} / 2000</span>
                  <div class="flex gap-1.5">
                    <button @click="cancelEditNotes"
                            class="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-slate-100">
                      Cancelar
                    </button>
                    <button @click="saveNotes(selectedOrder)"
                            :disabled="savingNotes"
                            class="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50">
                      {{ savingNotes ? 'Salvando…' : 'Salvar' }}
                    </button>
                  </div>
                </div>
              </div>
              <button v-else-if="!selectedOrder.notes"
                      @click="startEditNotes(selectedOrder)"
                      class="w-full p-4 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-xs text-slate-400 hover:text-slate-700 flex items-center justify-center gap-2 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                Adicionar anotação
              </button>
              <div v-else
                   @click="startEditNotes(selectedOrder)"
                   class="p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{{ selectedOrder.notes }}</p>
              </div>
            </div>

            <!-- ── Cliente ─────────────────────────────────────────────── -->
            <div>
              <div class="text-xs text-slate-500 mb-2">Cliente</div>
              <div class="p-3 rounded-lg border border-slate-200">
                <div class="flex items-center gap-2.5">
                  <span class="w-8 h-8 rounded-full text-[11px] font-medium flex items-center justify-center shrink-0"
                        :style="{ background: avatarColorOf(selectedOrder.customerName).bg, color: avatarColorOf(selectedOrder.customerName).fg }">
                    {{ initialsOf(selectedOrder.customerName) }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-slate-900 truncate">{{ selectedOrder.customerName }}</div>
                    <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      {{ selectedOrder.customerPhone || 'Não informado' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── Equipe ──────────────────────────────────────────────── -->
            <div v-if="selectedOrder.salesperson || selectedOrder.producer">
              <div class="text-xs text-slate-500 mb-2">Equipe</div>
              <div class="p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-3">
                <div v-if="selectedOrder.salesperson" class="min-w-0">
                  <div class="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Vendedor</div>
                  <div class="text-sm text-slate-900 truncate">{{ selectedOrder.salesperson.name }}</div>
                </div>
                <div v-if="selectedOrder.producer" class="min-w-0">
                  <div class="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Produtor</div>
                  <div class="text-sm text-slate-900 truncate">{{ selectedOrder.producer.name }}</div>
                </div>
              </div>
            </div>

            <!-- ── Prazo e prioridade ───────────────────────────────────── -->
            <div>
              <div class="text-xs text-slate-500 mb-2">Prazo e prioridade</div>
              <div class="p-3 rounded-lg border border-slate-200 space-y-3">
                <div>
                  <label class="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Data de entrega</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="date"
                      :value="selectedOrder.deliveryDate ? selectedOrder.deliveryDate.slice(0, 10) : ''"
                      @change="saveDeliveryDate(selectedOrder, ($event.target as HTMLInputElement).value)"
                      class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"
                    />
                    <button
                      v-if="selectedOrder.deliveryDate"
                      @click="saveDeliveryDate(selectedOrder, '')"
                      class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                      title="Remover prazo"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div v-if="deliveryInfo(selectedOrder.deliveryDate)" class="mt-2">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                          :style="{ background: deliveryInfo(selectedOrder.deliveryDate)!.bg, color: deliveryInfo(selectedOrder.deliveryDate)!.color }">
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      {{ deliveryInfo(selectedOrder.deliveryDate)!.label }}
                    </span>
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div class="text-sm text-slate-800">Marcar como urgente</div>
                    <div class="text-[11px] text-slate-400">Destaca o card no Kanban</div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox"
                           :checked="selectedOrder.priority === 'URGENT'"
                           @change="togglePriority(selectedOrder, $event)"
                           class="sr-only peer" />
                    <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#A32D2D] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
              </div>
            </div>

            <!-- ── Recibo ──────────────────────────────────────────────── -->
            <div>
              <button
                @click="downloadReceipt(selectedOrder.id)"
                class="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-full transition-colors flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Gerar recibo (2 vias)
              </button>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs text-slate-500">Arquivos da arte</div>
                <button @click="triggerUpload(selectedOrder.id)" class="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors">+ Adicionar</button>
              </div>
              <div v-if="selectedOrder.attachments?.length" class="space-y-1.5">
                <div
                  v-for="file in selectedOrder.attachments"
                  :key="file.id"
                  class="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors group/fileli"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0">
                      <svg v-if="isImage(file.mimetype)" class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <svg v-else-if="isPDF(file.mimetype)" class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                      <svg v-else class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs text-slate-900 truncate">{{ file.originalName }}</div>
                      <div class="text-[10px] text-slate-400">{{ (file.size / 1024).toFixed(1) }} KB</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-0.5 opacity-0 group-hover/fileli:opacity-100 transition-opacity">
                    <button @click="downloadFile(file.filename)" class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    </button>
                    <button @click="deleteAttachment(file.id, selectedOrder.id)" class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="text-xs text-slate-400 p-6 border border-dashed border-slate-200 rounded-lg text-center">
                Sem arquivos anexados
              </div>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-slate-100">
            <button
              @click="openWhatsApp(selectedOrder)"
              class="w-full text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium py-2.5 rounded-full transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6z"/></svg>
              Falar no WhatsApp
            </button>
          </div>
        </div>

        <!-- Right Column: Preview -->
        <div class="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
          <div class="absolute inset-0 flex items-center justify-center p-8">
            <div v-if="!selectedOrder.attachments?.length" class="text-center space-y-3 max-w-xs">
              <div class="w-12 h-12 bg-white border border-slate-200 rounded-lg mx-auto flex items-center justify-center">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <h3 class="text-sm font-medium text-slate-900">Aguardando arte</h3>
              <p class="text-xs text-slate-500">Anexe um arquivo para visualizar o preview.</p>
              <button @click="triggerUpload(selectedOrder.id)" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-full transition-colors">Upload da arte</button>
            </div>

            <div v-else class="w-full h-full flex flex-col items-center justify-center">
              <div class="w-full h-full bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div class="h-11 border-b border-slate-100 flex items-center justify-between px-4 shrink-0">
                  <span class="text-xs text-slate-500 truncate">{{ selectedOrder.attachments[0].originalName }}</span>
                  <button @click="downloadFile(selectedOrder.attachments[0].filename)" class="text-xs font-medium text-slate-900 hover:underline shrink-0 ml-3">Baixar</button>
                </div>
                <div class="flex-1 overflow-auto bg-slate-50 flex items-center justify-center p-4">
                  <img
                    v-if="isImage(selectedOrder.attachments[0].mimetype)"
                    :src="getPreviewUrl(selectedOrder.attachments[0].filename)"
                    class="max-w-full max-h-full object-contain rounded"
                  />
                  <iframe
                    v-else-if="isPDF(selectedOrder.attachments[0].mimetype)"
                    :src="getPreviewUrl(selectedOrder.attachments[0].filename)"
                    class="w-full h-full rounded"
                    frameborder="0"
                  ></iframe>
                  <div v-else class="text-center space-y-2">
                    <div class="w-16 h-16 bg-white border border-slate-200 rounded-lg flex items-center justify-center mx-auto">
                      <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                    </div>
                    <div class="text-sm font-medium text-slate-900">Preview não disponível</div>
                    <div class="text-xs text-slate-500">Arquivos deste tipo precisam ser baixados.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <PaymentModal 
      :url="paymentUrl" 
      :qr-code="pixQrCode"
      :qr-code-base64="pixQrCodeBase64"
      :amount="paymentAmount"
      :transaction-id="currentTransactionId || undefined"
      :is-open="isPaymentModalOpen" 
      @close="isPaymentModalOpen = false" 
      @paid="triggerToast('Pagamento confirmado com sucesso!')"
    />

    <!-- Toast Overlay -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showToast" class="fixed top-5 left-1/2 -translate-x-1/2 px-4 py-2.5 bg-slate-900 text-white text-sm rounded-full flex items-center gap-2 z-[150]">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        {{ toastMessage }}
      </div>
    </Transition>

    <!-- Confirmation Modal Pix -->
    <div v-if="isConfirmingPix" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="isConfirmingPix = false"></div>
      <div class="bg-white w-full max-w-sm p-6 rounded-2xl border border-slate-200 relative z-10 text-center">
        <div class="w-11 h-11 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7"/></svg>
        </div>
        <h3 class="text-base font-medium text-slate-900 mb-2">Gerar pagamento Pix?</h3>
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">Isso cria uma nova transação no Mercado Pago para este pedido.</p>
        <div class="flex gap-2">
          <button @click="isConfirmingPix = false" class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancelar</button>
          <button @click="generatePix(orderToPay!)" class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors">Gerar Pix</button>
        </div>
      </div>
    </div>

    <!-- Payment Error Modal -->
    <PaymentErrorModal :show="isErrorModalOpen" @close="isErrorModalOpen = false" />

    <!-- Stock Warning Modal -->
    <div v-if="showStockWarningModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="showStockWarningModal = false"></div>
      <div class="bg-white w-full max-w-sm p-6 rounded-2xl border border-slate-200 relative z-10 text-center">
        <div class="w-11 h-11 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h3 class="text-base font-medium text-slate-900 mb-2">Atenção ao estoque</h3>
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">
          O estoque dos insumos vinculados a este pedido foi <span class="text-slate-900 font-medium">atualizado automaticamente</span>.
        </p>
        <button
          @click="showStockWarningModal = false"
          class="w-full py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
        >
          Entendi
        </button>
      </div>
    </div>

    <!-- Confirmation Modal Delete Order -->
    <div v-if="isConfirmingDelete" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="isConfirmingDelete = false"></div>
      <div class="bg-white w-full max-w-sm p-6 rounded-2xl border border-slate-200 relative z-10 text-center">
        <div class="w-11 h-11 bg-red-50 text-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
        <h3 class="text-base font-medium text-slate-900 mb-2">Excluir pedido?</h3>
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">Esta ação não pode ser desfeita e removerá todos os arquivos vinculados.</p>
        <div class="flex gap-2">
          <button @click="isConfirmingDelete = false" class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Manter</button>
          <button @click="confirmDeleteOrder" class="flex-1 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">Excluir</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
.ghost { opacity: 0.4; background: #f1f5f9; border: 1px dashed #cbd5e1; }

@keyframes prod-float {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(20px, -30px); }
}
.prod-float { animation: prod-float 14s ease-in-out infinite; }

@keyframes prod-float-slow {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-25px, 20px); }
}
.prod-float-slow { animation: prod-float-slow 18s ease-in-out infinite; }

@keyframes prod-float-slower {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(15px, -15px); }
}
.prod-float-slower { animation: prod-float-slower 22s ease-in-out infinite; }

/* ─── Card de pedido vindo do ECOMMERCE ─────────────────────────────────
   Fundo verde quase imperceptível (mais claro que emerald-50) + borda
   bem suave. A ideia é "tingir" o card sem chamar atenção excessiva — a
   distinção fica clara em comparação aos cards brancos do PDV/ERP, sem
   poluir a tela quando a coluna está cheia. */
.kanban-card--ecommerce {
  background: #F4FDF8;          /* verde quase branco — entre o paper e o emerald-50 */
  border-color: #D1FAE5;
}
.kanban-card--ecommerce:hover {
  background: #ECFDF5;          /* sobe um tom no hover pra feedback */
  border-color: #A7F3D0;
}

/* Animação "balançar urgente" vertical — cima/baixo rítmico, simulando
   uma chamada visual ("preciso de atenção"). Só pra ecommerce em PENDING.
   Movimento puramente vertical (sem rotação) — fica mais clean e não
   "torce" o conteúdo do card. Sequência: sobe forte → desce levemente →
   sobe de novo → repousa. Pausa longa no fim do ciclo pra descansar. */
@keyframes kanban-bounce {
  0%   { transform: translateY(0); }
  15%  { transform: translateY(-4px); }
  30%  { transform: translateY(0); }
  45%  { transform: translateY(-4px); }
  60%  { transform: translateY(0); }
  100% { transform: translateY(0); }   /* repouso até o próximo ciclo */
}
.kanban-card--shake {
  animation: kanban-bounce 2.6s ease-in-out infinite;
}
.kanban-card--shake:hover {
  animation-play-state: paused;        /* não atrapalha leitura no hover */
}
/* Respeita preferência de redução de movimento (acessibilidade) */
@media (prefers-reduced-motion: reduce) {
  .kanban-card--shake { animation: none; }
}
</style>
