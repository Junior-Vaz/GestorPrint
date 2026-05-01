import { apiFetch } from '../utils/api'
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { usePlanStore } from '../stores/plan'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Product { id: number; name: string; unitPrice: number; unit: string; markup: number; productType?: { name: string; color: string; hasStock: boolean; applicableEstimateTypes?: string[] } }
export interface Customer { id: number; name: string; phone?: string | null }
export interface EstimateRecord { id: number; estimateType?: string; customerId: number; customer: { name: string; phone?: string | null }; salesperson?: { id: number; name: string } | null; status: string; totalPrice: number; details: any; createdAt: string }
export interface Attachment { id: number; originalName: string; filename: string; size: number }
export interface ProductGroup { name: string; color: string; products: Product[] }

export type EstimateCalculatorType = 'service' | 'plotter' | 'cutting' | 'embroidery'

export function useEstimateBase(calculatorType?: EstimateCalculatorType) {
  const auth = useAuthStore()
  const { showToast } = useToast()
  const { confirm: confirmDialog } = useConfirm()

  // ── Data ───────────────────────────────────────────────────────────────────────
  const estimates   = ref<EstimateRecord[]>([])
  const products    = ref<Product[]>([])
  const customers   = ref<Customer[]>([])
  const dataLoading = ref(true)
  const listLoading = ref(true)
  const saving      = ref(false)
  const showForm    = ref(false)
  const editingId   = ref<number | null>(null)

  // ── Form state ────────────────────────────────────────────────────────────────
  const form = reactive({
    customerId:       null as number | null,
    customerSearch:   '',
    showCustomerDrop: false,
    productName:      '',
    discount:         0,
    discountType:     'percent' as 'percent' | 'fixed',
    quantity:         1,
  })

  // ── Anexos ─────────────────────────────────────────────────────────────────────
  const attachments   = ref<Attachment[]>([])
  const uploadingFile = ref(false)
  const fileInputRef  = ref<HTMLInputElement | null>(null)

  const handleAttachmentUpload = async (e: Event) => {
    if (!editingId.value) return
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    uploadingFile.value = true
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await apiFetch(`/api/files/upload-estimate/${editingId.value}`, { method: 'POST', body: fd })
      if (res.ok) attachments.value.unshift(await res.json())
      else showToast('Erro ao enviar arquivo.', 'error')
    } finally {
      uploadingFile.value = false
      ;(e.target as HTMLInputElement).value = ''
    }
  }

  const downloadAttachment = (filename: string) => {
    const t = localStorage.getItem('gp_token') || ''
    window.open(`/api/files/${filename}?token=${t}`, '_blank')
  }

  const removeAttachment = async (id: number) => {
    const res = await apiFetch(`/api/files/${id}`, { method: 'DELETE' })
    if (res.ok) attachments.value = attachments.value.filter(a => a.id !== id)
  }

  const fetchAttachments = async (estimateId: number) => {
    const res = await apiFetch(`/api/files/estimate/${estimateId}`)
    if (res.ok) attachments.value = await res.json()
  }

  const fmtSize = (bytes: number) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  // ── Products grouped by category ──────────────────────────────────────────────
  const productSearch = ref('')

  const productsByCategory = computed((): ProductGroup[] => {
    const q = productSearch.value.toLowerCase().trim()
    const map = new Map<string, ProductGroup>()
    for (const p of products.value) {
      if (q && !p.name.toLowerCase().includes(q)) continue
      // Filtro por tipo de calculadora — semântica do schema:
      // applicableEstimateTypes === []  → produto aparece em TODAS as calculadoras
      // applicableEstimateTypes !== []  → produto aparece só nas calculadoras listadas
      if (calculatorType) {
        const types = p.productType?.applicableEstimateTypes ?? []
        if (types.length > 0 && !types.includes(calculatorType)) continue
      }
      const key   = p.productType?.name ?? 'Sem Categoria'
      const color = p.productType?.color ?? '#94a3b8'
      if (!map.has(key)) map.set(key, { name: key, color, products: [] })
      map.get(key)!.products.push(p)
    }
    return Array.from(map.values())
  })

  // ── Customer helpers ──────────────────────────────────────────────────────────
  const filteredCustomers = computed(() => {
    const q = form.customerSearch.toLowerCase().trim()
    return q ? customers.value.filter(c => c.name.toLowerCase().includes(q)) : customers.value
  })

  const selectCustomer = (c: Customer) => {
    form.customerId = c.id
    form.customerSearch = c.name
    form.showCustomerDrop = false
  }

  const handleCustomerBlur = () => setTimeout(() => { form.showCustomerDrop = false }, 150)

  // watch on form.customerSearch — each view must set this up or we do it here
  // We expose a helper so views can call it; but the watch itself is defined here
  // NOTE: we cannot use watch() at top-level without being inside setup(), so
  // views must call watchCustomerSearch() once after calling useEstimateBase().
  // Alternatively we define it as a function:
  const onCustomerSearchChange = (val: string) => {
    const cur = customers.value.find(c => c.id === form.customerId)
    if (cur && cur.name !== val) form.customerId = null
  }

  // ── Base reset (common fields only) ──────────────────────────────────────────
  const resetFormBase = () => {
    editingId.value = null
    productSearch.value = ''
    attachments.value = []
    form.customerId = null
    form.customerSearch = ''
    form.productName = ''
    form.discount = 0
    form.discountType = 'percent'
    form.quantity = 1
    const fallback = customers.value.find(c => c.name.toLowerCase().includes('balcão'))
    if (fallback) { form.customerId = fallback.id; form.customerSearch = fallback.name }
    else if (customers.value.length > 0) { form.customerId = customers.value[0]!.id; form.customerSearch = customers.value[0]!.name }
  }

  // ── Base load editing (common fields only) ────────────────────────────────────
  const loadEditingBase = (est: EstimateRecord) => {
    editingId.value = est.id
    showForm.value = true
    const d = est.details
    form.customerId = est.customerId
    form.customerSearch = est.customer.name
    form.productName = d.productName || ''
    form.discount = d.discount || 0
    form.discountType = d.discountType || 'percent'
    form.quantity = d.quantity || 1
    attachments.value = []
    fetchAttachments(est.id)
  }

  // ── API calls ─────────────────────────────────────────────────────────────────
  const fetchEstimates = async (type: string) => {
    listLoading.value = true
    try {
      const res = await apiFetch(`/api/estimates?type=${type}&page=1&limit=500`)
      if (res.ok) {
        const raw = await res.json()
        estimates.value = Array.isArray(raw) ? raw : (raw?.data ?? [])
      }
    } finally { listLoading.value = false }
  }

  const fetchInitialData = async (resetFn?: () => void) => {
    dataLoading.value = true
    try {
      const [pRes, cRes] = await Promise.all([
        apiFetch('/api/products?page=1&limit=500'),
        apiFetch('/api/customers?page=1&limit=500'),
      ])
      if (pRes.ok) {
        const raw = await pRes.json()
        products.value = Array.isArray(raw) ? raw : (raw?.data ?? [])
      }
      if (cRes.ok) {
        const raw = await cRes.json()
        customers.value = Array.isArray(raw) ? raw : (raw?.data ?? [])
        resetFn?.()
      }
    } finally { dataLoading.value = false }
  }

  const saveEstimate = async (
    type: string,
    totalPrice: number,
    buildDetails: () => any,
    afterSave?: (estimateId: number) => Promise<void> | void,
  ) => {
    if (!form.customerId) { showToast('Selecione um cliente.', 'warning'); return }
    if (!form.productName) { showToast('Informe o nome do produto/serviço.', 'warning'); return }
    saving.value = true
    try {
      const body = {
        customerId: form.customerId,
        estimateType: type,
        totalPrice,
        salespersonId: auth.user?.id,
        details: buildDetails(),
      }
      const url = editingId.value ? `/api/estimates/${editingId.value}` : '/api/estimates'
      const method = editingId.value ? 'PATCH' : 'POST'
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        const saved = await res.json().catch(() => null)
        const savedId = saved?.id ?? editingId.value ?? null
        if (afterSave && savedId) {
          try { await afterSave(savedId) } catch (e) { console.error('afterSave failed', e) }
        }
        showToast(editingId.value ? 'Orçamento atualizado!' : 'Orçamento salvo!', 'success')
        showForm.value = false
        resetFormBase()
        await fetchEstimates(type)
      }
    } catch (e) { console.error(e) } finally { saving.value = false }
  }

  const openNew = (resetFn: () => void) => { resetFn(); showForm.value = true }

  const openPdf = (id: number) => {
    // Gate de feature — backend tb gateia mas evita o request inútil
    const plan = usePlanStore()
    if (!plan.hasPdf) {
      plan.setLimitError('Geração de PDF não disponível no plano atual.')
      return
    }
    const t = localStorage.getItem('gp_token') || ''
    window.open(`/api/estimates/${id}/pdf?token=${t}`, '_blank')
  }

  // ── Modal de aprovação (substitui window.prompt/confirm nativos) ───────────
  const approveTarget = ref<{ id: number; type: string } | null>(null)
  const approveDate = ref('')
  const approvePriority = ref<'NORMAL' | 'URGENT'>('NORMAL')
  const approving = ref(false)

  /**
   * Abre o modal de aprovação. Opcionalmente aceita opts pra pular o modal e
   * aprovar direto (usado pela EstimatesListView que já tem modal próprio).
   */
  const convertToOrder = async (
    id: number,
    type: string,
    opts?: { deliveryDate?: string | null; priority?: 'NORMAL' | 'URGENT' },
  ) => {
    if (opts) {
      // Aprovação direta (pulando modal) — caller já coletou os dados
      const res = await apiFetch(`/api/estimates/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryDate: opts.deliveryDate ?? null, priority: opts.priority ?? 'NORMAL' }),
      })
      if (res.ok) { showToast('Pedido enviado para produção!', 'success'); await fetchEstimates(type) }
      else showToast('Erro ao aprovar orçamento.', 'error')
      return
    }
    // Abre o modal de aprovação no caller
    approveTarget.value = { id, type }
    approveDate.value = ''
    approvePriority.value = 'NORMAL'
  }

  /** Confirma o modal de aprovação aberto via convertToOrder() */
  const confirmApprove = async () => {
    if (!approveTarget.value) return
    approving.value = true
    try {
      const { id, type } = approveTarget.value
      const res = await apiFetch(`/api/estimates/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: approveDate.value || null,
          priority: approvePriority.value,
        }),
      })
      if (res.ok) {
        showToast('Pedido enviado para produção!', 'success')
        approveTarget.value = null
        await fetchEstimates(type)
      } else {
        showToast('Erro ao aprovar orçamento.', 'error')
      }
    } finally {
      approving.value = false
    }
  }

  const cancelApprove = () => { approveTarget.value = null }

  const deleteEstimate = async (id: number, type: string) => {
    if (!await confirmDialog('Excluir este orçamento?', { title: 'Excluir orçamento' })) return
    const res = await apiFetch(`/api/estimates/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchEstimates(type)
  }

  const sendViaWhatsApp = async (est: EstimateRecord) => {
    try {
      const res = await apiFetch(`/api/estimates/${est.id}/payment`, { method: 'POST' })
      const payment = await res.json()
      const d = est.details
      const product = d.productName || d.materialName || 'Serviço'
      const qty = d.quantity || 1
      const msg = `Olá *${est.customer.name}*!\n\nSegue seu orçamento *#ORC-${est.id}*:\n📦 *${product}* × ${qty}un\n💰 *Total: R$ ${est.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\nPagamento via Pix/Link:\n${payment.paymentUrl || ''}\n\nFicamos no aguardo! 😊`
      const phone = est.customer.phone?.replace(/\D/g, '') || ''
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank')
      fetchEstimates(est.estimateType || '')
    } catch { showToast('Erro ao gerar link de pagamento.', 'error') }
  }

  // ── Display helpers ───────────────────────────────────────────────────────────
  const productSummary = (est: EstimateRecord) => {
    const d = est.details
    const name = d.productName || d.materialName || '—'
    const qty  = d.quantity ? `${d.quantity}un` : ''
    const dims = (d.width && d.height) ? `${d.width}×${d.height}cm` : ''
    return { name, sub: [qty, dims].filter(Boolean).join(' • ') }
  }

  const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return {
    estimates, products, customers, dataLoading, listLoading, saving, showForm, editingId,
    form, attachments, uploadingFile, fileInputRef,
    handleAttachmentUpload, downloadAttachment, removeAttachment, fetchAttachments, fmtSize,
    productSearch, productsByCategory, filteredCustomers, selectCustomer, handleCustomerBlur,
    onCustomerSearchChange,
    fetchEstimates, fetchInitialData, saveEstimate, openNew, openPdf, convertToOrder, deleteEstimate, sendViaWhatsApp,
    productSummary, fmtCurrency, resetFormBase, loadEditingBase,
    // Modal de aprovação
    approveTarget, approveDate, approvePriority, approving, confirmApprove, cancelApprove,
  }
}
