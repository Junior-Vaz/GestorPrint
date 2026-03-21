<template>
  <SidebarLayout>
    <div class="p-6 max-w-7xl mx-auto space-y-6">

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <div class="p-2 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-100">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            Cobrança Asaas
          </h1>
          <p class="text-slate-500 mt-1 font-medium italic">Gateway de pagamentos recorrentes dos assinantes</p>
        </div>
        <button
          @click="fetchAll"
          :disabled="pageLoading"
          class="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-60"
        >
          <svg v-if="!pageLoading" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <div v-else class="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Atualizar
        </button>
      </div>

      <!-- Config Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- API Key Status -->
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-xl shadow-slate-200/60 flex items-center gap-4">
          <div :class="['w-12 h-12 rounded-xl flex items-center justify-center shrink-0', config?.configured ? 'bg-emerald-100' : 'bg-red-100']">
            <svg class="w-6 h-6" :class="config?.configured ? 'text-emerald-600' : 'text-red-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="config?.configured" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">API Key Asaas</p>
            <p class="text-lg font-extrabold mt-0.5" :class="config?.configured ? 'text-emerald-600' : 'text-red-500'">
              {{ config?.configured ? 'Configurada' : 'Não configurada' }}
            </p>
          </div>
        </div>

        <!-- Ambiente -->
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-xl shadow-slate-200/60 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/>
            </svg>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ambiente</p>
            <p class="text-lg font-extrabold text-slate-800 mt-0.5 capitalize">{{ config?.env || '—' }}</p>
          </div>
        </div>

        <!-- Webhook URL -->
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-xl shadow-slate-200/60">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Webhook URL (configurar no Asaas)</p>
          <div class="flex items-center gap-2">
            <code class="text-xs text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg truncate flex-1 border border-indigo-100">{{ config?.webhookUrl || '—' }}</code>
            <button @click="copyWebhookUrl"
              class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0" title="Copiar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Tenants Table -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div class="w-2 h-6 bg-emerald-500 rounded-full"></div>
            Assinaturas por Tenant
          </h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-100">
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Plano</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">CPF/CNPJ</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente Asaas</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Assinatura</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="t in tenants" :key="t.id" class="hover:bg-indigo-50/30 transition-colors group">
                <td class="px-6 py-4">
                  <p class="font-bold text-slate-800">{{ t.name }}</p>
                  <p class="text-xs text-slate-400">{{ t.ownerEmail || '—' }}</p>
                </td>
                <td class="px-6 py-4">
                  <span :class="['px-3 py-1 rounded-lg text-xs font-black inline-flex', PLAN_BADGE[t.plan] || 'bg-slate-100 text-slate-600']">{{ t.plan }}</span>
                </td>
                <td class="px-6 py-4">
                  <span :class="['px-3 py-1 rounded-full text-xs font-black inline-flex', STATUS_COLORS[t.planStatus] || 'bg-slate-100 text-slate-500']">{{ t.planStatus }}</span>
                </td>
                <td class="px-6 py-4">
                  <span v-if="t.cpfCnpj" class="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{{ t.cpfCnpj }}</span>
                  <span v-else class="inline-flex items-center gap-1 text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    Pendente
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span v-if="t.asaasCustomerId" class="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{{ t.asaasCustomerId }}</span>
                  <span v-else class="text-xs text-slate-400 italic">Não criado</span>
                </td>
                <td class="px-6 py-4">
                  <span v-if="t.asaasSubscriptionId" class="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">{{ t.asaasSubscriptionId }}</span>
                  <span v-else class="text-xs text-slate-400 italic">Sem assinatura</span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex gap-1.5 flex-wrap">
                    <!-- Criar cliente: desabilitado sem CPF/CNPJ -->
                    <div class="relative group/btn" v-if="!t.asaasCustomerId">
                      <button
                        @click="t.cpfCnpj ? createCustomer(t) : showAlert('warning', 'CPF/CNPJ obrigatório', 'Cadastre o CPF/CNPJ do responsável no módulo Tenants antes de criar o cliente no Asaas.')"
                        :disabled="!!loading[t.id]"
                        :class="['px-3 py-1.5 text-xs font-bold rounded-lg transition-colors', t.cpfCnpj ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 text-slate-400 cursor-pointer']">
                        {{ loading[t.id] === 'customer' ? '...' : 'Criar cliente' }}
                      </button>
                    </div>
                    <button v-if="t.asaasCustomerId && t.plan !== 'FREE'" @click="openSubscriptionModal(t)"
                      class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors">
                      {{ t.asaasSubscriptionId ? 'Alterar' : 'Assinar' }}
                    </button>
                    <button v-if="t.asaasSubscriptionId" @click="cancelSubscription(t)"
                      :disabled="!!loading[t.id]"
                      class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors border border-red-100">
                      {{ loading[t.id] === 'cancel' ? '...' : 'Cancelar' }}
                    </button>
                    <button v-if="t.asaasCustomerId" @click="openInvoices(t)"
                      class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                      Faturas
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="tenants.length === 0 && !pageLoading">
                <td colspan="7" class="px-6 py-12 text-center text-slate-400 font-medium italic">
                  Nenhum tenant encontrado.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal: Ativar Assinatura -->
    <div v-if="subscriptionModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="subscriptionModal = false">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
        <h3 class="text-lg font-extrabold text-slate-800 mb-1">Ativar Assinatura</h3>
        <p class="text-sm text-slate-500 mb-5">
          Tenant: <strong class="text-slate-700">{{ selectedTenant?.name }}</strong> —
          Plano <strong class="text-indigo-600">{{ selectedTenant?.plan }}</strong>
        </p>
        <div class="space-y-2 mb-5">
          <button v-for="bt in ['PIX', 'BOLETO']" :key="bt" @click="selectedBillingType = bt"
            :class="['w-full border-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all text-left',
              selectedBillingType === bt ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100' : 'border-slate-200 text-slate-700 hover:border-slate-300']">
            {{ bt === 'PIX' ? '⚡ PIX (recomendado)' : '🟦 Boleto Bancário' }}
          </button>
        </div>
        <div class="flex gap-2">
          <button @click="subscriptionModal = false"
            class="flex-1 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
          <button @click="confirmSubscription" :disabled="!selectedBillingType || subscriptionLoading"
            class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95">
            {{ subscriptionLoading ? 'Gerando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Painel de Faturas (slide-over) -->
    <div v-if="invoicePanel" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end" @click.self="invoicePanel = false">
      <div class="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
        <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <h3 class="text-lg font-extrabold text-slate-800">Faturas</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ selectedTenant?.name }}</p>
          </div>
          <button @click="invoicePanel = false"
            class="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-5 bg-slate-50/50">
          <div v-if="invoicesLoading" class="text-center py-10 text-slate-400 text-sm">
            <div class="inline-block h-6 w-6 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin mb-2"></div>
            <p>Carregando faturas...</p>
          </div>
          <div v-else-if="invoices.length === 0" class="text-center py-10 text-slate-400 font-medium italic">
            Nenhuma fatura encontrada.
          </div>
          <div v-else class="space-y-3">
            <div v-for="inv in invoices" :key="inv.id"
              class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <span :class="['px-2.5 py-1 rounded-full text-xs font-black', INVOICE_STATUS[inv.status] || 'bg-slate-100 text-slate-500']">
                    {{ inv.status }}
                  </span>
                  <span v-if="inv.billingType" :class="['px-2.5 py-1 rounded-lg text-xs font-bold', BILLING_TYPE_BADGE[inv.billingType] || 'bg-slate-50 text-slate-500']">
                    {{ inv.billingType }}
                  </span>
                </div>
                <div class="text-right">
                  <p class="text-lg font-extrabold text-slate-800">R$ {{ inv.value?.toFixed(2) }}</p>
                  <p v-if="inv.netValue && inv.netValue !== inv.value" class="text-xs text-slate-400">
                    Líquido: R$ {{ inv.netValue?.toFixed(2) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-500 mb-3">
                <span class="font-semibold">Vence: {{ inv.dueDate }}</span>
                <span v-if="inv.paymentDate" class="text-emerald-600 font-bold">
                  Pago em: {{ inv.paymentDate }}
                </span>
              </div>
              <div class="flex gap-2">
                <a v-if="inv.invoiceUrl" :href="inv.invoiceUrl" target="_blank"
                  class="flex-1 text-center py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors border border-indigo-100">
                  Ver fatura →
                </a>
                <a v-if="inv.bankSlipUrl" :href="inv.bankSlipUrl" target="_blank"
                  class="flex-1 text-center py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors border border-blue-100">
                  Boleto →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de erro/aviso/sucesso -->
    <AlertModal
      :show="alert.show"
      :type="alert.type"
      :title="alert.title"
      :message="alert.message"
      @close="alert.show = false"
    />
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SidebarLayout from '../components/SidebarLayout.vue'
import AlertModal from '../components/AlertModal.vue'
import { apiFetch } from '../utils/api'

interface Tenant {
  id: number; name: string; plan: string; planStatus: string;
  ownerEmail?: string; cpfCnpj?: string; asaasCustomerId?: string; asaasSubscriptionId?: string;
}

const PLAN_BADGE: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600', BASIC: 'bg-blue-100 text-blue-700',
  PRO: 'bg-indigo-100 text-indigo-700', ENTERPRISE: 'bg-purple-100 text-purple-700',
}
const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-amber-100 text-amber-700', ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-700', CANCELLED: 'bg-slate-100 text-slate-500',
}
const INVOICE_STATUS: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  RECEIVED:  'bg-emerald-100 text-emerald-700',
  PENDING:   'bg-amber-100 text-amber-700',
  OVERDUE:   'bg-red-100 text-red-700',
  REFUNDED:  'bg-slate-100 text-slate-500',
  CHARGEBACK_REQUESTED: 'bg-red-100 text-red-700',
}
const BILLING_TYPE_BADGE: Record<string, string> = {
  PIX:         'bg-emerald-50 text-emerald-700 border border-emerald-100',
  BOLETO:      'bg-blue-50 text-blue-700 border border-blue-100',
  CREDIT_CARD: 'bg-purple-50 text-purple-700 border border-purple-100',
  UNDEFINED:   'bg-slate-50 text-slate-500 border border-slate-100',
}

