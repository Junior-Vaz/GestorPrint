<template>
  <SidebarLayout>
    <div class="p-6 space-y-6">

      <!-- Config Status -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
          <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', config?.configured ? 'bg-emerald-100' : 'bg-red-100']">
            <svg class="w-5 h-5" :class="config?.configured ? 'text-emerald-600' : 'text-red-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="config?.configured" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <p class="text-xs text-slate-500">API Key Asaas</p>
            <p class="text-sm font-bold" :class="config?.configured ? 'text-emerald-600' : 'text-red-500'">
              {{ config?.configured ? 'Configurada' : 'Não configurada' }}
            </p>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/>
            </svg>
          </div>
          <div>
            <p class="text-xs text-slate-500">Ambiente</p>
            <p class="text-sm font-bold text-slate-800 capitalize">{{ config?.env || '—' }}</p>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p class="text-xs text-slate-500 mb-1">URL do Webhook (configurar no Asaas)</p>
          <div class="flex items-center gap-2">
            <code class="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg truncate flex-1">{{ config?.webhookUrl }}</code>
            <button @click="copyWebhookUrl" class="p-1 text-slate-400 hover:text-indigo-600 shrink-0" title="Copiar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Tenants Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h2 class="text-sm font-bold text-slate-700">Assinaturas por Tenant</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-slate-500 bg-slate-50 text-left border-b border-slate-100">
                <th class="px-4 py-3 font-semibold">Nome</th>
                <th class="px-4 py-3 font-semibold">Plano</th>
                <th class="px-4 py-3 font-semibold">Status</th>
                <th class="px-4 py-3 font-semibold">Cliente Asaas</th>
                <th class="px-4 py-3 font-semibold">Assinatura</th>
                <th class="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="t in tenants" :key="t.id" class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3">
                  <p class="font-semibold text-slate-800">{{ t.name }}</p>
                  <p class="text-xs text-slate-400">{{ t.ownerEmail || '—' }}</p>
                </td>
                <td class="px-4 py-3">
                  <span :class="['px-2 py-0.5 rounded-md text-xs font-bold', PLAN_BADGE[t.plan] || 'bg-slate-100 text-slate-600']">{{ t.plan }}</span>
                </td>
                <td class="px-4 py-3">
                  <span :class="['px-2.5 py-0.5 rounded-full text-xs font-semibold', STATUS_COLORS[t.planStatus] || 'bg-slate-100 text-slate-500']">{{ t.planStatus }}</span>
                </td>
                <td class="px-4 py-3">
                  <span v-if="t.asaasCustomerId" class="font-mono text-xs text-slate-600">{{ t.asaasCustomerId }}</span>
                  <span v-else class="text-xs text-slate-400 italic">Não criado</span>
                </td>
                <td class="px-4 py-3">
                  <span v-if="t.asaasSubscriptionId" class="font-mono text-xs text-emerald-600">{{ t.asaasSubscriptionId }}</span>
                  <span v-else class="text-xs text-slate-400 italic">Sem assinatura</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex gap-1">
                    <!-- Criar cliente -->
                    <button v-if="!t.asaasCustomerId" @click="createCustomer(t)"
                      :disabled="loading[t.id]"
                      class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                      title="Criar cliente no Asaas">
                      {{ loading[t.id] === 'customer' ? '...' : 'Criar cliente' }}
                    </button>
                    <!-- Ativar assinatura -->
                    <button v-if="t.asaasCustomerId && t.plan !== 'FREE'" @click="openSubscriptionModal(t)"
                      class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      title="Ativar assinatura recorrente">
                      {{ t.asaasSubscriptionId ? 'Alterar' : 'Assinar' }}
                    </button>
                    <!-- Cancelar -->
                    <button v-if="t.asaasSubscriptionId" @click="cancelSubscription(t)"
                      :disabled="loading[t.id]"
                      class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors"
                      title="Cancelar assinatura">
                      {{ loading[t.id] === 'cancel' ? '...' : 'Cancelar' }}
                    </button>
                    <!-- Ver faturas -->
                    <button v-if="t.asaasCustomerId" @click="openInvoices(t)"
                      class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors">
                      Faturas
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="tenants.length === 0">
                <td colspan="6" class="px-4 py-10 text-center text-slate-400 text-sm">Carregando...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal: Ativar Assinatura -->
    <div v-if="subscriptionModal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" @click.self="subscriptionModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 class="text-base font-bold text-slate-800 mb-1">Ativar Assinatura</h3>
        <p class="text-sm text-slate-500 mb-5">Tenant: <strong>{{ selectedTenant?.name }}</strong> — Plano <strong>{{ selectedTenant?.plan }}</strong></p>
        <div class="space-y-2 mb-5">
          <button v-for="bt in ['PIX', 'BOLETO']" :key="bt" @click="selectedBillingType = bt"
            :class="['w-full border-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all text-left',
              selectedBillingType === bt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-700 hover:border-slate-300']">
            {{ bt === 'PIX' ? '⚡ PIX (recomendado)' : '🟦 Boleto Bancário' }}
          </button>
        </div>
        <div class="flex gap-2">
          <button @click="subscriptionModal = false" class="flex-1 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancelar</button>
          <button @click="confirmSubscription" :disabled="!selectedBillingType || subscriptionLoading"
            class="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {{ subscriptionLoading ? 'Gerando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Painel de Faturas -->
    <div v-if="invoicePanel" class="fixed inset-0 bg-black/60 z-50 flex justify-end" @click.self="invoicePanel = false">
      <div class="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-slate-800">Faturas</h3>
            <p class="text-xs text-slate-500">{{ selectedTenant?.name }}</p>
          </div>
          <button @click="invoicePanel = false" class="text-slate-400 hover:text-slate-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-5">
          <div v-if="invoicesLoading" class="text-center py-10 text-slate-400 text-sm">Carregando...</div>
          <div v-else-if="invoices.length === 0" class="text-center py-10 text-slate-400 text-sm">Nenhuma fatura encontrada</div>
          <div v-else class="space-y-3">
            <div v-for="inv in invoices" :key="inv.id" class="border border-slate-200 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <span :class="['px-2.5 py-0.5 rounded-full text-xs font-semibold', INVOICE_STATUS[inv.status] || 'bg-slate-100 text-slate-500']">
                  {{ inv.status }}
                </span>
                <span class="text-sm font-bold text-slate-800">R$ {{ inv.value?.toFixed(2) }}</span>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-500">
                <span>Vence: {{ inv.dueDate }}</span>
                <a v-if="inv.invoiceUrl" :href="inv.invoiceUrl" target="_blank"
                  class="text-indigo-600 hover:text-indigo-700 font-semibold">
                  Ver fatura →
                </a>
                <a v-else-if="inv.bankSlipUrl" :href="inv.bankSlipUrl" target="_blank"
                  class="text-indigo-600 hover:text-indigo-700 font-semibold">
                  Boleto →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SidebarLayout from '../components/SidebarLayout.vue'
