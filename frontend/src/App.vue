<script setup lang="ts">
import { ref } from 'vue'
import AppBoard from './components/AppBoard.vue'
import EstimateCalculator from './views/EstimateCalculator.vue'
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
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'

const auth = useAuthStore()
const ui = useUiStore()
</script>

<template>
  <ToastContainer />
  <div v-if="!auth.isAuthenticated">
    <LoginView />
  </div>

  <div v-else class="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden text-sm md:text-base">
    
    <!-- Sidebar Global -->
    <aside class="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm shrink-0 z-20">
      <div class="h-16 flex items-center px-6 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-sm">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          </div>
          <h1 class="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
            GestorPrint
          </h1>
        </div>
      </div>
      
      <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        <button 
          @click="ui.setTab('home')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'home' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          Dashboard
        </button>

        <button 
          v-if="auth.isProduction"
          @click="ui.setTab('board')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'board' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          Produção
        </button>

        <button 
          v-if="auth.isSales"
          @click="ui.setTab('pdv')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'pdv' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          PDV Balcão
        </button>

        <button 
          @click="ui.setTab('customers')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'customers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          Clientes
        </button>

        <button 
          @click="ui.setTab('products')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'products' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
          Insumos
        </button>

        <div v-if="auth.isSales" class="pt-6 pb-2">
          <span class="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Financeiro</span>
        </div>
        <button 
          v-if="auth.isSales"
          @click="ui.setTab('financial')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'financial' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
          Fluxo de Caixa
        </button>

        <button 
          v-if="auth.isSales"
          @click="ui.setTab('expenses')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'expenses' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
          Despesas
        </button>

        <button 
          v-if="auth.isSales"
          @click="ui.setTab('suppliers')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
          Fornecedores
        </button>

        <div v-if="auth.isSales" class="pt-6 pb-2">
          <span class="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Orçamentos</span>
        </div>

        <button 
          @click="ui.setTab('calculator')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'calculator' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Novo Orçamento
        </button>

        <button 
          @click="ui.setTab('estimates')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'estimates' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Histórico
        </button>

        <div v-if="auth.isAdmin" class="pt-6 pb-2">
          <span class="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sistema</span>
        </div>

        <button 
          @click="ui.setTab('settings')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          Configurações
        </button>

        <button 
          v-if="auth.isAdmin"
          @click="ui.setTab('users')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          Gestão de Equipe
        </button>

        <button 
          v-if="auth.isAdmin"
          @click="ui.setTab('reports')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          Relatórios & BI
        </button>
        <button 
          v-if="auth.isAdmin"
          @click="ui.setTab('audit')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Auditoria
        </button>

        <button 
          v-if="auth.isAdmin"
          @click="ui.setTab('ai')" 
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all duration-200', ui.currentTab === 'ai' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800']">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Agente de IA
        </button>

        <!-- Logout Button -->
        <div class="pt-10">
          <button 
            @click="auth.logout()"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Sair do Sistema
          </button>
        </div>
      </nav>

      <!-- User Profile Mini -->
      <div class="p-4 border-t border-slate-100 bg-slate-50/50">
        <div class="flex items-center gap-3 px-2">
          <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm border-2 border-white shadow-sm">
            {{ auth.user?.name.charAt(0) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-black text-slate-900 truncate">{{ auth.user?.name }}</div>
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{{ auth.user?.role }}</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Dynamic View -->
    <div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      
      <!-- Top Header -->
      <header class="h-16 flex items-center justify-between px-4 md:px-8 bg-white border-b border-slate-200 z-10">
        <div>
          <h2 class="font-black text-slate-800 tracking-tight capitalize">{{ ui.currentTab }}</h2>
        </div>
        <div class="flex items-center gap-4">
          <NotificationBell />
          <div class="w-px h-6 bg-slate-100 mx-2"></div>
          <div class="flex items-center gap-3">
            <div class="text-right hidden sm:block">
              <div class="text-xs font-black text-slate-900">{{ auth.user?.name }}</div>
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{{ auth.user?.role }}</div>
            </div>
            <div class="w-10 h-10 rounded-full bg-indigo-50 border-2 border-white shadow-sm flex items-center justify-center text-indigo-600 font-black text-sm">
              {{ auth.user?.name.charAt(0) }}
            </div>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <HomeView v-if="ui.currentTab === 'home'" />
        <AppBoard v-if="ui.currentTab === 'board'" />
        <PdvView v-if="ui.currentTab === 'pdv'" />
        <CustomersView v-if="ui.currentTab === 'customers'" />
        <ProductsView v-if="ui.currentTab === 'products'" />
        <EstimateCalculator v-if="ui.currentTab === 'calculator'" />
        <EstimatesListView v-if="ui.currentTab === 'estimates'" />
        <SettingsView v-if="ui.currentTab === 'settings'" />
        <FinancialView v-if="ui.currentTab === 'financial'" />
        <ExpensesView v-if="ui.currentTab === 'expenses'" />
        <SuppliersView v-if="ui.currentTab === 'suppliers'" />
        <UsersView v-if="ui.currentTab === 'users'" />
        <ReportsView v-if="ui.currentTab === 'reports'" />
        <AiView v-if="ui.currentTab === 'ai'" />
        <AuditView v-if="ui.currentTab === 'audit'" />
      </main>

    </div>

  </div>
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
