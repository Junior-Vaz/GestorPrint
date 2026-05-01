<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { fileToCompressedDataUrl } from '../utils/image'
import { ref, onMounted, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useAuthStore } from '../stores/auth'
import { usePermissionsStore } from '../stores/permissions'
import { usePlanStore } from '../stores/plan'
import { useConfirm } from '../composables/useConfirm'
import PaginationControls from '../components/shared/PaginationControls.vue'

const auth = useAuthStore()
const perms = usePermissionsStore()
const plan = usePlanStore()
const { confirm: confirmDialog } = useConfirm()

// loyaltyConfigEnabled: cache do toggle "Programa ativo" do tenant. Se o admin
// desligou o programa em ERP → Fidelidade, a aba some mesmo com plano que
// libera a feature. Carregado uma vez no mount (depois disso só refresh).
const loyaltyConfigEnabled = ref<boolean | null>(null)

async function checkLoyaltyEnabled() {
  if (!plan.hasLoyalty || !perms.can.view('loyalty')) return
  const res = await apiFetch('/api/loyalty/config', { silentOn403: true })
  if (res.ok) {
    const cfg = await res.json()
    loyaltyConfigEnabled.value = cfg.enabled === true
  } else {
    loyaltyConfigEnabled.value = false
  }
}

// Aba Fidelidade só aparece se: feature liberada pelo plano + permissão RBAC
// `loyalty.view` + tenant ATIVOU o programa. Quando qualquer um desses for
// false, a aba não renderiza E o load de dados é pulado — economiza request HTTP.
const canSeeLoyalty = () =>
  plan.hasLoyalty
  && perms.can.view('loyalty')
  && loyaltyConfigEnabled.value === true

const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  zipCode: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  photoUrl: string | null;
  birthDate: string | null;   // ISO datetime do backend
  notes: string | null;
  createdAt: string;
}

const customers = ref<Customer[]>([])
const loading = ref(true)
const showModal = ref(false)
const activeTab = ref<'basic' | 'address' | 'extra' | 'loyalty'>('basic')

// ── Fidelidade (carregado lazy quando abre modal de edição) ────────────────
interface LoyaltyTier { name: string; minSpend: number; discount: number; pointsMultiplier: number }
interface LoyaltyTx {
  id: number; type: string; points: number; cashback: number;
  reason: string | null; createdAt: string; expiresAt: string | null;
}
interface LoyaltySummary {
  loyaltyPoints: number;
  loyaltyBalance: number;
  loyaltyTier: string | null;
  loyaltySpend12m: number;
  referralCode: string | null;
  pointsValue: number;       // pontos × realsPerPoint, calculado pelo backend
  tierConfig: LoyaltyTier | null;
}
const loyaltySummary = ref<LoyaltySummary | null>(null)
const loyaltyTransactions = ref<LoyaltyTx[]>([])
const loyaltyLoading = ref(false)
const adjustForm = ref({ points: 0, cashback: 0, reason: '' })
const showAdjustForm = ref(false)

async function loadLoyalty(customerId: number) {
  if (!canSeeLoyalty()) return
  loyaltyLoading.value = true
  loyaltySummary.value = null
  loyaltyTransactions.value = []
  try {
    const [sumRes, txRes] = await Promise.all([
      apiFetch(`/api/loyalty/customers/${customerId}/summary`, { silentOn403: true }),
      apiFetch(`/api/loyalty/customers/${customerId}/transactions?pageSize=20`, { silentOn403: true }),
    ])
    if (sumRes.ok) loyaltySummary.value = await sumRes.json()
    if (txRes.ok) {
      const data = await txRes.json()
      loyaltyTransactions.value = data.items || []
    }
  } finally {
    loyaltyLoading.value = false
  }
}

async function generateReferralCode() {
  if (!editingId.value) return
  const res = await apiFetch(`/api/loyalty/customers/${editingId.value}/referral-code`, { method: 'POST' })
  if (res.ok) {
    const data = await res.json()
    if (loyaltySummary.value) loyaltySummary.value.referralCode = data.code
  }
}

async function copyReferral() {
  if (!loyaltySummary.value?.referralCode) return
  try { await navigator.clipboard.writeText(loyaltySummary.value.referralCode) } catch {/* */}
}

