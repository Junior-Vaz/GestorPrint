<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref, computed } from 'vue'
import AppBoard from './components/AppBoard.vue'
import EstimateCalculator from './views/EstimateCalculator.vue'
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
import ReportsView from './views/ReportsView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import SuppliersView from '@/views/SuppliersView.vue'
import PdvView from '@/views/PdvView.vue'
import AiView from '@/views/AiView.vue'
import AuditView from '@/views/AuditView.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'
import { usePlanStore } from './stores/plan'
import { ESTIMATE_TYPES } from './config/estimateTypes'

const auth = useAuthStore()
const ui = useUiStore()
const plan = usePlanStore()

// Load plan data when the user authenticates
watch(() => auth.isAuthenticated, (val) => {
  if (val) plan.load()
}, { immediate: true })

// Receive 403 plan-limit errors dispatched by apiFetch
function onPlanLimit(e: Event) {
  plan.setLimitError((e as CustomEvent).detail)
}
onMounted(() => window.addEventListener('plan:limit', onPlanLimit))
onUnmounted(() => window.removeEventListener('plan:limit', onPlanLimit))

// Orçamentos — collapsible sub-menu
const estimateTabs = ESTIMATE_TYPES.map(t => `estimates-${t.type}`)
const showEstimatesMenu = ref(estimateTabs.includes(ui.currentTab))
const isEstimatesActive = computed(() => estimateTabs.includes(ui.currentTab))
watch(() => ui.currentTab, (tab) => {
  if (estimateTabs.includes(tab)) showEstimatesMenu.value = true
})

// Accent color map para classes Tailwind estáticas (não pode usar interpolação dinâmica)
const ACCENT_ACTIVE: Record<string, string> = {
  indigo: 'bg-indigo-600 text-white shadow-sm',
  purple: 'bg-purple-600 text-white shadow-sm',
  orange: 'bg-orange-600 text-white shadow-sm',
  pink:   'bg-pink-600 text-white shadow-sm',
}

function hasPlanFeature(key: string | null): boolean {
  if (!key) return true
  return !!(plan as any)[key]
}

const sidebarCollapsed = ref(true)

function toggleEstimates() {
  showEstimatesMenu.value = !showEstimatesMenu.value
}
</script>

