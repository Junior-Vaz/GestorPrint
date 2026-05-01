<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref, computed } from 'vue'
import AppBoard from './components/AppBoard.vue'
import EstimatesServiceView    from './views/estimates/EstimatesServiceView.vue'
import EstimatesPlotterView    from './views/estimates/EstimatesPlotterView.vue'
import EstimatesCuttingView    from './views/estimates/EstimatesCuttingView.vue'
import EstimatesEmbroideryView from './views/estimates/EstimatesEmbroideryView.vue'
import CustomersView from './views/CustomersView.vue'
import ProductsView from './views/ProductsView.vue'
import EstimatesListView from './views/EstimatesListView.vue'
import HomeView from './views/HomeView.vue'
import SettingsView from './views/SettingsView.vue'
import FinancialView from './views/FinancialView.vue'
import LoginView from './views/LoginView.vue'
import UsersView from './views/UsersView.vue'
import PermissionsView from './views/PermissionsView.vue'
import ReportsView from './views/ReportsView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import SuppliersView from '@/views/SuppliersView.vue'
import PdvView from '@/views/PdvView.vue'
import AiView from '@/views/AiView.vue'
import AuditView from '@/views/AuditView.vue'
import EcommerceDashboardView from '@/views/ecommerce/EcommerceDashboardView.vue'
import EcommerceCatalogView from '@/views/ecommerce/EcommerceCatalogView.vue'
import EcommerceOrdersView from '@/views/ecommerce/EcommerceOrdersView.vue'
import EcommerceReviewsView from '@/views/ecommerce/EcommerceReviewsView.vue'
import EcommerceCouponsView from '@/views/ecommerce/EcommerceCouponsView.vue'
import EcommerceBlogView from '@/views/ecommerce/EcommerceBlogView.vue'
import EcommerceSiteContentView from '@/views/ecommerce/EcommerceSiteContentView.vue'
import EcommerceSettingsView from '@/views/ecommerce/EcommerceSettingsView.vue'
import LoyaltyView from '@/views/LoyaltyView.vue'
import ReceivablesView from '@/views/ReceivablesView.vue'
import PayablesView from '@/views/PayablesView.vue'
import NotificationBell from '@/components/shared/NotificationBell.vue'
import OnlineUsersStack from '@/components/shared/OnlineUsersStack.vue'
import { usePresenceStore } from '@/stores/presence'
import { usePermissionsStore } from '@/stores/permissions'
import ToastContainer from '@/components/shared/ToastContainer.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import AiChatWidget from '@/components/AiChatWidget.vue'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'
import { usePlanStore } from './stores/plan'
import { ESTIMATE_TYPES } from './config/estimateTypes'
import { useRoute } from 'vue-router'

const auth = useAuthStore()

// Modo impersonate — flag setada pelo router quando recebe ?impersonate=<jwt>.
// Mostra banner amarelo no topo + permite sair voltando pra tela de login.
const isImpersonating = computed(() => !!localStorage.getItem('gp_impersonate'))
const exitImpersonate = () => {
  localStorage.removeItem('gp_impersonate')
  auth.logout()
}
const route = useRoute()
const isPublicRoute = computed(() => !!route.meta?.public)
const ui = useUiStore()
const plan = usePlanStore()
const perms = usePermissionsStore()
// Helper curto pra usar em templates: c.v('home') checa permissão de view
const c = perms.can

// Load plan data when the user authenticates
watch(() => auth.isAuthenticated, (val) => {
  if (val) plan.load()
}, { immediate: true })

// Receive 403 plan-limit errors dispatched by apiFetch
function onPlanLimit(e: Event) {
  plan.setLimitError((e as CustomEvent).detail)
}
onMounted(() => {
  window.addEventListener('plan:limit', onPlanLimit)
  // Hidrata photoUrl + outros campos que podem ter sido atualizados no banco
  // depois do último login. Faz silenciosamente — se falhar, usa cache local.
  if (auth.isAuthenticated) {
    auth.refreshUser()
    perms.load()   // matriz de permissões — fail-closed enquanto carrega
  }
})
onUnmounted(() => window.removeEventListener('plan:limit', onPlanLimit))

