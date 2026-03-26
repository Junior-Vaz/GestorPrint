<template>
  <SidebarLayout>
    <div class="p-6 max-w-5xl mx-auto space-y-6">

      <!-- Loading skeleton -->
      <div v-if="pageLoading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>

      <template v-else-if="tenant">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6">
          <div class="flex items-center gap-4">
            <button @click="router.push('/tenants')"
              class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
            </button>
            <div>
              <h1 class="text-2xl font-extrabold text-slate-800 leading-tight">{{ tenant.name }}</h1>
              <p class="text-xs text-slate-400 font-mono mt-0.5">{{ tenant.slug }}</p>
            </div>
            <span :class="['px-3 py-1 rounded-full text-xs font-black', STATUS_COLORS[tenant.planStatus] || 'bg-slate-100 text-slate-500']">
              {{ tenant.planStatus }}
            </span>
          </div>
          <div class="flex gap-2">
            <button v-if="tenant.planStatus !== 'SUSPENDED' && tenant.planStatus !== 'CANCELLED'"
              @click="suspendTenant" :disabled="actionLoading"
              class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl border border-red-100 transition-all disabled:opacity-50">
              Suspender
            </button>
            <button v-else @click="activateTenant" :disabled="actionLoading"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-100 disabled:opacity-50">
              Reativar
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 bg-slate-100/80 rounded-2xl p-1">
          <button v-for="tab in TABS" :key="tab.id" @click="activeTab = tab.id"
            :class="['flex-1 py-2.5 text-sm font-bold rounded-xl transition-all',
              activeTab === tab.id ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700']">
            {{ tab.label }}
          </button>
        </div>

        <!-- ─── Tab: Empresa ─────────────────────────────────────────────── -->
        <div v-if="activeTab === 'empresa'" class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6 space-y-6">
          <h2 class="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <div class="w-1.5 h-5 bg-indigo-500 rounded-full"></div>
            Dados da Empresa
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="field-label">Nome Fantasia</label>
              <input v-model="form.empresa.name" class="field-input" placeholder="Nome da empresa" />
            </div>
            <div>
              <label class="field-label">Slug</label>
              <input v-model="form.empresa.slug" class="field-input font-mono" placeholder="slug-da-empresa" />
            </div>
            <div>
              <label class="field-label">Razão Social</label>
              <input v-model="form.empresa.razaoSocial" class="field-input" placeholder="Razão Social Ltda" />
            </div>
            <div>
              <label class="field-label">CNPJ / CPF</label>
              <input v-model="form.empresa.cpfCnpj" class="field-input font-mono" placeholder="00000000000000" maxlength="14" />
            </div>
            <div>
              <label class="field-label">Inscrição Estadual</label>
              <input v-model="form.empresa.inscricaoEstadual" class="field-input" placeholder="Isento ou número" />
            </div>
          </div>

          <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider pt-2">Endereço</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="field-label">CEP</label>
              <input v-model="form.empresa.zipCode" class="field-input font-mono" placeholder="00000-000" maxlength="9" />
            </div>
            <div class="sm:col-span-2 grid grid-cols-3 gap-4">
              <div class="col-span-2">
                <label class="field-label">Logradouro</label>
                <input v-model="form.empresa.address" class="field-input" placeholder="Rua, Avenida..." />
              </div>
              <div>
                <label class="field-label">Número</label>
                <input v-model="form.empresa.number" class="field-input" placeholder="123" />
              </div>
            </div>
            <div>
              <label class="field-label">Complemento</label>
              <input v-model="form.empresa.complement" class="field-input" placeholder="Sala 01" />
            </div>
            <div>
              <label class="field-label">Bairro</label>
              <input v-model="form.empresa.neighborhood" class="field-input" placeholder="Centro" />
            </div>
            <div>
              <label class="field-label">Cidade</label>
              <input v-model="form.empresa.city" class="field-input" placeholder="São Paulo" />
            </div>
            <div>
              <label class="field-label">Estado (UF)</label>
              <input v-model="form.empresa.state" class="field-input" placeholder="SP" maxlength="2" />
            </div>
          </div>

          <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider pt-2">Responsável</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="field-label">Nome do Responsável</label>
              <input v-model="form.empresa.ownerName" class="field-input" placeholder="Nome completo" />
            </div>
            <div>
              <label class="field-label">E-mail do Responsável</label>
              <input v-model="form.empresa.ownerEmail" type="email" class="field-input" placeholder="email@empresa.com" />
            </div>
            <div>
              <label class="field-label">Telefone</label>
              <input v-model="form.empresa.ownerPhone" class="field-input" placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button @click="saveEmpresa" :disabled="saving.empresa"
              class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2">
              <div v-if="saving.empresa" class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {{ saving.empresa ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>

        <!-- ─── Tab: Plano & Limites ──────────────────────────────────────── -->
        <div v-if="activeTab === 'plano'" class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6 space-y-6">
          <h2 class="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <div class="w-1.5 h-5 bg-emerald-500 rounded-full"></div>
            Plano &amp; Limites
          </h2>

          <!-- Plan selection -->
          <div>
            <label class="field-label mb-3">Plano</label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button v-for="p in PLANS" :key="p.name" @click="form.plano.plan = p.name"
                :class="['rounded-2xl border-2 p-3 text-left transition-all',
                  form.plano.plan === p.name ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-slate-200 hover:border-slate-300']">
                <p class="font-extrabold text-sm" :class="form.plano.plan === p.name ? 'text-indigo-700' : 'text-slate-800'">{{ p.name }}</p>
                <p class="text-xs font-bold mt-0.5" :class="form.plano.plan === p.name ? 'text-indigo-500' : 'text-slate-400'">
                  {{ p.price === 0 ? 'Gratuito' : `R$ ${p.price}/mês` }}
                </p>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="field-label">Status do Plano</label>
              <select v-model="form.plano.planStatus" class="field-input">
                <option value="TRIAL">TRIAL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div>
              <label class="field-label">Trial termina em</label>
              <input v-model="form.plano.trialEndsAt" type="date" class="field-input" />
            </div>
            <div>
              <label class="field-label">Plano expira em</label>
              <input v-model="form.plano.planExpiresAt" type="date" class="field-input" />
            </div>
          </div>

          <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider pt-2">Limites Personalizados</h3>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="field-label">Máx. Usuários</label>
              <input v-model.number="form.plano.maxUsers" type="number" min="1" class="field-input" />
            </div>
            <div>
              <label class="field-label">Máx. Pedidos/mês</label>
              <input v-model.number="form.plano.maxOrders" type="number" min="1" class="field-input" />
            </div>
            <div>
              <label class="field-label">Máx. Clientes</label>
              <input v-model.number="form.plano.maxCustomers" type="number" min="1" class="field-input" />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button @click="savePlano" :disabled="saving.plano"
              class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2">
              <div v-if="saving.plano" class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {{ saving.plano ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>

        <!-- ─── Tab: Cobrança ─────────────────────────────────────────────── -->
        <div v-if="activeTab === 'cobranca'" class="space-y-4">

          <!-- Config status -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/40 shadow-xl shadow-slate-200/60 flex items-center gap-3 sm:col-span-2">
              <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', billingConfig?.configured ? 'bg-emerald-100' : 'bg-red-100']">
                <svg class="w-5 h-5" :class="billingConfig?.configured ? 'text-emerald-600' : 'text-red-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path v-if="billingConfig?.configured" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">API Key Asaas</p>
                <p class="font-extrabold" :class="billingConfig?.configured ? 'text-emerald-600' : 'text-red-500'">
                  {{ billingConfig?.configured ? `Configurada (${billingConfig?.env})` : 'Não configurada' }}
                </p>
              </div>
            </div>
            <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/40 shadow-xl shadow-slate-200/60 flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </div>
              <button @click="fetchBilling" class="text-sm font-bold text-indigo-600 hover:underline">Atualizar dados</button>
            </div>
          </div>

          <!-- Customer card -->
          <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-extrabold text-slate-800">Cliente Asaas</h3>
                <p v-if="tenant.asaasCustomerId" class="text-xs font-mono text-slate-500 mt-0.5">{{ tenant.asaasCustomerId }}</p>
                <p v-else class="text-xs text-slate-400 mt-0.5">Nenhum cliente criado</p>
              </div>
              <button v-if="!tenant.asaasCustomerId"
                @click="tenant.cpfCnpj ? createCustomer() : showAlert('warning', 'CPF/CNPJ obrigatório', 'Cadastre o CPF/CNPJ na aba Empresa antes de criar o cliente no Asaas.')"
                :disabled="billingLoading.customer"
                class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60">
                {{ billingLoading.customer ? 'Criando...' : 'Criar cliente' }}
              </button>
            </div>
            <div v-if="tenant.asaasCustomerId" class="flex items-center gap-2">
              <span class="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span class="text-sm font-bold text-emerald-700">Cadastrado no Asaas</span>
            </div>
          </div>

          <!-- Subscription card -->
          <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-extrabold text-slate-800">Assinatura</h3>
                <p v-if="tenant.asaasSubscriptionId" class="text-xs font-mono text-slate-500 mt-0.5">{{ tenant.asaasSubscriptionId }}</p>
                <p v-else class="text-xs text-slate-400 mt-0.5">Sem assinatura ativa</p>
              </div>
              <div class="flex gap-2">
                <button v-if="tenant.asaasCustomerId && tenant.plan !== 'FREE'" @click="openSubscriptionModal"
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {{ tenant.asaasSubscriptionId ? 'Alterar' : 'Assinar' }}
                </button>
                <button v-if="tenant.asaasSubscriptionId" @click="cancelSubscription"
                  :disabled="billingLoading.cancel"
                  class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl border border-red-100 transition-all disabled:opacity-60">
                  {{ billingLoading.cancel ? 'Cancelando...' : 'Cancelar' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Invoices -->
          <div v-if="tenant.asaasCustomerId" class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 class="font-extrabold text-slate-800">Faturas</h3>
              <button @click="fetchInvoices" class="text-xs text-indigo-600 font-bold hover:underline">Carregar</button>
            </div>
            <div v-if="invoicesLoading" class="px-6 py-8 text-center">
              <div class="inline-block h-5 w-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
            <div v-else-if="invoices.length === 0" class="px-6 py-8 text-center text-slate-400 text-sm italic">
              Nenhuma fatura carregada.
            </div>
            <div v-else class="divide-y divide-slate-50">
              <div v-for="inv in invoices" :key="inv.id" class="px-6 py-4 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <span :class="['px-2.5 py-0.5 rounded-full text-xs font-black', INVOICE_STATUS[inv.status] || 'bg-slate-100 text-slate-500']">{{ inv.status }}</span>
                  <span class="text-xs text-slate-500">Vence: {{ inv.dueDate }}</span>
                  <span v-if="inv.paymentDate" class="text-xs text-emerald-600 font-bold">Pago: {{ inv.paymentDate }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-extrabold text-slate-800">R$ {{ inv.value?.toFixed(2) }}</span>
                  <a v-if="inv.invoiceUrl" :href="inv.invoiceUrl" target="_blank"
                    class="text-xs text-indigo-600 font-bold hover:underline">Ver →</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── Tab: Acesso Admin ─────────────────────────────────────────── -->
        <div v-if="activeTab === 'acesso'" class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6 space-y-5">
          <h2 class="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <div class="w-1.5 h-5 bg-amber-500 rounded-full"></div>
            Acesso Admin do Tenant
          </h2>

          <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-start gap-2">
            <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Se já existe um usuário com este e-mail neste tenant, a senha será redefinida.
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="field-label">Nome</label>
              <input v-model="adminForm.name" class="field-input" placeholder="Nome do administrador" />
            </div>
            <div>
              <label class="field-label">E-mail</label>
              <input v-model="adminForm.email" type="email" class="field-input" placeholder="admin@empresa.com" />
            </div>
            <div>
              <label class="field-label">Senha (mínimo 6 caracteres)</label>
              <input v-model="adminForm.password" type="password" class="field-input" placeholder="••••••••" />
            </div>
          </div>

          <div v-if="adminResult" class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <p class="text-emerald-800 font-extrabold text-sm flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Usuário criado / atualizado com sucesso!
            </p>
            <div class="mt-2 space-y-1 text-xs text-emerald-700 font-mono bg-emerald-100/60 p-3 rounded-xl">
              <p><span class="font-bold text-emerald-900">Nome:</span> {{ adminResult.name }}</p>
              <p><span class="font-bold text-emerald-900">E-mail:</span> {{ adminResult.email }}</p>
              <p><span class="font-bold text-emerald-900">Role:</span> {{ adminResult.role }}</p>
            </div>
          </div>

          <div class="flex justify-end">
            <button @click="createAdmin" :disabled="saving.admin"
              class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2">
              <div v-if="saving.admin" class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {{ saving.admin ? 'Processando...' : 'Criar / Redefinir Acesso' }}
            </button>
          </div>
        </div>

      </template>

      <!-- Not found -->
      <div v-else class="text-center py-20 text-slate-400 font-medium italic">
        Tenant não encontrado.
      </div>
    </div>

    <!-- Modal: Ativar Assinatura -->
    <div v-if="subscriptionModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="subscriptionModal = false">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
        <h3 class="text-lg font-extrabold text-slate-800 mb-1">Ativar Assinatura</h3>
        <p class="text-sm text-slate-500 mb-5">
          Plano <strong class="text-indigo-600">{{ tenant?.plan }}</strong>
        </p>
        <div class="space-y-2 mb-5">
          <button v-for="bt in ['PIX', 'BOLETO']" :key="bt" @click="selectedBillingType = bt"
            :class="['w-full border-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all text-left',
              selectedBillingType === bt ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100' : 'border-slate-200 text-slate-700 hover:border-slate-300']">
            {{ bt === 'PIX' ? '⚡ PIX (recomendado)' : '🟦 Boleto Bancário' }}
          </button>
        </div>
        <div class="flex gap-2">
          <button @click="subscriptionModal = false" class="flex-1 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancelar</button>
          <button @click="confirmSubscription" :disabled="!selectedBillingType || billingLoading.subscription"
            class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95">
            {{ billingLoading.subscription ? 'Gerando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <AlertModal :show="alert.show" :type="alert.type" :title="alert.title" :message="alert.message" @close="alert.show = false" />
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SidebarLayout from '../components/SidebarLayout.vue'
import AlertModal from '../components/AlertModal.vue'
import { apiFetch } from '../utils/api'

const router = useRouter()
const route = useRoute()
const tenantId = Number(route.params.id)

const TABS = [
  { id: 'empresa', label: 'Empresa' },
  { id: 'plano', label: 'Plano & Limites' },
  { id: 'cobranca', label: 'Cobrança' },
  { id: 'acesso', label: 'Acesso Admin' },
]
const activeTab = ref('empresa')

const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-amber-100 text-amber-700', ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-700', CANCELLED: 'bg-slate-100 text-slate-500',
}
const INVOICE_STATUS: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700', RECEIVED: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700', OVERDUE: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-slate-100 text-slate-500',
}
const PLANS = [
  { name: 'FREE', price: 0 }, { name: 'BASIC', price: 79 },
  { name: 'PRO', price: 179 }, { name: 'ENTERPRISE', price: 349 },
]

const tenant = ref<any>(null)
const pageLoading = ref(true)
const actionLoading = ref(false)

// Forms
const form = reactive({
  empresa: {
    name: '', slug: '', razaoSocial: '', cpfCnpj: '', inscricaoEstadual: '',
    zipCode: '', address: '', number: '', complement: '', neighborhood: '', city: '', state: '',
    ownerName: '', ownerEmail: '', ownerPhone: '',
  },
  plano: {
    plan: 'FREE', planStatus: 'TRIAL',
    trialEndsAt: '', planExpiresAt: '',
    maxUsers: 1, maxOrders: 30, maxCustomers: 50,
  },
})
const saving = reactive({ empresa: false, plano: false, admin: false })

// Admin form
const adminForm = reactive({ name: '', email: '', password: '' })
const adminResult = ref<any>(null)

// Billing
const billingConfig = ref<any>(null)
const invoices = ref<any[]>([])
const invoicesLoading = ref(false)
const subscriptionModal = ref(false)
const selectedBillingType = ref('PIX')
const billingLoading = reactive({ customer: false, cancel: false, subscription: false })

// Alert
const alert = ref({ show: false, type: 'error' as 'error' | 'warning' | 'success', title: '', message: '' })
const showAlert = (type: 'error' | 'warning' | 'success', title: string, message: string) => {
  alert.value = { show: true, type, title, message }
}

const parseError = async (res: Response): Promise<string> => {
  try {
    const err = await res.json()
    const msg = err?.message || err?.error || 'Erro desconhecido'
    return Array.isArray(msg) ? msg.join(', ') : String(msg)
  } catch { return `Erro ${res.status}` }
}

// Populate forms from tenant data
const populateForms = (t: any) => {
  form.empresa.name = t.name || ''
  form.empresa.slug = t.slug || ''
  form.empresa.razaoSocial = t.razaoSocial || ''
  form.empresa.cpfCnpj = t.cpfCnpj || ''
  form.empresa.inscricaoEstadual = t.inscricaoEstadual || ''
  form.empresa.zipCode = t.zipCode || ''
  form.empresa.address = t.address || ''
  form.empresa.number = t.number || ''
  form.empresa.complement = t.complement || ''
  form.empresa.neighborhood = t.neighborhood || ''
  form.empresa.city = t.city || ''
  form.empresa.state = t.state || ''
  form.empresa.ownerName = t.ownerName || ''
  form.empresa.ownerEmail = t.ownerEmail || ''
  form.empresa.ownerPhone = t.ownerPhone || ''

  form.plano.plan = t.plan || 'FREE'
  form.plano.planStatus = t.planStatus || 'TRIAL'
  form.plano.trialEndsAt = t.trialEndsAt ? t.trialEndsAt.split('T')[0] : ''
  form.plano.planExpiresAt = t.planExpiresAt ? t.planExpiresAt.split('T')[0] : ''
  form.plano.maxUsers = t.maxUsers ?? 1
  form.plano.maxOrders = t.maxOrders ?? 30
  form.plano.maxCustomers = t.maxCustomers ?? 50
}

const fetchTenant = async () => {
  pageLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}`)
    if (res.ok) {
      tenant.value = await res.json()
      populateForms(tenant.value)
    } else {
      tenant.value = null
    }
  } finally {
    pageLoading.value = false
  }
}

const fetchBilling = async () => {
  const res = await apiFetch('/api/billing/config')
  if (res.ok) billingConfig.value = await res.json()
}

const fetchInvoices = async () => {
  invoicesLoading.value = true
  invoices.value = []
  try {
    const res = await apiFetch(`/api/billing/invoices/${tenantId}`)
    if (res.ok) invoices.value = await res.json()
    else showAlert('error', 'Erro ao carregar faturas', await parseError(res))
  } finally {
    invoicesLoading.value = false
  }
}

const saveEmpresa = async () => {
  saving.empresa = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.empresa),
    })
    if (res.ok) {
      tenant.value = { ...tenant.value, ...form.empresa }
      showAlert('success', 'Salvo!', 'Dados da empresa atualizados com sucesso.')
    } else {
      showAlert('error', 'Erro ao salvar', await parseError(res))
    }
  } finally {
    saving.empresa = false
  }
}

const savePlano = async () => {
  saving.plano = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.plano),
    })
    if (res.ok) {
      tenant.value = { ...tenant.value, ...form.plano }
      showAlert('success', 'Salvo!', 'Plano atualizado com sucesso.')
    } else {
      showAlert('error', 'Erro ao salvar', await parseError(res))
    }
  } finally {
    saving.plano = false
  }
}

const createAdmin = async () => {
  if (!adminForm.name || !adminForm.email || !adminForm.password) {
    showAlert('warning', 'Campos obrigatórios', 'Preencha nome, e-mail e senha.')
    return
  }
  saving.admin = true
  adminResult.value = null
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/admin-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminForm),
    })
    if (res.ok) {
      adminResult.value = await res.json()
    } else {
      showAlert('error', 'Erro ao criar usuário', await parseError(res))
    }
  } finally {
    saving.admin = false
  }
}

const suspendTenant = async () => {
  actionLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/suspend`, { method: 'PATCH' })
    if (res.ok) {
      await fetchTenant()
      showAlert('success', 'Suspenso', 'Tenant suspenso com sucesso.')
    } else {
      showAlert('error', 'Erro', await parseError(res))
    }
  } finally {
    actionLoading.value = false
  }
}

const activateTenant = async () => {
  actionLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/activate`, { method: 'PATCH' })
    if (res.ok) {
      await fetchTenant()
      showAlert('success', 'Reativado', 'Tenant reativado com sucesso.')
    } else {
      showAlert('error', 'Erro', await parseError(res))
    }
  } finally {
    actionLoading.value = false
  }
}

const createCustomer = async () => {
  billingLoading.customer = true
  try {
    const res = await apiFetch(`/api/billing/customers/${tenantId}`, { method: 'POST' })
    if (res.ok) {
      await fetchTenant()
      showAlert('success', 'Cliente criado!', 'Cliente Asaas criado com sucesso.')
    } else {
      showAlert('error', 'Erro ao criar cliente', await parseError(res))
    }
  } finally {
    billingLoading.customer = false
  }
}

const openSubscriptionModal = () => {
  selectedBillingType.value = 'PIX'
  subscriptionModal.value = true
}

const confirmSubscription = async () => {
  billingLoading.subscription = true
  try {
    const res = await apiFetch(`/api/billing/subscriptions/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingType: selectedBillingType.value }),
    })
    if (res.ok) {
      subscriptionModal.value = false
      await fetchTenant()
      showAlert('success', 'Assinatura ativada!', `Assinatura ${selectedBillingType.value} criada com sucesso.`)
    } else {
      showAlert('error', 'Erro na Assinatura', await parseError(res))
    }
  } finally {
    billingLoading.subscription = false
  }
}

const cancelSubscription = async () => {
  billingLoading.cancel = true
  try {
    const res = await apiFetch(`/api/billing/subscriptions/${tenantId}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchTenant()
      showAlert('success', 'Cancelada', 'Assinatura cancelada com sucesso.')
    } else {
      showAlert('error', 'Erro ao cancelar', await parseError(res))
    }
  } finally {
    billingLoading.cancel = false
  }
}

onMounted(async () => {
  await fetchTenant()
  fetchBilling()
})
</script>

<style scoped>
@reference "tailwindcss";

.field-label {
  @apply block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5;
}
.field-input {
  @apply w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-800 font-medium text-sm;
}
</style>