const config = ref<any>(null)
const tenants = ref<Tenant[]>([])
const pageLoading = ref(false)
const loading = ref<Record<number, string | false>>({})

const subscriptionModal = ref(false)
const selectedTenant = ref<Tenant | null>(null)
const selectedBillingType = ref('')
const subscriptionLoading = ref(false)

const invoicePanel = ref(false)
const invoices = ref<any[]>([])
const invoicesLoading = ref(false)

// Alert modal state
const alert = ref({ show: false, type: 'error' as 'error' | 'warning' | 'success', title: '', message: '' })
const showAlert = (type: 'error' | 'warning' | 'success', title: string, message: string) => {
  alert.value = { show: true, type, title, message }
}

const parseError = async (res: Response): Promise<string> => {
  try {
    const err = await res.json()
    const msg = err?.message || err?.error || 'Erro desconhecido'
    return Array.isArray(msg) ? msg.join(', ') : String(msg)
  } catch {
    return `Erro ${res.status}`
  }
}

const fetchAll = async () => {
  pageLoading.value = true
  try {
    const [cfgRes, tenantsRes] = await Promise.all([
      apiFetch('/api/billing/config'),
      apiFetch('/api/tenants'),
    ])
    if (cfgRes.ok) config.value = await cfgRes.json()
    if (tenantsRes.ok) tenants.value = await tenantsRes.json()
  } catch {
    showAlert('error', 'Erro de Conexão', 'Não foi possível conectar ao servidor. Verifique se o backend está online.')
  } finally {
    pageLoading.value = false
  }
}