// Orçamentos — collapsible sub-menu
const estimateTabs = ['estimates', ...ESTIMATE_TYPES.map(t => `estimates-${t.type}`)]
const showEstimatesMenu = ref(estimateTabs.includes(ui.currentTab))
const isEstimatesActive = computed(() => estimateTabs.includes(ui.currentTab))
watch(() => ui.currentTab, (tab) => {
  if (estimateTabs.includes(tab)) showEstimatesMenu.value = true
})

// Todos os sub-itens de orçamento compartilham o mesmo estado ativo neutro
const ACCENT_ACTIVE: Record<string, string> = {
  indigo: 'bg-slate-100 text-slate-900 font-medium',
  purple: 'bg-slate-100 text-slate-900 font-medium',
  orange: 'bg-slate-100 text-slate-900 font-medium',
  pink:   'bg-slate-100 text-slate-900 font-medium',
}

function hasPlanFeature(key: string | null): boolean {
  if (!key) return true
  return !!(plan as any)[key]
}

// Sidebar tem 3 estados:
//   - locked open (`sidebarLocked=true`): fica sempre expandida (clicou no hamburger)
//   - rail (default): mostra só ícones (w-14), expande no hover
//   - hovering: peek temporário enquanto mouse está em cima
//
// O `sidebarCollapsed` deriva: true se rail+não-hover, false se locked OU hover.
// Pequeno delay no leave evita flicker quando mouse passa por cima de um
// submenu que abre fora do sidebar (auto-close em 120ms).
const sidebarLocked  = ref(false)
const sidebarHover   = ref(false)
const sidebarCollapsed = computed(() => !sidebarLocked.value && !sidebarHover.value)

let hoverLeaveTimer: ReturnType<typeof setTimeout> | null = null
function onSidebarEnter() {
  if (hoverLeaveTimer) { clearTimeout(hoverLeaveTimer); hoverLeaveTimer = null }
  sidebarHover.value = true
}
function onSidebarLeave() {
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer)
  hoverLeaveTimer = setTimeout(() => { sidebarHover.value = false }, 120)
}
function toggleSidebar() {
  // Hamburger trava/destrava a sidebar aberta. Hover continua funcionando
  // mesmo quando travada (no-op visual — já está aberta).
  sidebarLocked.value = !sidebarLocked.value
}

function toggleEstimates() {
  showEstimatesMenu.value = !showEstimatesMenu.value
}

// Ecommerce — collapsible sub-menu
const ecommerceTabs = ['ecommerce-dashboard', 'ecommerce-catalog', 'ecommerce-orders', 'ecommerce-reviews', 'ecommerce-coupons', 'ecommerce-blog', 'ecommerce-site', 'ecommerce-settings']
const showEcommerceMenu = ref(ecommerceTabs.includes(ui.currentTab))
const isEcommerceActive = computed(() => ecommerceTabs.includes(ui.currentTab))
watch(() => ui.currentTab, (tab) => {
  if (ecommerceTabs.includes(tab)) showEcommerceMenu.value = true
})
function toggleEcommerce() {
  showEcommerceMenu.value = !showEcommerceMenu.value
}

// Mapeia a tab atual para o título exibido no topbar global
const PAGE_TITLES: Record<string, string> = {
  home: 'Visão geral',
  board: 'Produção',
  pdv: 'PDV Balcão',
  customers: 'Clientes',
  products: 'Insumos',
  estimates: 'Orçamentos',
  'estimates-service': 'Orçamentos — Serviço',
  'estimates-plotter': 'Orçamentos — Plotter',
  'estimates-cutting': 'Orçamentos — Corte',
  'estimates-embroidery': 'Orçamentos — Bordado',
  financial: 'Fluxo de caixa',
  expenses: 'Despesas',
  receivables: 'Contas a receber',
  payables: 'Contas a pagar',
  suppliers: 'Fornecedores',
  settings: 'Configurações',
  users: 'Gestão de equipe',
  permissions: 'Controle de acesso',
  reports: 'Relatórios & BI',
  audit: 'Auditoria',
  ai: 'Agente de IA',
}

const pageTitle = computed(() => PAGE_TITLES[ui.currentTab] || 'GestorPrint')

