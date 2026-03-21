<template>
  <SidebarLayout>
    <div class="space-y-6">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-extrabold text-slate-800 tracking-tight">Gestão de Planos</h1>
            <p class="text-slate-400 text-sm font-medium italic">Configure módulos e limites de cada plano</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="load" :disabled="loading"
            class="flex items-center gap-2 px-4 py-2 bg-white/80 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-white transition-all shadow-sm disabled:opacity-50">
            <svg class="w-4 h-4" :class="loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Atualizar
          </button>
          <button @click="openCreate"
            class="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-200 active:scale-95">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
            </svg>
            Novo Plano
          </button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg shadow-slate-100/60 p-5">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Planos Ativos</p>
          <p class="text-3xl font-extrabold text-slate-800">{{ activePlans.length }}</p>
          <p class="text-xs text-slate-400 mt-0.5">de {{ plans.length }} cadastrados</p>
        </div>
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg shadow-slate-100/60 p-5">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mais Popular</p>
          <p class="text-xl font-extrabold text-slate-800 truncate">{{ mostPopular?.displayName || '—' }}</p>
          <p class="text-xs text-slate-400 mt-0.5">{{ mostPopularCount }} tenants</p>
        </div>
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg shadow-slate-100/60 p-5">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">MRR Potencial</p>
          <p class="text-3xl font-extrabold text-emerald-600">
            R$ {{ mrrPotential.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) }}
          </p>
          <p class="text-xs text-slate-400 mt-0.5">baseado em tenants ativos</p>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100">
                <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-wider px-6 py-4">Plano</th>
                <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-4">Preço</th>
                <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-4">Limites</th>
                <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-4">Módulos</th>
                <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-4">Status</th>
                <th class="text-right text-xs font-bold text-slate-400 uppercase tracking-wider px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-if="loading">
                <td colspan="6" class="px-6 py-12 text-center text-slate-400 font-medium">
                  <div class="inline-flex items-center gap-2">
                    <div class="w-4 h-4 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin"></div>
                    Carregando planos...
                  </div>
                </td>
              </tr>
              <tr v-else-if="plans.length === 0">
                <td colspan="6" class="px-6 py-12 text-center text-slate-400 font-medium">
                  Nenhum plano encontrado.
                </td>
              </tr>
              <tr v-for="plan in plans" :key="plan.id"
                class="hover:bg-slate-50/80 transition-colors group">
                <!-- Plano -->
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <span :class="['px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide', planBadgeClass(plan.name)]">
                      {{ plan.name }}
                    </span>
                    <div>
                      <p class="font-bold text-slate-800 text-sm">{{ plan.displayName }}</p>
                      <p v-if="plan.description" class="text-xs text-slate-400 truncate max-w-48">{{ plan.description }}</p>
                    </div>
                  </div>
                </td>
                <!-- Preço -->
                <td class="px-4 py-4">
                  <span class="font-extrabold text-slate-800">
                    {{ plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toLocaleString('pt-BR')}/mês` }}
                  </span>
                </td>
                <!-- Limites -->
                <td class="px-4 py-4">
                  <div class="text-xs text-slate-500 space-y-0.5">
                    <p>{{ formatLimit(plan.maxUsers) }} usuários</p>
                    <p>{{ formatLimit(plan.maxOrders) }} pedidos/mês</p>
                    <p>{{ formatLimit(plan.maxCustomers) }} clientes</p>
                  </div>
                </td>
                <!-- Módulos -->
                <td class="px-4 py-4">
                  <div class="flex flex-wrap gap-1">
                    <span v-if="plan.hasPdf" class="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-md">PDF</span>
                    <span v-if="plan.hasReports" class="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-semibold rounded-md">Rel.</span>
                    <span v-if="plan.hasKanban" class="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-md">Kanban</span>
                    <span v-if="plan.hasFileUpload" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md">Upload</span>
                    <span v-if="plan.hasWhatsapp" class="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-md">WhatsApp</span>
                    <span v-if="plan.hasPix" class="px-1.5 py-0.5 bg-teal-50 text-teal-600 text-xs font-semibold rounded-md">PIX</span>
                    <span v-if="plan.hasAudit" class="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-xs font-semibold rounded-md">Audit</span>
                    <span v-if="plan.hasCommissions" class="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs font-semibold rounded-md">Comis.</span>
                    <span v-if="plan.hasApiAccess" class="px-1.5 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-md">API</span>
                    <span v-if="!anyFeature(plan)" class="text-xs text-slate-300 italic">Nenhum módulo</span>
                  </div>
                </td>
                <!-- Status -->
                <td class="px-4 py-4">
                  <span :class="plan.isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'"
                    class="px-2.5 py-1 rounded-full text-xs font-bold">
                    {{ plan.isActive ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <!-- Ações -->
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button @click="openEdit(plan)"
                      class="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      Editar
                    </button>
                    <button @click="toggleActive(plan)"
                      :class="plan.isActive
                        ? 'text-slate-500 bg-slate-50 hover:bg-slate-100'
                        : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'"
                      class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors">
                      {{ plan.isActive ? 'Desativar' : 'Ativar' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Modal Criar / Editar ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showModal"
          class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
          @click.self="showModal = false">
          <div class="bg-white/95 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl w-full max-w-2xl my-6">

            <!-- Modal Header -->
            <div class="flex items-center justify-between px-8 pt-8 pb-6 border-b border-slate-100">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
                  </svg>
                </div>
                <h2 class="text-lg font-extrabold text-slate-800">
                  {{ editingId ? 'Editar Plano' : 'Novo Plano' }}
                </h2>
              </div>
              <button @click="showModal = false" class="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div class="px-8 py-6 space-y-6">

              <!-- Seção 1: Identificação -->
              <div>
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Identificação</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Identificador (ex: PRO)</label>
                    <input v-model="form.name" :readonly="!!editingId" type="text"
                      placeholder="FREE, BASIC, PRO..."
                      :class="editingId ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white'"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Nome de Exibição</label>
                    <input v-model="form.displayName" type="text" placeholder="Ex: Profissional"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div class="col-span-2">
                    <label class="block text-xs font-bold text-slate-600 mb-1">Descrição (opcional)</label>
                    <textarea v-model="form.description" rows="2" placeholder="Breve descrição do plano..."
                      class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"></textarea>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Preço (R$/mês)</label>
                    <input v-model.number="form.price" type="number" min="0" step="1" placeholder="0"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Ordem de Exibição</label>
                    <input v-model.number="form.sortOrder" type="number" min="0" placeholder="0"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div class="col-span-2 flex items-center gap-2">
                    <input v-model="form.isActive" type="checkbox" id="isActive"
                      class="w-4 h-4 rounded accent-blue-500"/>
                    <label for="isActive" class="text-sm font-semibold text-slate-700 cursor-pointer">Plano ativo (visível para novos tenants)</label>
                  </div>
                </div>
              </div>

              <!-- Seção 2: Limites Numéricos -->
              <div>
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Limites Numéricos</h3>
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Máx. Usuários</label>
                    <input v-model.number="form.maxUsers" type="number" min="1" placeholder="1"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    <p class="text-xs text-slate-400 mt-0.5">99999 = ilimitado</p>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Máx. Pedidos/mês</label>
                    <input v-model.number="form.maxOrders" type="number" min="1" placeholder="30"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    <p class="text-xs text-slate-400 mt-0.5">99999 = ilimitado</p>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">Máx. Clientes</label>
                    <input v-model.number="form.maxCustomers" type="number" min="1" placeholder="50"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    <p class="text-xs text-slate-400 mt-0.5">99999 = ilimitado</p>
                  </div>
                </div>
              </div>

              <!-- Seção 3: Módulos -->
              <div>
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Módulos Disponíveis</h3>
                <div class="grid grid-cols-2 gap-3">
                  <label v-for="feat in FEATURES" :key="feat.key"
                    class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-slate-50"
                    :class="form[feat.key] ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200'">
                    <input type="checkbox" v-model="form[feat.key]" class="w-4 h-4 rounded accent-blue-500 shrink-0"/>
                    <div>
                      <p class="text-sm font-semibold text-slate-700">{{ feat.label }}</p>
                      <p class="text-xs text-slate-400">{{ feat.desc }}</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-8 pb-8 flex gap-3 justify-end">
              <button @click="showModal = false"
                class="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Cancelar
              </button>
              <button @click="save" :disabled="saving"
                class="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-95">
                <div v-if="saving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {{ saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Plano' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- AlertModal -->
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
import { ref, computed, onMounted, reactive } from 'vue'
import SidebarLayout from '../components/SidebarLayout.vue'
import AlertModal from '../components/AlertModal.vue'
import { apiFetch } from '../utils/api'

interface PlanConfig {
  id: number
  name: string
  displayName: string
  description?: string
  price: number
  maxUsers: number
  maxOrders: number
  maxCustomers: number
  hasPdf: boolean
  hasReports: boolean
  hasKanban: boolean
  hasFileUpload: boolean
  hasWhatsapp: boolean
  hasPix: boolean
  hasAudit: boolean
  hasCommissions: boolean
  hasApiAccess: boolean
  isActive: boolean
  sortOrder: number
}

const FEATURES = [
  { key: 'hasPdf',         label: 'PDF de Orçamentos/Pedidos', desc: 'Gerar PDF de orçamentos e recibos' },
  { key: 'hasWhatsapp',    label: 'WhatsApp AI (Gemini)',       desc: 'Agente de atendimento via WhatsApp' },
  { key: 'hasReports',     label: 'Relatórios Financeiros',     desc: 'Relatórios de receita, despesas e lucro' },
  { key: 'hasPix',         label: 'PIX Mercado Pago',           desc: 'Cobranças PIX integradas' },
  { key: 'hasKanban',      label: 'Fila de Produção (Kanban)',  desc: 'Board de status de pedidos' },
  { key: 'hasAudit',       label: 'Auditoria de Ações',         desc: 'Log de todas as ações dos usuários' },
  { key: 'hasFileUpload',  label: 'Upload Arquivos Gráficos',   desc: 'Anexar .cdr, .psd, .svg, etc.' },
  { key: 'hasCommissions', label: 'Comissões por Vendedor',     desc: 'Controle de comissões de vendedores' },
  { key: 'hasApiAccess',   label: 'Acesso à API / Webhooks',    desc: 'Integração externa via API' },
]

const plans = ref<PlanConfig[]>([])
const loading = ref(false)
const showModal = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

const alert = reactive({ show: false, type: 'error' as 'error' | 'warning' | 'success', title: '', message: '' })

function showAlert(type: 'error' | 'warning' | 'success', title: string, message: string) {
  alert.type = type; alert.title = title; alert.message = message; alert.show = true
}

const emptyForm = () => ({
  name: '', displayName: '', description: '',
  price: 0, maxUsers: 1, maxOrders: 30, maxCustomers: 50,
  hasPdf: false, hasReports: false, hasKanban: false, hasFileUpload: false,
  hasWhatsapp: false, hasPix: false, hasAudit: false, hasCommissions: false, hasApiAccess: false,
  isActive: true, sortOrder: 0,
})

const form = reactive(emptyForm())

// ── Computed ─────────────────────────────────────────────────────────────────

const activePlans = computed(() => plans.value.filter(p => p.isActive))

const mostPopular = computed(() => {
  // This would need tenant counts — for now return the plan with lowest price > 0
  return activePlans.value.filter(p => p.price > 0)[0] ?? null
})
const mostPopularCount = computed(() => 0) // will be enriched later if API returns counts

const mrrPotential = computed(() => {
  return plans.value.reduce((sum, p) => sum + p.price, 0)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function planBadgeClass(name: string) {
  const map: Record<string, string> = {
    FREE:       'bg-slate-100 text-slate-600',
    BASIC:      'bg-blue-100 text-blue-700',
    PRO:        'bg-indigo-100 text-indigo-700',
    ENTERPRISE: 'bg-purple-100 text-purple-700',
  }
  return map[name] ?? 'bg-slate-100 text-slate-600'
}

function formatLimit(v: number) {
  return v >= 99999 ? '∞' : v.toLocaleString('pt-BR')
}

function anyFeature(plan: PlanConfig) {
  return FEATURES.some(f => plan[f.key as keyof PlanConfig])
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  try {
    const res = await apiFetch('/api/plans')
    if (res.ok) plans.value = await res.json()
  } catch {
    showAlert('error', 'Erro de conexão', 'Não foi possível carregar os planos.')
  } finally {
    loading.value = false
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openCreate() {
  Object.assign(form, emptyForm())
  editingId.value = null
  showModal.value = true
}

function openEdit(plan: PlanConfig) {
  Object.assign(form, { ...plan })
  editingId.value = plan.id
  showModal.value = true
}

async function save() {
  if (!form.name.trim() || !form.displayName.trim()) {
    showAlert('warning', 'Campos obrigatórios', 'Preencha o identificador e o nome de exibição.')
    return
  }
  saving.value = true
  try {
    const url = editingId.value ? `/api/plans/${editingId.value}` : '/api/plans'
    const method = editingId.value ? 'PATCH' : 'POST'

    const payload: Record<string, unknown> = {
      displayName: form.displayName,
      description: form.description || undefined,
      price: form.price,
      maxUsers: form.maxUsers,
      maxOrders: form.maxOrders,
      maxCustomers: form.maxCustomers,
      hasPdf: form.hasPdf, hasReports: form.hasReports, hasKanban: form.hasKanban,
      hasFileUpload: form.hasFileUpload, hasWhatsapp: form.hasWhatsapp, hasPix: form.hasPix,
      hasAudit: form.hasAudit, hasCommissions: form.hasCommissions, hasApiAccess: form.hasApiAccess,
      isActive: form.isActive, sortOrder: form.sortOrder,
    }
    if (!editingId.value) payload.name = form.name.toUpperCase().trim()

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err?.message || (Array.isArray(err?.message) ? err.message.join(', ') : 'Erro ao salvar plano')
      showAlert('error', 'Erro ao salvar', Array.isArray(msg) ? msg.join(', ') : msg)
      return
    }
    showAlert('success', 'Plano salvo!', `O plano "${form.displayName}" foi ${editingId.value ? 'atualizado' : 'criado'} com sucesso.`)
    showModal.value = false
    await load()
  } catch {
    showAlert('error', 'Erro de conexão', 'Não foi possível salvar o plano.')
  } finally {
    saving.value = false
  }
}

async function toggleActive(plan: PlanConfig) {
  if (plan.isActive) {
    // Deactivate
    const res = await apiFetch(`/api/plans/${plan.id}`, { method: 'DELETE' })
    if (res.ok) {
      showAlert('success', 'Plano desativado', `O plano "${plan.displayName}" foi desativado.`)
      await load()
    } else {
      const err = await res.json().catch(() => ({}))
      showAlert('error', 'Erro ao desativar', err?.message || 'Não foi possível desativar o plano.')
    }
  } else {
    // Activate via PATCH
    const res = await apiFetch(`/api/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    if (res.ok) {
      showAlert('success', 'Plano ativado', `O plano "${plan.displayName}" foi reativado.`)
      await load()
    } else {
      showAlert('error', 'Erro ao ativar', 'Não foi possível ativar o plano.')
    }
  }
}

onMounted(load)
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active > div, .modal-fade-leave-active > div { transition: transform 0.2s ease; }
.modal-fade-enter-from > div { transform: scale(0.97) translateY(8px); }
.modal-fade-leave-to > div { transform: scale(0.97) translateY(8px); }
</style>
