import { apiFetch } from '../utils/api'
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Product { id: number; name: string; unitPrice: number; unit: string; markup: number; productType?: { name: string; color: string; hasStock: boolean } }
export interface Customer { id: number; name: string; phone?: string | null }
export interface EstimateRecord { id: number; estimateType?: string; customerId: number; customer: { name: string; phone?: string | null }; salesperson?: { id: number; name: string } | null; status: string; totalPrice: number; details: any; createdAt: string }
export interface Attachment { id: number; originalName: string; filename: string; size: number }
export interface ProductGroup { name: string; color: string; products: Product[] }

export function useEstimateBase() {
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
      const res = await apiFetch(`/api/estimates?type=${type}`)
      if (res.ok) estimates.value = await res.json()
    } finally { listLoading.value = false }
  }

  const fetchInitialData = async (resetFn?: () => void) => {
    dataLoading.value = true
    try {
      const [pRes, cRes] = await Promise.all([apiFetch('/api/products'), apiFetch('/api/customers')])
      if (pRes.ok) products.value = await pRes.json()
      if (cRes.ok) { customers.value = await cRes.json(); resetFn?.() }
    } finally { dataLoading.value = false }
  }

  const saveEstimate = async (type: string, totalPrice: number, buildDetails: () => any) => {
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
        showToast(editingId.value ? 'Orçamento atualizado!' : 'Orçamento salvo!', 'success')
        showForm.value = false
        resetFormBase()
        await fetchEstimates(type)
      }
    } catch (e) { console.error(e) } finally { saving.value = false }
  }

  const openNew = (resetFn: () => void) => { resetFn(); showForm.value = true }

  const openPdf = (id: number) => { const t = localStorage.getItem('gp_token') || ''; window.open(`/api/estimates/${id}/pdf?token=${t}`, '_blank') }

  const convertToOrder = async (id: number, type: string) => {
    if (!await confirmDialog('Deseja aprovar este orçamento e enviar para a produção?', { title: 'Aprovar', confirmLabel: 'Aprovar', danger: false })) return
    const res = await apiFetch(`/api/estimates/${id}/convert`, { method: 'POST' })
    if (res.ok) { showToast('Pedido enviado para produção!', 'success'); await fetchEstimates(type) }
  }

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
  }
}