async function submitAdjust() {
  if (!editingId.value || !adjustForm.value.reason.trim()) return
  const res = await apiFetch(`/api/loyalty/customers/${editingId.value}/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      points: Number(adjustForm.value.points) || 0,
      cashback: Number(adjustForm.value.cashback) || 0,
      reason: adjustForm.value.reason.trim(),
    }),
  })
  if (res.ok) {
    adjustForm.value = { points: 0, cashback: 0, reason: '' }
    showAdjustForm.value = false
    await loadLoyalty(editingId.value)   // refresh saldo + extrato
  } else {
    const err = await res.json().catch(() => ({}))
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: err.message || 'Erro ao ajustar saldo' } }))
  }
}

// Formatação BR de moeda — reusada na aba de fidelidade
function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Label legível do tipo de transação
function txTypeLabel(type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    EARN:     { label: 'Ganho',       color: 'text-emerald-700 bg-emerald-50' },
    REDEEM:   { label: 'Resgate',     color: 'text-rose-700 bg-rose-50' },
    EXPIRE:   { label: 'Expirado',    color: 'text-slate-500 bg-slate-100' },
    BONUS:    { label: 'Bônus',       color: 'text-violet-700 bg-violet-50' },
    REFERRAL: { label: 'Indicação',   color: 'text-blue-700 bg-blue-50' },
    ADJUST:   { label: 'Ajuste',      color: 'text-amber-700 bg-amber-50' },
  }
  return map[type] || { label: type, color: 'text-slate-600 bg-slate-50' }
}

// Cores do tier — também usadas no badge
function tierColor(name: string | null | undefined): string {
  switch ((name || '').toUpperCase()) {
    case 'BRONZE':   return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'SILVER':   return 'bg-slate-200 text-slate-800 border-slate-300'
    case 'GOLD':     return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'PLATINUM': return 'bg-violet-100 text-violet-800 border-violet-300'
    default:         return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

// Lista de tabs visíveis — Fidelidade só aparece em modo edit + feature liberada.
// Computed pra reagir ao plan.hasLoyalty carregar depois do mount inicial.
const tabsList = computed(() => {
  const base = [
    { id: 'basic',   label: 'Dados básicos' },
    { id: 'address', label: 'Endereço' },
    { id: 'extra',   label: 'Outros' },
  ]
  if (isEditing.value && canSeeLoyalty()) {
    base.push({ id: 'loyalty', label: 'Fidelidade' })
  }
  return base
})

const emptyForm = () => ({
  name: '',
  email: '',
  phone: '',
  document: '',
  zipCode: '',
  address: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  photoUrl: '',
  birthDate: '',          // formato YYYY-MM-DD pro <input type="date">
  notes: '',
})
const newCustomer = ref(emptyForm())

const isEditing = ref(false)
const editingId = ref<number | null>(null)

const openModal = (customer?: Customer) => {
  activeTab.value = 'basic'
  if (customer) {
    isEditing.value = true
    editingId.value = customer.id
    newCustomer.value = {
      name:         customer.name,
      email:        customer.email        || '',
      phone:        formatPhone(customer.phone || ''),
      document:     formatDocument(customer.document || ''),
      zipCode:      formatCep(customer.zipCode || ''),
      address:      customer.address      || '',
      number:       customer.number       || '',
      complement:   customer.complement   || '',
      neighborhood: customer.neighborhood || '',
      city:         customer.city         || '',
      state:        customer.state        || '',
      photoUrl:     customer.photoUrl     || '',
      birthDate:    customer.birthDate ? customer.birthDate.slice(0, 10) : '',
      notes:        customer.notes        || '',
    }
  } else {
    isEditing.value = false
    editingId.value = null
    newCustomer.value = emptyForm()
  }
  // Reset estado de fidelidade — só carrega quando abrindo edit (cliente
  // existente). Cliente novo não tem saldo ainda.
  loyaltySummary.value = null
  loyaltyTransactions.value = []
  showAdjustForm.value = false
  if (customer && customer.id) loadLoyalty(customer.id)
  showModal.value = true
}

// ── Máscaras visuais (só pra exibição — backend normaliza pra dígitos) ─────
function formatPhone(raw: string): string {
  const d = String(raw || '').replace(/\D+/g, '').slice(0, 11)
  if (d.length <= 2)  return d
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function formatDocument(raw: string): string {
  const d = String(raw || '').replace(/\D+/g, '').slice(0, 14)
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    if (d.length <= 3)  return d
    if (d.length <= 6)  return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9)  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  // CNPJ: 00.000.000/0000-00
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatCep(raw: string): string {
  const d = String(raw || '').replace(/\D+/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function onPhoneInput(e: Event)    { newCustomer.value.phone    = formatPhone((e.target as HTMLInputElement).value) }
function onDocumentInput(e: Event) { newCustomer.value.document = formatDocument((e.target as HTMLInputElement).value) }
function onCepInput(e: Event)      { newCustomer.value.zipCode  = formatCep((e.target as HTMLInputElement).value) }

// ── Lookup de CEP via ViaCEP (gratuito, sem auth) ──────────────────────────
const cepLoading = ref(false)
const cepError   = ref('')
async function lookupCep() {
  cepError.value = ''
  const cep = newCustomer.value.zipCode.replace(/\D+/g, '')
  if (cep.length !== 8) return
  cepLoading.value = true
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    const data = await res.json()
    if (data?.erro) { cepError.value = 'CEP não encontrado'; return }
    // Só sobrescreve campos vazios — preserva edição manual em retorno
    if (!newCustomer.value.address)      newCustomer.value.address      = data.logradouro || ''
    if (!newCustomer.value.neighborhood) newCustomer.value.neighborhood = data.bairro     || ''
    if (!newCustomer.value.city)         newCustomer.value.city         = data.localidade || ''
    if (!newCustomer.value.state)        newCustomer.value.state        = data.uf         || ''
  } catch {
    cepError.value = 'Falha ao buscar CEP'
  } finally {
    cepLoading.value = false
  }
}

// ── Upload de foto/avatar ──────────────────────────────────────────────────
const photoUploading = ref(false)
const photoFileInput = ref<HTMLInputElement | null>(null)
function pickPhoto() { photoFileInput.value?.click() }

async function onPhotoSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!/^image\//.test(file.type)) {
    alert('Selecione uma imagem (jpg, png, webp).')
    input.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('Foto muito grande. Limite: 10 MB.')
    input.value = ''
    return
  }
  photoUploading.value = true
  try {
    // Comprime/redimensiona pra 512x512 JPEG (~20-50KB) antes de virar
    // data URL — evita PayloadTooLarge e reduz peso da request.
    newCustomer.value.photoUrl = await fileToCompressedDataUrl(file, { maxSize: 512, quality: 0.85 })
  } catch (err: any) {
    alert(err?.message || 'Falha ao processar a imagem.')
  } finally {
    photoUploading.value = false
    input.value = ''
  }
}

function removePhoto() { newCustomer.value.photoUrl = '' }

const fetchCustomers = async () => {
  // Defesa em camadas: sidebar já oculta a tela quando user não tem permissão,
  // mas se admin revogar com sessão ativa, evita 403 + popup. silentOn403 é
  // fallback caso a matriz mude entre o load e a chamada.
  if (!perms.can.view('customers')) return
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
    if (search.value) params.set('search', search.value)
    const res = await apiFetch(`/api/customers?${params}`, { silentOn403: true })
    if (!res.ok) return
    const result = await res.json()
    if (Array.isArray(result)) {
      customers.value = result; total.value = result.length; totalPages.value = 1
    } else {
      customers.value = result.data; total.value = result.total; totalPages.value = result.totalPages
    }
  } catch (e) {
    console.error('Error fetching customers', e)
  } finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; fetchCustomers() }, 300)
watch(search, debouncedSearch)
watch([page, limit], fetchCustomers)

const handleSave = async () => {
  if (!newCustomer.value.name) return;

  try {
    const method = isEditing.value ? 'PATCH' : 'POST'
    const url = isEditing.value
      ? `/api/customers/${editingId.value}`
      : '/api/customers'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCustomer.value)
    })

    if (res.ok) {
      showModal.value = false;
      newCustomer.value = emptyForm();
      await fetchCustomers();
    }
  } catch (e) {
    console.error('Error saving customer', e)
  }
}

const deleteCustomer = async (id: number) => {
  if (!await confirmDialog('Tem certeza que deseja excluir este cliente? Isso pode afetar orçamentos e pedidos vinculados.', { title: 'Excluir cliente' })) return
  try {
    const res = await apiFetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchCustomers()
  } catch (e) {
    console.error('Error deleting customer', e)
  }
}

onMounted(async () => {
  await fetchCustomers()
  // Garante que o plano está carregado antes de checar a feature de fidelidade
  if (!plan.data) await plan.load()
  await checkLoyaltyEnabled()
})
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header + CTA -->
      <div class="flex items-center justify-between mb-6 gap-4">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Clientes</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="total > 0">{{ total }} {{ total === 1 ? 'cliente cadastrado' : 'clientes cadastrados' }}</span>
            <span v-else>Cadastre o primeiro cliente da sua gráfica</span>
          </div>
        </div>
        <button
          v-if="perms.can.create('customers')"
          @click="openModal()"
          class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors shrink-0"
        >
          <span class="text-base leading-none">+</span>
          <span>Novo cliente</span>
        </button>
      </div>

      <!-- Busca -->
      <div class="relative mb-5 max-w-md">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input
          v-model="search"
          type="text"
          placeholder="Buscar por nome, e-mail, telefone ou documento…"
          class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"
        />
      </div>

      <!-- Tabela -->
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <!-- Loading -->
        <div v-if="loading" class="p-1">
          <div v-for="i in 5" :key="`l${i}`"
               class="grid grid-cols-[1.6fr_1fr_1fr_80px] gap-4 items-center py-4 px-5 border-b border-slate-100 last:border-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0"></div>
              <div class="space-y-1.5 min-w-0 flex-1">
                <div class="h-3 bg-slate-100 rounded animate-pulse w-32"></div>
                <div class="h-2.5 bg-slate-50 rounded animate-pulse w-40"></div>
              </div>
            </div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-24"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-28"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-12 justify-self-end"></div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="customers.length === 0" class="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <div class="text-sm font-medium text-slate-900 mb-1">Nenhum cliente</div>
          <div class="text-xs text-slate-500 mb-4 max-w-xs">{{ search ? 'Nenhum cliente bate com essa busca.' : 'Sua base está vazia. Comece adicionando o primeiro cliente.' }}</div>
          <button @click="openModal()" class="text-xs font-medium text-slate-900 underline underline-offset-4 hover:no-underline">
            {{ search ? 'Limpar busca' : 'Criar primeiro cliente' }}
          </button>
        </div>

        <!-- Lista -->
        <div v-else>
          <!-- Header -->
          <div class="grid grid-cols-[1.6fr_1fr_1fr_80px] gap-4 text-[11px] text-slate-400 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <span>Cliente</span>
            <span>Documento</span>
            <span>Contato</span>
            <span class="text-right">Ações</span>
          </div>
          <div
            v-for="customer in customers" :key="customer.id"
            class="grid grid-cols-[1.6fr_1fr_1fr_80px] gap-4 items-center py-3.5 px-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group"
          >
            <div class="flex items-center gap-3 min-w-0">
              <img v-if="customer.photoUrl"
                   :src="customer.photoUrl"
                   :alt="customer.name"
                   class="w-9 h-9 rounded-full object-cover bg-slate-100 shrink-0" />
              <span v-else
                    class="w-9 h-9 rounded-full bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center shrink-0">
                {{ (customer.name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') }}
              </span>
              <div class="min-w-0">
                <div class="text-sm font-medium text-slate-900 truncate">{{ customer.name }}</div>
                <div class="text-xs text-slate-400 truncate">{{ customer.email || 'Sem e-mail' }}</div>
              </div>
            </div>
            <span class="text-sm text-slate-600 truncate font-mono">{{ formatDocument(customer.document || '') || '—' }}</span>
            <span class="text-sm text-slate-600 truncate font-mono">{{ formatPhone(customer.phone || '') || 'Sem telefone' }}</span>
            <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button v-if="perms.can.edit('customers')" @click="openModal(customer)" class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Editar">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button v-if="perms.can.delete('customers')" @click="deleteCustomer(customer.id)" class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
          <div class="border-t border-slate-100 px-4">
            <PaginationControls v-model:page="page" v-model:limit="limit" :total="total" :total-pages="totalPages" />
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de cadastro/edição -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showModal = false"></div>

        <div class="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 relative z-10 overflow-hidden flex flex-col max-h-[92vh] shadow-2xl">
          <!-- Header com avatar grande -->
          <div class="px-6 py-5 border-b border-slate-100 flex items-center gap-4 shrink-0">
            <!-- Avatar / upload -->
            <div class="relative shrink-0">
              <div v-if="newCustomer.photoUrl"
                   class="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border-2 border-white ring-1 ring-slate-200">
                <img :src="newCustomer.photoUrl" alt="Foto do cliente" class="w-full h-full object-cover" />
              </div>
              <div v-else
                   class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-medium">
                {{ (newCustomer.name || '?').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '?' }}
              </div>
              <button @click="pickPhoto" type="button"
                      :disabled="photoUploading"
                      class="absolute -bottom-1 -right-1 w-7 h-7 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                      :title="newCustomer.photoUrl ? 'Trocar foto' : 'Adicionar foto'">
                <svg v-if="!photoUploading" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span v-else class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              </button>
              <button v-if="newCustomer.photoUrl" @click="removePhoto" type="button"
                      class="absolute -top-1 -right-1 w-5 h-5 bg-white hover:bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                      title="Remover foto">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <input ref="photoFileInput" type="file" accept="image/*" class="hidden" @change="onPhotoSelected" />
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="text-base font-medium text-slate-900 truncate">
                {{ isEditing ? (newCustomer.name || 'Editar cliente') : 'Novo cliente' }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ isEditing ? 'Atualize os dados do cliente' : 'Preencha as abas para cadastrar' }}
              </p>
            </div>

            <button @click="showModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="px-6 border-b border-slate-100 flex items-center gap-1 shrink-0">
            <button v-for="t in tabsList" :key="t.id"
              @click="activeTab = t.id as any"
              :class="['px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === t.id
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-500 border-transparent hover:text-slate-700']">
              {{ t.label }}
            </button>
          </div>

          <!-- Conteúdo das tabs -->
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <!-- Aba 1: Dados básicos -->
            <div v-show="activeTab === 'basic'" class="space-y-4">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Nome ou razão social <span class="text-rose-500">*</span></label>
                <input v-model="newCustomer.name" type="text"
                       placeholder="Ex: João da Silva ou Acme Comércio Ltda"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-slate-500 mb-1.5">CPF / CNPJ</label>
                  <input :value="newCustomer.document" @input="onDocumentInput"
                         type="text"
                         inputmode="numeric"
                         placeholder="000.000.000-00"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-slate-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs text-slate-500 mb-1.5">Telefone / WhatsApp</label>
                  <input :value="newCustomer.phone" @input="onPhoneInput"
                         type="tel"
                         inputmode="numeric"
                         placeholder="(11) 99999-9999"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-slate-400 transition-colors">
                </div>
              </div>

              <div>
                <label class="block text-xs text-slate-500 mb-1.5">E-mail</label>
                <input v-model="newCustomer.email" type="email"
                       placeholder="cliente@exemplo.com"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>

              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Data de nascimento</label>
                <input v-model="newCustomer.birthDate" type="date"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
            </div>

            <!-- Aba 2: Endereço -->
            <div v-show="activeTab === 'address'" class="space-y-4">
              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-1">
                  <label class="block text-xs text-slate-500 mb-1.5">CEP</label>
                  <div class="relative">
                    <input :value="newCustomer.zipCode"
                           @input="onCepInput"
                           @blur="lookupCep"
                           @keydown.enter.prevent="lookupCep"
                           type="text"
                           inputmode="numeric"
                           placeholder="00000-000"
                           class="w-full bg-white border border-slate-200 rounded-md pl-3 pr-9 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-slate-400 transition-colors">
                    <span v-if="cepLoading" class="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></span>
                    <button v-else type="button" @click="lookupCep"
                            class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
                            title="Buscar pelo CEP">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </button>
                  </div>
                  <p v-if="cepError" class="mt-1 text-[11px] text-rose-600">{{ cepError }}</p>
                  <p v-else class="mt-1 text-[11px] text-slate-400">Tab/Enter pra buscar</p>
                </div>
                <div class="col-span-2">
                  <label class="block text-xs text-slate-500 mb-1.5">Rua / avenida</label>
                  <input v-model="newCustomer.address" type="text"
                         placeholder="Av. Paulista"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                </div>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-1">
                  <label class="block text-xs text-slate-500 mb-1.5">Número</label>
                  <input v-model="newCustomer.number" type="text"
                         placeholder="123"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                </div>
                <div class="col-span-2">
                  <label class="block text-xs text-slate-500 mb-1.5">Complemento</label>
                  <input v-model="newCustomer.complement" type="text"
                         placeholder="Apto 12, Sala 5…"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                </div>
              </div>

              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Bairro</label>
                <input v-model="newCustomer.neighborhood" type="text"
                       placeholder="Bela Vista"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>

              <div class="grid grid-cols-4 gap-3">
                <div class="col-span-3">
                  <label class="block text-xs text-slate-500 mb-1.5">Cidade</label>
                  <input v-model="newCustomer.city" type="text"
                         placeholder="São Paulo"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                </div>
                <div class="col-span-1">
                  <label class="block text-xs text-slate-500 mb-1.5">UF</label>
                  <input v-model="newCustomer.state" type="text"
                         maxlength="2"
                         placeholder="SP"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 uppercase font-mono focus:outline-none focus:border-slate-400 transition-colors">
                </div>
              </div>
            </div>

            <!-- Aba 3: Outros -->
            <div v-show="activeTab === 'extra'" class="space-y-4">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Observações</label>
                <textarea v-model="newCustomer.notes"
                          rows="6"
                          maxlength="2000"
                          placeholder="Anotações sobre o cliente — preferências, histórico, contatos especiais…"
                          class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors resize-y leading-relaxed"></textarea>
                <p class="mt-1 text-[11px] text-slate-400 text-right">{{ newCustomer.notes.length }} / 2000</p>
              </div>

              <div class="rounded-lg border border-dashed border-slate-200 p-4 bg-slate-50">
                <p class="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Dica</p>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Telefone e CPF/CNPJ são salvos sem máscara no banco — a formatação visual é só pra digitação.
                  Use a aba <strong>Endereço</strong> com o CEP pra preenchimento automático via ViaCEP.
                </p>
              </div>
            </div>

            <!-- Aba 4: Fidelidade — só aparece em edit + feature ativa -->
            <div v-show="activeTab === 'loyalty'" class="space-y-4">
              <div v-if="loyaltyLoading" class="text-center py-10 text-slate-400 text-sm">
                <div class="inline-block w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin mb-2"></div>
                <p>Carregando saldo…</p>
              </div>

              <template v-else-if="loyaltySummary">
                <!-- KPIs principais -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                    <div class="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Pontos</div>
                    <div class="text-2xl font-semibold text-emerald-900 mt-1">{{ loyaltySummary.loyaltyPoints.toLocaleString('pt-BR') }}</div>
                    <div class="text-[11px] text-emerald-700 mt-0.5">≈ {{ formatBRL(loyaltySummary.pointsValue) }}</div>
                  </div>
                  <div class="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <div class="text-[11px] font-medium text-blue-700 uppercase tracking-wider">Cashback</div>
                    <div class="text-2xl font-semibold text-blue-900 mt-1">{{ formatBRL(loyaltySummary.loyaltyBalance) }}</div>
                    <div class="text-[11px] text-blue-700 mt-0.5">disponível pra resgate</div>
                  </div>
                </div>

                <!-- Tier + spend 12m -->
                <div class="bg-white border border-slate-200 rounded-lg p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Nível atual</div>
                      <div class="flex items-center gap-2 mt-1">
                        <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', tierColor(loyaltySummary.loyaltyTier)]">
                          {{ loyaltySummary.loyaltyTier || 'Sem nível' }}
                        </span>
                        <span v-if="loyaltySummary.tierConfig?.discount" class="text-[11px] text-slate-500">
                          {{ loyaltySummary.tierConfig.discount }}% off · {{ loyaltySummary.tierConfig.pointsMultiplier }}x pontos
                        </span>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Gasto 12m</div>
                      <div class="text-sm font-semibold text-slate-900 mt-1">{{ formatBRL(loyaltySummary.loyaltySpend12m) }}</div>
                    </div>
                  </div>
                </div>

                <!-- Código de indicação -->
                <div class="bg-violet-50 border border-violet-100 rounded-lg p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-[11px] font-medium text-violet-700 uppercase tracking-wider">Código de indicação</div>
                      <div class="flex items-center gap-2 mt-1">
                        <code v-if="loyaltySummary.referralCode" class="text-base font-mono font-semibold text-violet-900 tracking-wider">{{ loyaltySummary.referralCode }}</code>
                        <span v-else class="text-xs text-violet-700 italic">Não gerado ainda</span>
                      </div>
                    </div>
                    <button v-if="loyaltySummary.referralCode" @click="copyReferral" type="button"
                            class="px-3 py-1.5 text-xs font-medium border border-violet-200 text-violet-700 rounded-md hover:bg-violet-100 transition-colors">
                      Copiar
                    </button>
                    <button v-else @click="generateReferralCode" type="button"
                            class="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors">
                      Gerar
                    </button>
                  </div>
                </div>

                <!-- Ajuste manual (só admin com loyalty.edit) -->
                <div v-if="perms.can.edit('loyalty')" class="bg-white border border-slate-200 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider">Ajuste manual</h4>
                    <button v-if="!showAdjustForm" @click="showAdjustForm = true" type="button"
                            class="text-xs text-emerald-700 hover:text-emerald-800 font-medium">+ Novo ajuste</button>
                    <button v-else @click="showAdjustForm = false" type="button"
                            class="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancelar</button>
                  </div>
                  <div v-if="showAdjustForm" class="space-y-2.5">
                    <div class="grid grid-cols-2 gap-2.5">
                      <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Pontos (negativo p/ debitar)</label>
                        <input v-model.number="adjustForm.points" type="number" placeholder="0"
                               class="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-slate-400" />
                      </div>
                      <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Cashback R$ (negativo p/ debitar)</label>
                        <input v-model.number="adjustForm.cashback" type="number" step="0.01" placeholder="0,00"
                               class="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label class="block text-[11px] text-slate-500 mb-1">Motivo <span class="text-rose-500">*</span></label>
                      <input v-model="adjustForm.reason" type="text" maxlength="200" placeholder="Ex: Compensação atendimento — pedido #4521"
                             class="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-slate-400" />
                    </div>
                    <button @click="submitAdjust" :disabled="!adjustForm.reason.trim() || (adjustForm.points === 0 && adjustForm.cashback === 0)" type="button"
                            class="w-full py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Aplicar ajuste
                    </button>
                  </div>
                </div>

                <!-- Extrato -->
                <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div class="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider">Extrato</h4>
                    <span class="text-[11px] text-slate-400">{{ loyaltyTransactions.length }} última(s)</span>
                  </div>
                  <div v-if="loyaltyTransactions.length === 0" class="text-center py-8 text-xs text-slate-400">
                    Sem movimentações ainda.
                  </div>
                  <div v-else class="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    <div v-for="tx in loyaltyTransactions" :key="tx.id" class="px-4 py-2.5 flex items-center gap-3">
                      <span :class="['inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider shrink-0', txTypeLabel(tx.type).color]">
                        {{ txTypeLabel(tx.type).label }}
                      </span>
                      <div class="flex-1 min-w-0">
                        <div class="text-xs text-slate-700 truncate">{{ tx.reason || '—' }}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">
                          {{ new Date(tx.createdAt).toLocaleDateString('pt-BR') }}
                          <span v-if="tx.expiresAt"> · expira em {{ new Date(tx.expiresAt).toLocaleDateString('pt-BR') }}</span>
                        </div>
                      </div>
                      <div class="text-right shrink-0">
                        <div v-if="tx.points !== 0" :class="['text-xs font-semibold', tx.points > 0 ? 'text-emerald-700' : 'text-rose-700']">
                          {{ tx.points > 0 ? '+' : '' }}{{ tx.points.toLocaleString('pt-BR') }} pts
                        </div>
                        <div v-if="tx.cashback !== 0" :class="['text-xs font-semibold', tx.cashback > 0 ? 'text-blue-700' : 'text-rose-700']">
                          {{ tx.cashback > 0 ? '+' : '' }}{{ formatBRL(tx.cashback) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <div v-else class="text-center py-10 text-slate-400 text-sm">
                Saldo indisponível.
              </div>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
            <button @click="showModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button @click="handleSave"
                    :disabled="!newCustomer.name"
                    class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {{ isEditing ? 'Atualizar' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
