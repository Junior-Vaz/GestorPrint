<template>
  <SidebarLayout>
    <div class="p-6 max-w-7xl mx-auto space-y-5">

      <!-- Header -->
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-[11px] font-mono text-slate-400 uppercase tracking-[0.18em]">
            {{ activePlans.length }} ativo{{ activePlans.length !== 1 ? 's' : '' }} de {{ plans.length }}
          </p>
          <h1 class="text-[22px] font-medium text-slate-900 mt-0.5 tracking-tight">Planos</h1>
        </div>
        <div class="flex gap-2">
          <button @click="load" :disabled="loading"
            class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors">
            <svg class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Atualizar
          </button>
          <button @click="openCreate"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Novo plano
          </button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="bg-white border border-slate-200 rounded-md p-4">
          <p class="text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Planos ativos</p>
          <p class="text-2xl font-medium text-slate-900 mt-1.5 tabular-nums">{{ activePlans.length }}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">de {{ plans.length }} cadastrados</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-md p-4">
          <p class="text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Mais popular</p>
          <p class="text-base font-medium text-slate-900 truncate mt-1.5">{{ mostPopular?.displayName || '—' }}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">{{ mostPopularCount }} tenants</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-md p-4">
          <p class="text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">MRR potencial</p>
          <p class="text-2xl font-medium text-emerald-700 mt-1.5 tabular-nums">
            R$ {{ mrrPotential.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) }}
          </p>
          <p class="text-[11px] text-slate-400 mt-0.5">soma de todos os planos</p>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/50">
                <th class="text-left text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em] px-5 py-2.5">Plano</th>
                <th class="text-left text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em] px-4 py-2.5">Preço</th>
                <th class="text-left text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em] px-4 py-2.5">Limites</th>
                <th class="text-left text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em] px-4 py-2.5">Módulos</th>
                <th class="text-left text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em] px-4 py-2.5">Status</th>
                <th class="text-right text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em] px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="px-5 py-12 text-center text-xs text-slate-400">
                  <div class="inline-flex items-center gap-2">
                    <div class="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
                    Carregando planos...
                  </div>
                </td>
              </tr>
              <tr v-else-if="plans.length === 0">
                <td colspan="6" class="px-5 py-12 text-center text-xs text-slate-400">
                  Nenhum plano encontrado.
                </td>
              </tr>
              <tr v-for="plan in plans" :key="plan.id"
                class="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                <td class="px-5 py-3">
                  <div class="flex items-center gap-3">
                    <span :class="['inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider', planBadgeClass(plan.name)]">
                      {{ plan.name }}
                    </span>
                    <div>
                      <p class="text-sm font-medium text-slate-900">{{ plan.displayName }}</p>
                      <p v-if="plan.description" class="text-[11px] text-slate-400 truncate max-w-48 mt-0.5">{{ plan.description }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm font-medium text-slate-900 tabular-nums">
                    {{ plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toLocaleString('pt-BR')}/mês` }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="text-[11px] text-slate-500 space-y-0.5 font-mono">
                    <p>{{ formatLimit(plan.maxUsers) }} users</p>
                    <p>{{ formatLimit(plan.maxOrders) }} orders/mo</p>
                    <p>{{ formatLimit(plan.maxCustomers) }} customers</p>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1 max-w-xs">
                    <span v-if="plan.hasPdf" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">pdf</span>
                    <span v-if="plan.hasReports" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">rel</span>
                    <span v-if="plan.hasKanban" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">kanban</span>
                    <span v-if="plan.hasFileUpload" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">upload</span>
                    <span v-if="plan.hasWhatsapp" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">whatsapp</span>
                    <span v-if="plan.hasPix" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">pix</span>
                    <span v-if="plan.hasAudit" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">audit</span>
                    <span v-if="plan.hasCommissions" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">comis</span>
                    <span v-if="plan.hasApiAccess" class="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono uppercase rounded">api</span>
                    <span v-if="!anyFeature(plan)" class="text-[11px] text-slate-300">—</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span :class="plan.isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'"
                    class="inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider">
                    {{ plan.isActive ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button @click="openEdit(plan)"
                      class="px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded transition-colors">
                      Editar
                    </button>
                    <button @click="toggleActive(plan)"
                      :class="plan.isActive
                        ? 'text-slate-600 border-slate-200 hover:bg-slate-50'
                        : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'"
                      class="px-2.5 py-1 text-[11px] font-medium border rounded transition-colors">
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
          class="fixed inset-0 bg-slate-900/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
          @click.self="showModal = false">
          <div class="bg-white rounded-md border border-slate-200 shadow-xl w-full max-w-2xl my-6">

            <!-- Modal Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p class="text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Plataforma · Planos</p>
                <h2 class="text-sm font-medium text-slate-900 mt-0.5">
                  {{ editingId ? 'Editar plano' : 'Novo plano' }}
                </h2>
              </div>
              <button @click="showModal = false" class="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Tabs do modal — separa Identificação, Limites e Módulos pra reduzir scroll -->
            <div class="flex gap-0 border-b border-slate-200 px-5">
              <button v-for="tab in PLAN_TABS" :key="tab.id" @click="planTab = tab.id"
                :class="['px-3 py-2.5 text-xs font-medium transition-colors -mb-px border-b-2',
                  planTab === tab.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900']">
                {{ tab.label }}
                <span v-if="tab.id === 'modulos'" class="ml-1 text-[10px] font-mono text-slate-400">
                  {{ activeModulesCount }}/{{ FEATURES.length }}
                </span>
              </button>
            </div>

            <div class="px-5 py-5 space-y-5">

              <!-- Tab: Identificação -->
              <div v-if="planTab === 'identificacao'">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Identificador</label>
                    <input v-model="form.name" :readonly="!!editingId" type="text"
                      placeholder="FREE, BASIC, PRO..."
                      :class="editingId ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white'"
                      class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs font-mono uppercase tracking-wide focus:outline-none focus:border-slate-400 transition-colors"/>
                  </div>
                  <div>
                    <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Nome de exibição</label>
                    <input v-model="form.displayName" type="text" placeholder="Ex: Profissional"
                      class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors"/>
                  </div>
                  <div class="col-span-2">
                    <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Descrição (opcional)</label>
                    <textarea v-model="form.description" rows="2" placeholder="Breve descrição do plano..."
                      class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs resize-none focus:outline-none focus:border-slate-400 transition-colors"></textarea>
                  </div>
                  <div>
                    <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Preço (R$/mês)</label>
                    <input v-model.number="form.price" type="number" min="0" step="1" placeholder="0"
                      class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors"/>
                  </div>
                  <div>
                    <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Ordem de exibição</label>
                    <input v-model.number="form.sortOrder" type="number" min="0" placeholder="0"
                      class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors"/>
                  </div>
                  <div class="col-span-2 flex items-center gap-2 pt-1">
                    <input v-model="form.isActive" type="checkbox" id="isActive"
                      class="w-3.5 h-3.5 rounded accent-slate-900"/>
                    <label for="isActive" class="text-xs text-slate-700 cursor-pointer">Plano ativo (visível para novos tenants)</label>
                  </div>
                </div>
              </div>

              <!-- Tab: Limites -->
              <div v-if="planTab === 'limites'">
                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Máx. usuários</label>
                    <input v-model.number="form.maxUsers" type="number" min="1" placeholder="1"
                      class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors"/>
                    <p class="text-[10px] text-slate-400 mt-0.5 font-mono">99999 = ilimitado</p>
                  </div>
                  <div>
                    <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Máx. pedidos/mês</label>
                    <input v-model.number="form.maxOrders" type="number" min="1" placeholder="30"
                      class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors"/>
                    <p class="text-[10px] text-slate-400 mt-0.5 font-mono">99999 = ilimitado</p>
                  </div>
                  <div>
                    <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Máx. clientes</label>
                    <input v-model.number="form.maxCustomers" type="number" min="1" placeholder="50"
                      class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors"/>
                    <p class="text-[10px] text-slate-400 mt-0.5 font-mono">99999 = ilimitado</p>
                  </div>
                </div>
              </div>

              <!-- Tab: Módulos -->
              <div v-if="planTab === 'modulos'">
                <!-- Agrupa por seção pra ficar mais legível com 16 features -->
                <div v-for="group in featureGroups" :key="group.name" class="mb-3 last:mb-0">
                  <p class="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">{{ group.name }}</p>
                  <div class="grid grid-cols-2 gap-2">
                    <label v-for="feat in group.items" :key="feat.key"
                      class="flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors hover:bg-slate-50"
                      :class="(form as Record<string, unknown>)[feat.key] ? 'border-slate-900 bg-slate-50' : 'border-slate-200'">
                      <input type="checkbox" v-model="(form as Record<string, unknown>)[feat.key]" class="w-3.5 h-3.5 rounded accent-slate-900 shrink-0"/>
                      <div class="min-w-0">
                        <p class="text-xs font-medium text-slate-800">{{ feat.label }}</p>
                        <p class="text-[10px] text-slate-400 truncate">{{ feat.desc }}</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button @click="showModal = false"
                class="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Cancelar
              </button>
              <button @click="save" :disabled="saving"
                class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors">
                <span v-if="saving" class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                {{ saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar plano' }}
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
  // Operacionais
  hasPdf: boolean
  hasReports: boolean
  hasKanban: boolean
  hasFileUpload: boolean
  // Integrações
  hasWhatsapp: boolean
  hasPix: boolean
  // Tipos de orçamento
  hasPlotterEstimate: boolean
  hasCuttingEstimate: boolean
  hasEmbroideryEstimate: boolean
  // Gestão avançada
  hasAudit: boolean
  hasCommissions: boolean
  hasApiAccess: boolean
  hasReceivables: boolean
  // Ecommerce / Loja online
  hasEcommerce: boolean
  hasMpCard: boolean
  hasMelhorEnvios: boolean
  // Programa de Fidelidade — pontos, cashback, tiers, aniversário, indicação
  hasLoyalty: boolean
  isActive: boolean
  sortOrder: number
}

// Lista organizada por área. A ordem aqui é a ordem que aparece no modal de
// edição — agrupar features relacionadas ajuda o admin a configurar planos.
const FEATURES = [
  // ── Operacionais ────────────────────────────────────────────────────────
  { key: 'hasPdf',         group: 'Operacionais', label: 'PDF de orçamentos/pedidos',  desc: 'Gerar PDF de orçamentos e recibos' },
  { key: 'hasReports',     group: 'Operacionais', label: 'Relatórios financeiros',     desc: 'Receita, despesas e lucro' },
  { key: 'hasKanban',      group: 'Operacionais', label: 'Fila de produção (Kanban)',  desc: 'Board de status de pedidos' },
  { key: 'hasFileUpload',  group: 'Operacionais', label: 'Upload de arquivos gráficos', desc: 'Anexar .cdr, .psd, .svg, etc.' },
  // ── Tipos de orçamento ──────────────────────────────────────────────────
  { key: 'hasPlotterEstimate',    group: 'Orçamento', label: 'Orçamento impressão plotter', desc: 'Por área m² com materiais' },
  { key: 'hasCuttingEstimate',    group: 'Orçamento', label: 'Orçamento recorte',           desc: 'Máquinas de recorte' },
  { key: 'hasEmbroideryEstimate', group: 'Orçamento', label: 'Orçamento estamparia',        desc: 'Bordado e estamparia' },
  // ── Gestão avançada ─────────────────────────────────────────────────────
  { key: 'hasAudit',       group: 'Gestão', label: 'Auditoria de ações',     desc: 'Log de todas as ações dos usuários' },
  { key: 'hasCommissions', group: 'Gestão', label: 'Comissões por vendedor', desc: 'Controle de comissões' },
  { key: 'hasReceivables', group: 'Gestão', label: 'Contas a receber',       desc: 'Recebíveis com vencimentos e baixas' },
  { key: 'hasApiAccess',   group: 'Gestão', label: 'Acesso à API / webhooks', desc: 'Integração externa via API' },
  // ── Integrações ─────────────────────────────────────────────────────────
  { key: 'hasWhatsapp',    group: 'Integrações', label: 'IA (Chat ERP + WhatsApp)', desc: 'Assistente IA no ERP + agente de atendimento WhatsApp. Multi-provider (Google, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter, Ollama).' },
  { key: 'hasPix',         group: 'Integrações', label: 'PIX Mercado Pago',      desc: 'Cobranças PIX integradas' },
  // ── Ecommerce ───────────────────────────────────────────────────────────
  { key: 'hasEcommerce',     group: 'Ecommerce', label: 'Loja online',                desc: 'Catálogo, pedidos, cupons, blog, reviews' },
  { key: 'hasMpCard',        group: 'Ecommerce', label: 'Cartão Mercado Pago',        desc: 'Card Brick PCI-compliant' },
  { key: 'hasMelhorEnvios',  group: 'Ecommerce', label: 'Frete Melhor Envios',        desc: 'Cálculo de frete + compra de etiquetas' },
  // ── Engajamento ─────────────────────────────────────────────────────────
  { key: 'hasLoyalty',       group: 'Engajamento', label: 'Programa de Fidelidade',   desc: 'Pontos por compra, cashback, tiers (Bronze/Prata/Ouro/Platina), cupom de aniversário automático e indicação' },
]

const plans = ref<PlanConfig[]>([])
const loading = ref(false)
const showModal = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

// Tabs do modal — separa o formulão grande em 3 visões focadas
const PLAN_TABS = [
  { id: 'identificacao', label: 'Identificação' },
  { id: 'limites',       label: 'Limites' },
  { id: 'modulos',       label: 'Módulos' },
] as const
type PlanTabId = typeof PLAN_TABS[number]['id']
const planTab = ref<PlanTabId>('identificacao')

const alert = reactive({ show: false, type: 'error' as 'error' | 'warning' | 'success', title: '', message: '' })

function showAlert(type: 'error' | 'warning' | 'success', title: string, message: string) {
  alert.type = type; alert.title = title; alert.message = message; alert.show = true
}

const emptyForm = () => ({
  name: '', displayName: '', description: '',
  price: 0, maxUsers: 1, maxOrders: 30, maxCustomers: 50,
  hasPdf: false, hasReports: false, hasKanban: false, hasFileUpload: false,
  hasWhatsapp: false, hasPix: false, hasAudit: false, hasCommissions: false, hasApiAccess: false,
  hasReceivables: false,
  hasPlotterEstimate: false, hasCuttingEstimate: false, hasEmbroideryEstimate: false,
  hasEcommerce: false, hasMpCard: false, hasMelhorEnvios: false,
  hasLoyalty: false,
  isActive: true, sortOrder: 0,
})

const form = reactive(emptyForm())

// ── Computed ─────────────────────────────────────────────────────────────────

const activePlans = computed(() => plans.value.filter(p => p.isActive))

// Agrupa FEATURES pelo campo `group` preservando a ordem de declaração
const featureGroups = computed(() => {
  const order: string[] = []
  const map = new Map<string, typeof FEATURES>()
  for (const f of FEATURES) {
    if (!map.has(f.group)) { order.push(f.group); map.set(f.group, [] as any) }
    map.get(f.group)!.push(f)
  }
  return order.map(name => ({ name, items: map.get(name)! }))
})

const mostPopular = computed(() => {
  // This would need tenant counts — for now return the plan with lowest price > 0
  return activePlans.value.filter(p => p.price > 0)[0] ?? null
})
const mostPopularCount = computed(() => 0) // will be enriched later if API returns counts

const mrrPotential = computed(() => {
  return plans.value.reduce((sum, p) => sum + p.price, 0)
})

// Conta quantos módulos estão ativos no formulário (pra mostrar no badge da tab)
const activeModulesCount = computed(() =>
  FEATURES.filter(f => (form as Record<string, unknown>)[f.key]).length,
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function planBadgeClass(name: string) {
  const map: Record<string, string> = {
    FREE:       'bg-slate-100 text-slate-600',
    BASIC:      'bg-blue-50 text-blue-700',
    PRO:        'bg-indigo-50 text-indigo-700',
    ENTERPRISE: 'bg-violet-50 text-violet-700',
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
  planTab.value = 'identificacao'
  showModal.value = true
}

function openEdit(plan: PlanConfig) {
  Object.assign(form, { ...plan })
  editingId.value = plan.id
  planTab.value = 'identificacao'
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
      // Operacionais
      hasPdf: form.hasPdf, hasReports: form.hasReports, hasKanban: form.hasKanban,
      hasFileUpload: form.hasFileUpload,
      // Integrações
      hasWhatsapp: form.hasWhatsapp, hasPix: form.hasPix,
      // Tipos de orçamento
      hasPlotterEstimate: form.hasPlotterEstimate, hasCuttingEstimate: form.hasCuttingEstimate,
      hasEmbroideryEstimate: form.hasEmbroideryEstimate,
      // Gestão avançada
      hasAudit: form.hasAudit, hasCommissions: form.hasCommissions, hasApiAccess: form.hasApiAccess,
      hasReceivables: form.hasReceivables,
      // Ecommerce
      hasEcommerce: form.hasEcommerce, hasMpCard: form.hasMpCard, hasMelhorEnvios: form.hasMelhorEnvios,
      // Engajamento
      hasLoyalty: form.hasLoyalty,
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