// Mapa de ícones por tab — SVG paths heroicons-style (24x24, stroke).
// Reusa o container verde do header global, só troca o `d` do <path>.
// Fallback (default) mantém o losango original do GestorPrint.
const DEFAULT_ICON = 'M6 3h12l4 6-10 12L2 9z'
const PAGE_ICONS: Record<string, string> = {
  home:                    'M3 12l9-9 9 9M5 10v10h14V10', // casa (dashboard)
  pdv:                     'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 6h12M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z', // carrinho
  estimates:               'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', // clipboard com check
  'estimates-service':     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  'estimates-plotter':     'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H7a2 2 0 00-2 2v2m4 5h6', // impressora
  'estimates-cutting':     'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z', // tesoura
  'estimates-embroidery':  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  board:                   'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', // colunas (kanban)
  customers:               'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', // pessoas
  products:                'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', // caixa
  suppliers:               'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0', // caminhão
  financial:               'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // moeda
  expenses:                'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', // carteira
  receivables:             'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', // recibo entrada
  payables:                'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', // doc com check (saída)
  loyalty:                 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', // estrelas (fidelidade)
  reports:                 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', // gráfico de barras
  ai:                      'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', // tela/monitor (IA)
  settings:                'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z', // engrenagem
  users:                   'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', // grupo de usuários
  permissions:             'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', // escudo com check
  audit:                   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', // documento
}

const pageIconPath = computed(() => PAGE_ICONS[ui.currentTab] || DEFAULT_ICON)
// Quando tem ícone específico (não é default), usa stroke. Default é o losango
// preenchido — mantém background sólido.
const pageIconIsDefault = computed(() => !PAGE_ICONS[ui.currentTab])
</script>

