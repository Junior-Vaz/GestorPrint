<template>
  <div class="flex h-screen overflow-hidden bg-linear-to-br from-slate-100 via-indigo-50/40 to-purple-50/30">

    <!-- Sidebar -->
    <aside class="w-64 shrink-0 flex flex-col bg-white/80 backdrop-blur-xl border-r border-white/60 shadow-xl shadow-slate-200/40 z-20">

      <!-- Logo -->
      <div class="h-16 flex items-center gap-3 px-5 border-b border-slate-100/60">
        <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">GestorPrint</h1>
          <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Admin Panel</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p class="px-3 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plataforma</p>
        <RouterLink
          v-for="item in navItems" :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
          :class="route.path === item.to
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/60 scale-[1.02]'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'"
        >
          <span v-html="item.icon" class="w-5 h-5 shrink-0 [&>svg]:w-5 [&>svg]:h-5"></span>
          {{ item.label }}
        </RouterLink>

        <div class="mx-0 pt-3 pb-1">
          <p class="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sistema</p>
        </div>
        <RouterLink
          to="/settings"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
          :class="route.path === '/settings'
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/60 scale-[1.02]'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'"
        >
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
          </svg>
          Configurações
        </RouterLink>
      </nav>

      <!-- Divider -->
      <div class="mx-4 border-t border-slate-100/80"></div>

      <!-- User Info -->
      <div class="p-3 pb-4">
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-100 mb-2">
          <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-md shadow-indigo-200">
            {{ initials }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-slate-800 text-xs font-bold truncate">{{ auth.user?.name || auth.user?.email }}</p>
            <p class="text-indigo-500 text-[10px] font-bold uppercase tracking-wider truncate">Super Admin</p>
          </div>
        </div>
        <button @click="handleLogout"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Sair
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Topbar -->
      <header class="h-16 shrink-0 bg-white/60 backdrop-blur-md border-b border-white/60 shadow-sm flex items-center justify-between px-6 z-10">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-5 rounded-full" :style="{ backgroundColor: accentColor }"></div>
          <h1 class="text-base font-extrabold text-slate-800 tracking-tight">{{ pageTitle }}</h1>
        </div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          Plataforma segura
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
  },
  {
    to: '/tenants',
    label: 'Tenants',
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>',
  },
  {
    to: '/billing',
    label: 'Cobrança (Asaas)',
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>',
  },
]

const pageMeta: Record<string, { title: string; color: string }> = {
  '/dashboard': { title: 'Dashboard da Plataforma', color: '#6366f1' },
  '/tenants':   { title: 'Gestão de Tenants',        color: '#a855f7' },
  '/billing':   { title: 'Cobrança — Asaas',         color: '#10b981' },
  '/settings':  { title: 'Configurações da Plataforma', color: '#f59e0b' },
}

const pageTitle  = computed(() => pageMeta[route.path]?.title  || 'Admin Panel')
const accentColor = computed(() => pageMeta[route.path]?.color || '#6366f1')

const initials = computed(() => {
  const name: string = auth.user?.name || auth.user?.email || 'SA'
  return name.slice(0, 2).toUpperCase()
})

const handleLogout = () => {
  auth.logout()
  router.push('/login')
}
</script>