import { apiFetch } from '../utils/api'

interface Tenant {
  id: number; name: string; plan: string; planStatus: string;
  ownerEmail?: string; asaasCustomerId?: string; asaasSubscriptionId?: string;
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
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
}

const config = ref<any>(null)
const tenants = ref<Tenant[]>([])
const loading = ref<Record<number, string | false>>({})

const subscriptionModal = ref(false)
const selectedTenant = ref<Tenant | null>(null)
const selectedBillingType = ref('')
const subscriptionLoading = ref(false)

const invoicePanel = ref(false)
const invoices = ref<any[]>([])
const invoicesLoading = ref(false)

const fetchAll = async () => {
  const [cfgRes, tenantsRes] = await Promise.all([
    apiFetch('/api/billing/config'),
    apiFetch('/api/tenants'),
  ])
  if (cfgRes.ok) config.value = await cfgRes.json()
  if (tenantsRes.ok) tenants.value = await tenantsRes.json()
}

const createCustomer = async (t: Tenant) => {
  loading.value[t.id] = 'customer'
  const res = await apiFetch(`/api/billing/customers/${t.id}`, { method: 'POST' })
  loading.value[t.id] = false
  if (res.ok) await fetchAll()
}

const openSubscriptionModal = (t: Tenant) => {
  selectedTenant.value = t
  selectedBillingType.value = 'PIX'
  subscriptionModal.value = true
}

const confirmSubscription = async () => {
  if (!selectedTenant.value || !selectedBillingType.value) return
  subscriptionLoading.value = true
  const res = await apiFetch(`/api/billing/subscriptions/${selectedTenant.value.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ billingType: selectedBillingType.value }),
  })
  subscriptionLoading.value = false
  if (res.ok) { subscriptionModal.value = false; await fetchAll() }
}

const cancelSubscription = async (t: Tenant) => {
  if (!confirm(`Cancelar assinatura de "${t.name}"?`)) return
  loading.value[t.id] = 'cancel'
  await apiFetch(`/api/billing/subscriptions/${t.id}`, { method: 'DELETE' })
  loading.value[t.id] = false
  await fetchAll()
}

const openInvoices = async (t: Tenant) => {
  selectedTenant.value = t
  invoicePanel.value = true
  invoicesLoading.value = true
  invoices.value = []
  const res = await apiFetch(`/api/billing/invoices/${t.id}`)
  invoicesLoading.value = false
  if (res.ok) invoices.value = await res.json()
}

const copyWebhookUrl = () => {
  if (config.value?.webhookUrl) navigator.clipboard.writeText(config.value.webhookUrl)
}

onMounted(fetchAll)
</script>