<template>
  <ToastContainer />
  <ConfirmModal />

  <!-- Widget de chat IA — só admins. A IA é configurada por tenant (1 prompt,
       1 conjunto de tools). Operadores comuns têm permissões mais limitadas
       no ERP, e ajustar tudo por papel daria muito trabalho. Mantém simples. -->
  <AiChatWidget v-if="auth.isAuthenticated && auth.isAdmin && !isPublicRoute && plan.hasWhatsapp" />

  <!-- Rotas públicas (sem app shell) -->
  <router-view v-if="isPublicRoute" />

  <div v-else-if="!auth.isAuthenticated">
    <LoginView />
  </div>

  <div v-else class="dashboard-bg flex h-screen text-slate-800 font-sans overflow-hidden text-sm md:text-base">

    <!-- Sidebar Global — modo rail por default (w-14 só ícones), expande
         pra w-56 no hover. Hamburger trava aberta. Animação suave 300ms. -->
    <aside
      @mouseenter="onSidebarEnter"
      @mouseleave="onSidebarLeave"
      :class="['bg-white border-r border-slate-200 flex flex-col shrink-0 relative z-30 overflow-hidden transition-[width] duration-300 ease-out',
               sidebarCollapsed ? 'w-14' : 'w-56']">

      <nav class="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden no-scrollbar text-[13px]">
        <!-- Dashboard fica no topo, sem header -->
        <button @click="ui.setTab('home')" :title="sidebarCollapsed ? 'Dashboard' : ''"
          :class="['w-full cursor-pointer flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'home' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Dashboard</span>
        </button>

        <!-- ── VENDAS & OPERAÇÃO ────────────────────────────────────────────── -->
        <div v-if="c.view('pdv') || c.view('estimates') || c.view('orders-board')" :class="['pb-1', sidebarCollapsed ? 'pt-3 border-t border-slate-100' : 'pt-3']">
          <span v-show="!sidebarCollapsed" class="px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Vendas &amp; Operação</span>
        </div>

        <button v-if="c.view('pdv')" @click="ui.setTab('pdv')" :title="sidebarCollapsed ? 'PDV Balcão' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'pdv' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">PDV Balcão</span>
        </button>

        <!-- Orçamentos — menu colapsável (movido pra cá pra agrupar com Vendas) -->
        <div v-if="c.view('estimates')">
          <button @click="toggleEstimates()" :title="sidebarCollapsed ? 'Orçamentos' : ''"
            :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '',
              isEstimatesActive ? 'bg-slate-50 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900']">
            <svg class="w-[18px] h-[18px] shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span v-show="!sidebarCollapsed" class="truncate text-sm">Orçamentos</span>
            <svg v-show="!sidebarCollapsed" :class="['w-3.5 h-3.5 shrink-0 transition-transform duration-200', showEstimatesMenu ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div v-if="showEstimatesMenu && !sidebarCollapsed" class="mt-1 ml-3 pl-3 border-l border-slate-100 space-y-0.5">
            <button @click="ui.setTab('estimates')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'estimates' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/></svg>
              <span class="truncate text-sm">Todos</span>
            </button>
            <button v-for="t in ESTIMATE_TYPES" :key="t.type"
              @click="hasPlanFeature(t.planFeature) ? ui.setTab(`estimates-${t.type}`) : plan.setLimitError(`${t.label} requer um plano superior.`)"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === `estimates-${t.type}` ? `${ACCENT_ACTIVE[t.accentColor]} font-medium`
                : hasPlanFeature(t.planFeature) ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'
                : 'text-slate-300 cursor-not-allowed']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="t.svgPath"/></svg>
              <span class="truncate text-sm">{{ t.label }}</span>
              <svg v-if="!hasPlanFeature(t.planFeature)" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            </button>
          </div>
        </div>

        <!-- Produção (Kanban) — fecha Vendas & Operação -->
        <button v-if="c.view('orders-board')" :title="sidebarCollapsed ? 'Produção' : ''"
          @click="plan.hasKanban ? ui.setTab('board') : plan.setLimitError('Fila de Produção não disponível no seu plano.')"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'board' ? 'bg-slate-100 text-slate-900 font-medium' : plan.hasKanban ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Produção</span>
          <svg v-if="!plan.hasKanban && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <!-- ── CADASTROS ────────────────────────────────────────────────────── -->
        <div :class="['pb-1', sidebarCollapsed ? 'pt-3 border-t border-slate-100' : 'pt-3']">
          <span v-show="!sidebarCollapsed" class="px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Cadastros</span>
        </div>

        <button v-if="c.view('customers')" @click="ui.setTab('customers')" :title="sidebarCollapsed ? 'Clientes' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'customers' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Clientes</span>
        </button>

        <button v-if="c.view('products')" @click="ui.setTab('products')" :title="sidebarCollapsed ? 'Insumos' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'products' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Insumos</span>
        </button>

        <button v-if="c.view('suppliers')" @click="ui.setTab('suppliers')" :title="sidebarCollapsed ? 'Fornecedores' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'suppliers' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Fornecedores</span>
        </button>

        <!-- ── FINANCEIRO ───────────────────────────────────────────────────── -->
        <div v-if="c.view('financial') || c.view('receivables') || c.view('payables') || c.view('expenses')" :class="['pb-1', sidebarCollapsed ? 'pt-3 border-t border-slate-100' : 'pt-3']">
          <span v-show="!sidebarCollapsed" class="px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Financeiro</span>
        </div>

        <button v-if="c.view('financial')" @click="ui.setTab('financial')" :title="sidebarCollapsed ? 'Fluxo de Caixa' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'financial' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Fluxo de Caixa</span>
        </button>

        <button v-if="c.view('receivables')" :title="sidebarCollapsed ? 'Contas a Receber' : ''"
          @click="plan.hasReceivables ? ui.setTab('receivables') : plan.setLimitError('Contas a Receber não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'receivables' ? 'bg-slate-100 text-slate-900 font-medium' : plan.hasReceivables ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Contas a Receber</span>
          <svg v-if="!plan.hasReceivables && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <button v-if="c.view('payables')" :title="sidebarCollapsed ? 'Contas a Pagar' : ''"
          @click="plan.hasReceivables ? ui.setTab('payables') : plan.setLimitError('Contas a Pagar não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'payables' ? 'bg-slate-100 text-slate-900 font-medium' : plan.hasReceivables ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Contas a Pagar</span>
          <svg v-if="!plan.hasReceivables && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <button v-if="c.view('expenses')" @click="ui.setTab('expenses')" :title="sidebarCollapsed ? 'Despesas' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'expenses' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Despesas</span>
        </button>

        <!-- ── LOJA ONLINE ──────────────────────────────────────────────────── -->
        <!-- Mantém visível com cadeado pra ser consistente com os outros itens gateados -->
        <div v-if="c.view('ecommerce-dashboard') || c.view('ecommerce-orders') || c.view('ecommerce-catalog') || c.view('ecommerce-coupons') || c.view('ecommerce-blog') || c.view('ecommerce-site') || c.view('ecommerce-reviews') || c.view('ecommerce-settings')" :class="['pb-1', sidebarCollapsed ? 'pt-3 border-t border-slate-100' : 'pt-3']">
          <span v-show="!sidebarCollapsed" class="px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Loja Online</span>
        </div>

        <!-- Ecommerce — menu colapsável; quando hasEcommerce=false, mostra cadeado e bloqueia abertura -->
        <div v-if="c.view('ecommerce-dashboard') || c.view('ecommerce-orders') || c.view('ecommerce-catalog') || c.view('ecommerce-coupons') || c.view('ecommerce-blog') || c.view('ecommerce-site') || c.view('ecommerce-reviews') || c.view('ecommerce-settings')">
          <button
            :title="sidebarCollapsed ? 'Ecommerce' : ''"
            @click="plan.hasEcommerce ? toggleEcommerce() : plan.setLimitError('Loja Online não disponível no plano atual.')"
            :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '',
              !plan.hasEcommerce ? 'text-slate-300 cursor-not-allowed'
              : isEcommerceActive ? 'bg-slate-50 text-slate-900'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900']">
            <svg class="w-[18px] h-[18px] shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            <span v-show="!sidebarCollapsed" class="truncate text-sm">Ecommerce</span>
            <svg v-if="!plan.hasEcommerce && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            <svg v-else-if="!sidebarCollapsed" :class="['w-3.5 h-3.5 shrink-0 transition-transform duration-200', showEcommerceMenu ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div v-if="showEcommerceMenu && !sidebarCollapsed && plan.hasEcommerce" class="mt-1 ml-3 pl-3 border-l border-slate-100 space-y-0.5">
            <button v-if="c.view('ecommerce-dashboard')" @click="ui.setTab('ecommerce-dashboard')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'ecommerce-dashboard' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              <span class="truncate text-sm">Resumo</span>
            </button>
            <button v-if="c.view('ecommerce-catalog')" @click="ui.setTab('ecommerce-catalog')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'ecommerce-catalog' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              <span class="truncate text-sm">Catálogo</span>
            </button>
            <button v-if="c.view('ecommerce-orders')" @click="ui.setTab('ecommerce-orders')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'ecommerce-orders' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <span class="truncate text-sm">Pedidos</span>
            </button>
            <button v-if="c.view('ecommerce-reviews')" @click="ui.setTab('ecommerce-reviews')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'ecommerce-reviews' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
              <span class="truncate text-sm">Avaliações</span>
            </button>
            <button v-if="c.view('ecommerce-coupons')" @click="ui.setTab('ecommerce-coupons')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'ecommerce-coupons' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
              <span class="truncate text-sm">Cupons</span>
            </button>
            <button v-if="c.view('ecommerce-blog')" @click="ui.setTab('ecommerce-blog')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'ecommerce-blog' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>
              <span class="truncate text-sm">Blog</span>
            </button>
            <button v-if="c.view('ecommerce-site')" @click="ui.setTab('ecommerce-site')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'ecommerce-site' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v3H4V5zM4 11h16v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8z"/></svg>
              <span class="truncate text-sm">Conteúdo do site</span>
            </button>
            <button v-if="c.view('ecommerce-settings')" @click="ui.setTab('ecommerce-settings')"
              :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150',
                ui.currentTab === 'ecommerce-settings' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
              <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span class="truncate text-sm">Configurações</span>
            </button>
          </div>
        </div>

        <!-- ── ANÁLISES ─────────────────────────────────────────────────────── -->
        <div v-if="c.view('reports') || c.view('ai') || c.view('loyalty')" :class="['pb-1', sidebarCollapsed ? 'pt-3 border-t border-slate-100' : 'pt-3']">
          <span v-show="!sidebarCollapsed" class="px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Análises</span>
        </div>

        <!-- Programa de Fidelidade — gateado por hasLoyalty (BASIC+); sem feature mostra cadeado -->
        <button v-if="c.view('loyalty')" :title="sidebarCollapsed ? 'Fidelidade' : ''"
          @click="plan.hasLoyalty ? ui.setTab('loyalty') : plan.setLimitError('Programa de Fidelidade não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'loyalty' ? 'bg-slate-100 text-slate-900 font-medium' : plan.hasLoyalty ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Fidelidade</span>
          <svg v-if="!plan.hasLoyalty && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <button v-if="c.view('reports')" :title="sidebarCollapsed ? 'Relatórios & BI' : ''"
          @click="plan.hasReports ? ui.setTab('reports') : plan.setLimitError('Relatórios & BI não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'reports' ? 'bg-slate-100 text-slate-900 font-medium' : plan.hasReports ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Relatórios &amp; BI</span>
          <svg v-if="!plan.hasReports && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <button v-if="c.view('ai')" :title="sidebarCollapsed ? 'Agente de IA' : ''"
          @click="plan.hasWhatsapp ? ui.setTab('ai') : plan.setLimitError('Agente de IA não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'ai' ? 'bg-slate-100 text-slate-900 font-medium' : plan.hasWhatsapp ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Agente de IA</span>
          <svg v-if="!plan.hasWhatsapp && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <!-- ── SISTEMA ──────────────────────────────────────────────────────── -->
        <div v-if="c.view('settings') || c.view('users') || c.view('audit')" :class="['pb-1', sidebarCollapsed ? 'pt-3 border-t border-slate-100' : 'pt-3']">
          <span v-show="!sidebarCollapsed" class="px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Sistema</span>
        </div>

        <button v-if="c.view('settings')" @click="ui.setTab('settings')" :title="sidebarCollapsed ? 'Configurações' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'settings' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Configurações</span>
        </button>

        <button v-if="c.view('users')" @click="ui.setTab('users')" :title="sidebarCollapsed ? 'Gestão de Equipe' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'users' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Gestão de Equipe</span>
        </button>

        <button v-if="c.view('permissions')" @click="ui.setTab('permissions')" :title="sidebarCollapsed ? 'Controle de Acesso' : ''"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'permissions' ? 'bg-slate-100 text-slate-900 font-medium' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Controle de Acesso</span>
        </button>

        <button v-if="c.view('audit')" :title="sidebarCollapsed ? 'Auditoria' : ''"
          @click="plan.hasAudit ? ui.setTab('audit') : plan.setLimitError('Auditoria não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'audit' ? 'bg-slate-100 text-slate-900 font-medium' : plan.hasAudit ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate text-sm">Auditoria</span>
          <svg v-if="!plan.hasAudit && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <div class="pt-3">
          <button @click="auth.logout()" :title="sidebarCollapsed ? 'Sair' : ''"
            :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-lg font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-150', sidebarCollapsed ? 'justify-center' : '']">
            <svg class="w-[18px] h-[18px] flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            <span v-show="!sidebarCollapsed" class="truncate text-sm">Sair</span>
          </button>
        </div>
      </nav>

      <!-- Plan Usage Widget (oculto quando colapsado) -->
      <div v-if="plan.data && !sidebarCollapsed" class="px-3 pb-3 pt-3 border-t border-slate-100">
        <div class="px-1">
          <!-- Plan name + badge -->
          <div class="flex items-center justify-between mb-2.5">
            <span class="text-xs font-medium text-slate-700 truncate">{{ plan.planName }}</span>
            <span v-if="plan.isTrial" class="shrink-0 text-[10px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full leading-tight">Trial</span>
            <span v-else-if="plan.isSuspended" class="shrink-0 text-[10px] font-medium bg-red-50 text-red-700 px-2 py-0.5 rounded-full leading-tight">Suspenso</span>
          </div>
          <!-- Usage bars -->
          <div class="space-y-2">
            <div>
              <div class="flex justify-between text-[11px] mb-1">
                <span class="text-slate-500">Usuários</span>
                <span :class="plan.usersPct >= 90 ? 'text-red-600 font-medium' : plan.usersPct >= 70 ? 'text-amber-600 font-medium' : 'text-slate-500'">{{ plan.data.usersCount }}/{{ plan.data.maxUsers }}</span>
              </div>
              <div class="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div :class="['h-full rounded-full transition-all duration-500', plan.usersPct >= 90 ? 'bg-red-500' : plan.usersPct >= 70 ? 'bg-amber-500' : 'bg-slate-900']" :style="`width:${plan.usersPct}%`"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-[11px] mb-1">
                <span class="text-slate-500">Pedidos/mês</span>
                <span :class="plan.ordersPct >= 90 ? 'text-red-600 font-medium' : plan.ordersPct >= 70 ? 'text-amber-600 font-medium' : 'text-slate-500'">{{ plan.data.ordersThisMonth }}/{{ plan.data.maxOrders }}</span>
              </div>
              <div class="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div :class="['h-full rounded-full transition-all duration-500', plan.ordersPct >= 90 ? 'bg-red-500' : plan.ordersPct >= 70 ? 'bg-amber-500' : 'bg-slate-900']" :style="`width:${plan.ordersPct}%`"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-[11px] mb-1">
                <span class="text-slate-500">Clientes</span>
                <span :class="plan.customersPct >= 90 ? 'text-red-600 font-medium' : plan.customersPct >= 70 ? 'text-amber-600 font-medium' : 'text-slate-500'">{{ plan.data.customersCount }}/{{ plan.data.maxCustomers }}</span>
              </div>
              <div class="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div :class="['h-full rounded-full transition-all duration-500', plan.customersPct >= 90 ? 'bg-red-500' : plan.customersPct >= 70 ? 'bg-amber-500' : 'bg-slate-900']" :style="`width:${plan.customersPct}%`"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Profile Mini -->
      <div :class="['border-t border-slate-100 transition-all', sidebarCollapsed ? 'p-2.5' : 'p-3']">
        <div :class="['flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-2.5 px-1']">
          <div class="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-slate-700 font-medium text-xs shrink-0">
            <img v-if="auth.user?.photoUrl" :src="auth.user.photoUrl" :alt="auth.user?.name" class="w-full h-full object-cover" />
            <span v-else>{{ auth.user?.name?.charAt(0) }}</span>
          </div>
          <div v-show="!sidebarCollapsed" class="flex-1 min-w-0">
            <div class="text-xs font-medium text-slate-900 truncate">{{ auth.user?.name }}</div>
            <div class="text-[10px] text-slate-400 capitalize">{{ (auth.user?.role || '').toLowerCase() }}</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Dynamic View -->
    <div class="flex-1 relative overflow-hidden bg-transparent">

      <!-- Banner de impersonate — visível só quando super admin está navegando como tenant -->
      <div v-if="isImpersonating" class="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-amber-900">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          <span>
            <strong>Modo impersonate</strong> — você está navegando como
            <span v-if="auth.user?.name" class="font-medium">{{ auth.user.name }}</span>
            <span class="font-mono text-amber-700"> · sessão expira em 15min</span>
          </span>
        </div>
        <button @click="exitImpersonate"
          class="text-xs font-medium text-amber-900 hover:text-amber-950 underline underline-offset-4">
          Sair desta sessão
        </button>
      </div>

      <!-- Top Header — barra transparente, sem borda -->
      <header class="h-14 flex items-center justify-between gap-3 px-4 md:px-6">
        <div class="flex items-center gap-3 min-w-0">
          <button @click="toggleSidebar"
            class="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            :aria-label="sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background:#1D9E75">
            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor"
                 :stroke-width="pageIconIsDefault ? 2.5 : 2"
                 viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" :d="pageIconPath"/>
            </svg>
          </div>
          <h1 class="text-base font-medium text-slate-900 truncate">{{ pageTitle }}</h1>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <OnlineUsersStack :max="4" />
          <NotificationBell />
          <div class="w-px h-6 bg-slate-100"></div>
          <div class="flex items-center gap-2.5">
            <div class="text-right hidden sm:block">
              <div class="text-sm font-medium text-slate-900 leading-tight">{{ auth.user?.name }}</div>
              <div class="text-[11px] text-slate-400 capitalize leading-tight">{{ (auth.user?.role || '').toLowerCase() }}</div>
            </div>
            <div class="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-slate-700 font-medium text-sm">
              <img v-if="auth.user?.photoUrl" :src="auth.user.photoUrl" :alt="auth.user?.name" class="w-full h-full object-cover" />
              <span v-else>{{ auth.user?.name?.charAt(0) }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Suspended/Cancelled Banner -->
      <div v-if="plan.isSuspended" class="bg-red-50 border-b border-red-200 px-4 md:px-6 py-2.5 flex items-center gap-2.5">
        <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <p class="text-sm font-medium text-red-700">Conta suspensa ou cancelada. Entre em contato com o suporte para reativação.</p>
      </div>

      <main class="h-[calc(100vh-3.5rem)] overflow-x-auto overflow-y-auto custom-scrollbar">
        <HomeView v-if="ui.currentTab === 'home'" />
        <AppBoard v-if="ui.currentTab === 'board'" />
        <PdvView v-if="ui.currentTab === 'pdv'" />
        <CustomersView v-if="ui.currentTab === 'customers'" />
        <ProductsView v-if="ui.currentTab === 'products'" />
        <EstimatesListView v-if="ui.currentTab === 'estimates'" />
        <EstimatesServiceView    v-if="ui.currentTab === 'estimates-service'" />
        <EstimatesCuttingView    v-if="ui.currentTab === 'estimates-cutting'" />
        <EstimatesPlotterView    v-if="ui.currentTab === 'estimates-plotter'" />
        <EstimatesEmbroideryView v-if="ui.currentTab === 'estimates-embroidery'" />
        <SettingsView v-if="ui.currentTab === 'settings'" />
        <FinancialView v-if="ui.currentTab === 'financial'" />
        <ExpensesView v-if="ui.currentTab === 'expenses'" />
        <SuppliersView v-if="ui.currentTab === 'suppliers'" />
        <UsersView v-if="ui.currentTab === 'users' && c.view('users')" />
        <PermissionsView v-if="ui.currentTab === 'permissions' && c.view('permissions')" />
        <ReportsView v-if="ui.currentTab === 'reports'" />
        <AiView v-if="ui.currentTab === 'ai'" />
        <AuditView v-if="ui.currentTab === 'audit'" />
        <ReceivablesView v-if="ui.currentTab === 'receivables'" />
        <PayablesView v-if="ui.currentTab === 'payables'" />
        <EcommerceDashboardView v-if="ui.currentTab === 'ecommerce-dashboard'" />
        <EcommerceCatalogView v-if="ui.currentTab === 'ecommerce-catalog'" />
        <EcommerceOrdersView v-if="ui.currentTab === 'ecommerce-orders'" />
        <EcommerceReviewsView v-if="ui.currentTab === 'ecommerce-reviews'" />
        <EcommerceCouponsView v-if="ui.currentTab === 'ecommerce-coupons'" />
        <EcommerceBlogView v-if="ui.currentTab === 'ecommerce-blog'" />
        <EcommerceSiteContentView v-if="ui.currentTab === 'ecommerce-site'" />
        <EcommerceSettingsView v-if="ui.currentTab === 'ecommerce-settings'" />
        <LoyaltyView v-if="ui.currentTab === 'loyalty'" />
      </main>

    </div>

  </div>

  <!-- Plan Limit / Upgrade Modal -->
  <Teleport to="body">
    <div v-if="plan.limitError" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" @click.self="plan.clearLimitError()">
      <div class="bg-white rounded-2xl p-7 max-w-sm mx-4 border border-slate-200 text-center">
        <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 class="text-base font-medium text-slate-900 mb-2">Recurso não disponível</h3>
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">{{ plan.limitError }}</p>
        <div class="flex gap-2">
          <button @click="plan.clearLimitError()" class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Fechar
          </button>
          <a
            href="mailto:suporte@gestorprint.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20Upgrade%20de%20Plano"
            target="_blank"
            @click="plan.clearLimitError()"
            class="flex-1 py-2.5 rounded-full bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
          >
            Solicitar upgrade
          </a>
        </div>
      </div>
    </div>
  </Teleport>

</template>

<style>
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

/* Scrollbar invisível — usado na sidebar pra navegação ficar mais limpa.
   Mantém scroll funcional (touch/wheel) mas sem barra visível. */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