<template>
  <ToastContainer />
  <ConfirmModal />
  <div v-if="!auth.isAuthenticated">
    <LoginView />
  </div>

  <div v-else class="dashboard-bg flex h-screen text-slate-800 font-sans overflow-hidden text-sm md:text-base">
    
    <!-- Sidebar Global -->
    <aside
      @mouseenter="sidebarCollapsed = false"
      @mouseleave="sidebarCollapsed = true"
      :class="['m-5 bg-white rounded-2xl border border-slate-200/80 hidden md:flex flex-col shadow-lg shrink-0 relative z-30 overflow-hidden transition-all duration-300', sidebarCollapsed ? 'w-16' : 'w-64']">
      <!-- Header: logo -->
      <div class="h-16 flex items-center border-b border-slate-100 px-3.5 shrink-0">
        <div class="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-sm shrink-0">
          <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        </div>
        <h1 v-show="!sidebarCollapsed" class="ml-2 text-xl font-extrabold tracking-tight text-slate-900 leading-tight flex-1 truncate">GestorPrint</h1>
      </div>

      <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <button @click="ui.setTab('home')" :title="sidebarCollapsed ? 'Dashboard' : ''"
          :class="['w-full cursor-pointer flex items-center gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'home' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold">Dashboard</span>
        </button>

        <button v-if="auth.isProduction" :title="sidebarCollapsed ? 'Produção' : ''"
          @click="plan.hasKanban ? ui.setTab('board') : plan.setLimitError('Fila de Produção não disponível no seu plano.')"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'board' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : plan.hasKanban ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-800' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Produção</span>
          <svg v-if="!plan.hasKanban && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <button v-if="auth.isSales" @click="ui.setTab('pdv')" :title="sidebarCollapsed ? 'PDV Balcão' : ''"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'pdv' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">PDV Balcão</span>
        </button>

        <button @click="ui.setTab('customers')" :title="sidebarCollapsed ? 'Clientes' : ''"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'customers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Clientes</span>
        </button>

        <button v-if="auth.isAdmin" @click="ui.setTab('products')" :title="sidebarCollapsed ? 'Insumos' : ''"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'products' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Insumos</span>
        </button>

        <div v-if="auth.isAdmin" :class="['pb-1', sidebarCollapsed ? 'pt-3 border-t border-slate-100' : 'pt-3']">
          <span v-show="!sidebarCollapsed" class="px-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Financeiro</span>
        </div>

        <button v-if="auth.isAdmin" @click="ui.setTab('financial')" :title="sidebarCollapsed ? 'Fluxo de Caixa' : ''"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'financial' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Fluxo de Caixa</span>
        </button>

        <button v-if="auth.isAdmin" @click="ui.setTab('expenses')" :title="sidebarCollapsed ? 'Despesas' : ''"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'expenses' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Despesas</span>
        </button>

        <button v-if="auth.isAdmin" @click="ui.setTab('suppliers')" :title="sidebarCollapsed ? 'Fornecedores' : ''"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Fornecedores</span>
        </button>

        <!-- Orçamentos — menu colapsável -->
        <div v-if="auth.isSales" class="pt-3">
          <button @click="toggleEstimates()" :title="sidebarCollapsed ? 'Orçamentos' : ''"
            :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '',
              isEstimatesActive ? 'text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800']">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Orçamentos</span>
            <svg v-show="!sidebarCollapsed" :class="['w-3.5 h-3.5 shrink-0 transition-transform duration-200', showEstimatesMenu ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div v-if="showEstimatesMenu && !sidebarCollapsed" class="mt-1 ml-3 pl-3 border-l-2 border-slate-100 space-y-0.5">
            <button v-for="t in ESTIMATE_TYPES" :key="t.type"
              @click="hasPlanFeature(t.planFeature) ? ui.setTab(`estimates-${t.type}`) : plan.setLimitError(`${t.label} requer um plano superior.`)"
              :class="['w-full flex items-center cursor-pointer gap-2 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200',
                ui.currentTab === `estimates-${t.type}` ? ACCENT_ACTIVE[t.accentColor]
                : hasPlanFeature(t.planFeature) ? 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                : 'text-slate-300 cursor-not-allowed']">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="t.svgPath"/></svg>
              {{ t.label }}
              <svg v-if="!hasPlanFeature(t.planFeature)" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            </button>
          </div>
        </div>

        <div v-if="auth.isAdmin" :class="['pb-1', sidebarCollapsed ? 'pt-3 border-t border-slate-100' : 'pt-3']">
          <span v-show="!sidebarCollapsed" class="px-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sistema</span>
        </div>

        <button v-if="auth.isAdmin" @click="ui.setTab('settings')" :title="sidebarCollapsed ? 'Configurações' : ''"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Configurações</span>
        </button>

        <button v-if="auth.isAdmin" @click="ui.setTab('users')" :title="sidebarCollapsed ? 'Gestão de Equipe' : ''"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Gestão de Equipe</span>
        </button>

        <button v-if="auth.isAdmin" :title="sidebarCollapsed ? 'Relatórios & BI' : ''"
          @click="plan.hasReports ? ui.setTab('reports') : plan.setLimitError('Relatórios & BI não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : plan.hasReports ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-800' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Relatórios & BI</span>
          <svg v-if="!plan.hasReports && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <button v-if="auth.isAdmin" :title="sidebarCollapsed ? 'Auditoria' : ''"
          @click="plan.hasAudit ? ui.setTab('audit') : plan.setLimitError('Auditoria não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : plan.hasAudit ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-800' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Auditoria</span>
          <svg v-if="!plan.hasAudit && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <button v-if="auth.isAdmin" :title="sidebarCollapsed ? 'Agente de IA' : ''"
          @click="plan.hasWhatsapp ? ui.setTab('ai') : plan.setLimitError('Agente de IA não disponível no plano atual.')"
          :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold transition-all duration-200', sidebarCollapsed ? 'justify-center' : '', ui.currentTab === 'ai' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : plan.hasWhatsapp ? 'hover:bg-slate-50 text-slate-500 hover:text-slate-800' : 'text-slate-300 cursor-not-allowed']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Agente de IA</span>
          <svg v-if="!plan.hasWhatsapp && !sidebarCollapsed" class="w-3.5 h-3.5 ml-auto shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </button>

        <div class="pt-3">
          <button @click="auth.logout()" :title="sidebarCollapsed ? 'Sair' : ''"
            :class="['w-full flex items-center cursor-pointer gap-3 px-2.5 py-2 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all', sidebarCollapsed ? 'justify-center' : '']">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            <span v-show="!sidebarCollapsed" class="truncate font-semibold text-sm">Sair do Sistema</span>
          </button>
        </div>
      </nav>

      <!-- Plan Usage Widget (oculto quando colapsado) -->
      <div v-if="plan.data && !sidebarCollapsed" class="px-3 pb-2 border-t border-slate-100 pt-2">
        <div class="bg-slate-50 rounded-xl px-3 py-2.5">
          <!-- Plan name + badge -->
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5 min-w-0">
              <svg class="w-3 h-3 text-indigo-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              <span class="text-[11px] font-black text-slate-600 truncate">{{ plan.planName }}</span>
            </div>
            <span v-if="plan.isTrial" class="shrink-0 text-[9px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full leading-none">TRIAL</span>
            <span v-else-if="plan.isSuspended" class="shrink-0 text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full leading-none">SUSPENSO</span>
          </div>
          <!-- Usage bars -->
          <div class="space-y-1.5">
            <div>
              <div class="flex justify-between text-[10px] mb-0.5">
                <span class="text-slate-400">Usuários</span>
                <span :class="plan.usersPct >= 90 ? 'text-red-500 font-bold' : plan.usersPct >= 70 ? 'text-amber-500 font-bold' : 'text-slate-400'">{{ plan.data.usersCount }}/{{ plan.data.maxUsers }}</span>
              </div>
              <div class="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div :class="['h-full rounded-full transition-all duration-500', plan.usersPct >= 90 ? 'bg-red-400' : plan.usersPct >= 70 ? 'bg-amber-400' : 'bg-indigo-400']" :style="`width:${plan.usersPct}%`"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-[10px] mb-0.5">
                <span class="text-slate-400">Pedidos/mês</span>
                <span :class="plan.ordersPct >= 90 ? 'text-red-500 font-bold' : plan.ordersPct >= 70 ? 'text-amber-500 font-bold' : 'text-slate-400'">{{ plan.data.ordersThisMonth }}/{{ plan.data.maxOrders }}</span>
              </div>
              <div class="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div :class="['h-full rounded-full transition-all duration-500', plan.ordersPct >= 90 ? 'bg-red-400' : plan.ordersPct >= 70 ? 'bg-amber-400' : 'bg-indigo-400']" :style="`width:${plan.ordersPct}%`"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-[10px] mb-0.5">
                <span class="text-slate-400">Clientes</span>
                <span :class="plan.customersPct >= 90 ? 'text-red-500 font-bold' : plan.customersPct >= 70 ? 'text-amber-500 font-bold' : 'text-slate-400'">{{ plan.data.customersCount }}/{{ plan.data.maxCustomers }}</span>
              </div>
              <div class="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div :class="['h-full rounded-full transition-all duration-500', plan.customersPct >= 90 ? 'bg-red-400' : plan.customersPct >= 70 ? 'bg-amber-400' : 'bg-indigo-400']" :style="`width:${plan.customersPct}%`"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Profile Mini -->
      <div :class="['border-t border-slate-100 bg-slate-50/50 transition-all', sidebarCollapsed ? 'p-2' : 'p-4']">
        <div :class="['flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-3 px-2']">
          <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm border-2 border-white shadow-sm shrink-0">{{ auth.user?.name.charAt(0) }}</div>
          <div v-show="!sidebarCollapsed" class="flex-1 min-w-0">
            <div class="text-xs font-black text-slate-900 truncate">{{ auth.user?.name }}</div>
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{{ auth.user?.role }}</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Dynamic View -->
    <div class="flex-1 relative overflow-hidden bg-transparent my-3 mr-3">

      <!-- Top Header — absolute, flutua sobre o conteúdo -->
      <header class="absolute top-3 right-3 z-30 flex justify-end pointer-events-none">
        <div class="flex items-center gap-4 px-4 py-2.5 bg-white/100 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-lg pointer-events-auto">
          <NotificationBell />
          <div class="w-px h-6 bg-slate-100"></div>
          <div class="flex items-center gap-3">
            <div class="text-right hidden sm:block">
              <div class="text-xs font-black text-slate-900">{{ auth.user?.name }}</div>
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{{ auth.user?.role }}</div>
            </div>
            <div class="w-9 h-9 rounded-full bg-indigo-50 border-2 border-white shadow-sm flex items-center justify-center text-indigo-600 font-black text-sm">
              {{ auth.user?.name.charAt(0) }}
            </div>
          </div>
        </div>
      </header>

      <!-- Suspended/Cancelled Banner -->
      <div v-if="plan.isSuspended" class="absolute top-0 left-0 right-0 z-10 bg-red-50 border-b border-red-200 px-4 md:px-8 py-2.5 flex items-center gap-3">
        <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <p class="text-sm font-bold text-red-700">Conta suspensa ou cancelada. Entre em contato com o suporte para reativação.</p>
      </div>

      <main class="h-full overflow-x-auto overflow-y-auto pt-20 custom-scrollbar">
        <HomeView v-if="ui.currentTab === 'home'" />
        <AppBoard v-if="ui.currentTab === 'board'" />
        <PdvView v-if="ui.currentTab === 'pdv'" />
        <CustomersView v-if="ui.currentTab === 'customers'" />
        <ProductsView v-if="ui.currentTab === 'products'" />
        <EstimateCalculator v-if="ui.currentTab === 'calculator'" />
        <EstimatesListView v-if="ui.currentTab === 'estimates'" />
        <EstimatesServiceView    v-if="ui.currentTab === 'estimates-service'" />
        <EstimatesCuttingView    v-if="ui.currentTab === 'estimates-cutting'" />
        <EstimatesPlotterView    v-if="ui.currentTab === 'estimates-plotter'" />
        <EstimatesEmbroideryView v-if="ui.currentTab === 'estimates-embroidery'" />
        <SettingsView v-if="ui.currentTab === 'settings'" />
        <FinancialView v-if="ui.currentTab === 'financial'" />
        <ExpensesView v-if="ui.currentTab === 'expenses'" />
        <SuppliersView v-if="ui.currentTab === 'suppliers'" />
        <UsersView v-if="ui.currentTab === 'users' && auth.isAdmin" />
        <ReportsView v-if="ui.currentTab === 'reports'" />
        <AiView v-if="ui.currentTab === 'ai'" />
        <AuditView v-if="ui.currentTab === 'audit'" />
      </main>

    </div>

  </div>

  <!-- Plan Limit / Upgrade Modal -->
  <Teleport to="body">
    <div v-if="plan.limitError" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="plan.clearLimitError()">
      <div class="bg-white rounded-2xl p-8 max-w-sm mx-4 shadow-2xl text-center">
        <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 class="text-lg font-black text-slate-900 mb-2">Recurso não disponível</h3>
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">{{ plan.limitError }}</p>
        <div class="flex gap-3">
          <button @click="plan.clearLimitError()" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Fechar
          </button>
          <a
            href="mailto:suporte@gestorprint.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20Upgrade%20de%20Plano"
            target="_blank"
            @click="plan.clearLimitError()"
            class="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            Solicitar Upgrade
          </a>
        </div>
      </div>
    </div>
  </Teleport>

</template>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
</style>