const createCustomer = async (t: Tenant) => {
  loading.value[t.id] = 'customer'
  try {
    const res = await apiFetch(`/api/billing/customers/${t.id}`, { method: 'POST' })
    if (!res.ok) {
      showAlert('error', 'Erro ao criar cliente', await parseError(res))
    } else {
      showAlert('success', 'Cliente criado!', `Cliente Asaas criado com sucesso para "${t.name}".`)
      await fetchAll()
    }
  } catch {
    showAlert('error', 'Erro de Conexão', 'Não foi possível criar o cliente no Asaas.')
  } finally {
    loading.value[t.id] = false
  }
}

const openSubscriptionModal = (t: Tenant) => {
  selectedTenant.value = t
  selectedBillingType.value = 'PIX'
  subscriptionModal.value = true
}

const confirmSubscription = async () => {
  if (!selectedTenant.value || !selectedBillingType.value) return
  subscriptionLoading.value = true
  try {
    const res = await apiFetch(`/api/billing/subscriptions/${selectedTenant.value.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingType: selectedBillingType.value }),
    })
    if (!res.ok) {
      showAlert('error', 'Erro na Assinatura', await parseError(res))
    } else {
      subscriptionModal.value = false
      showAlert('success', 'Assinatura ativada!', `Assinatura ${selectedBillingType.value} criada com sucesso.`)
      await fetchAll()
    }
  } catch {
    showAlert('error', 'Erro de Conexão', 'Não foi possível criar a assinatura no Asaas.')
  } finally {
    subscriptionLoading.value = false
  }
}

const cancelSubscription = async (t: Tenant) => {
  if (!confirm(`Cancelar assinatura de "${t.name}"?`)) return
  loading.value[t.id] = 'cancel'
  try {
    const res = await apiFetch(`/api/billing/subscriptions/${t.id}`, { method: 'DELETE' })
    if (!res.ok) {
      showAlert('error', 'Erro ao Cancelar', await parseError(res))
    } else {
      showAlert('success', 'Assinatura cancelada', `A assinatura de "${t.name}" foi cancelada com sucesso.`)
      await fetchAll()
    }
  } catch {
    showAlert('error', 'Erro de Conexão', 'Não foi possível cancelar a assinatura.')
  } finally {
    loading.value[t.id] = false
  }
}

const openInvoices = async (t: Tenant) => {
  selectedTenant.value = t
  invoicePanel.value = true
  invoicesLoading.value = true
  invoices.value = []
  try {
    const res = await apiFetch(`/api/billing/invoices/${t.id}`)
    if (res.ok) {
      invoices.value = await res.json()
    } else {
      showAlert('error', 'Erro ao carregar faturas', await parseError(res))
      invoicePanel.value = false
    }
  } catch {
    showAlert('error', 'Erro de Conexão', 'Não foi possível carregar as faturas.')
    invoicePanel.value = false
  } finally {
    invoicesLoading.value = false
  }
}

const copyWebhookUrl = () => {
  if (config.value?.webhookUrl) navigator.clipboard.writeText(config.value.webhookUrl)
}

onMounted(fetchAll)
</script>
