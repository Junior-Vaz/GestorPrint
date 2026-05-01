<template>
  <div class="flex h-screen overflow-hidden bg-slate-50">

    <!-- Sidebar — fundo escuro pra distinguir do ERP do cliente (cockpit/admin vibe) -->
    <aside class="w-60 shrink-0 flex flex-col bg-slate-900 text-slate-300 border-r border-slate-800 z-20">

      <!-- Logo -->
      <div class="h-14 flex items-center gap-3 px-4 border-b border-slate-800">
        <div class="w-8 h-8 rounded-md bg-white flex items-center justify-center shrink-0">
          <svg class="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <div class="min-w-0">
          <h1 class="text-sm font-semibold tracking-tight text-white leading-tight truncate">GestorPrint</h1>
          <p class="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em] leading-none mt-0.5">SaaS Admin</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <p class="px-3 pt-1 pb-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-[0.18em]">Plataforma</p>
        <RouterLink
          v-for="item in navItems" :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors"
          :class="route.path === item.to || (item.to === '/tenants' && route.path.startsWith('/tenants/'))
            ? 'bg-slate-800 text-white font-medium'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'"
        >
          <span v-html="item.icon" class="w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4"></span>
          {{ item.label }}
        </RouterLink>

        <p class="px-3 pt-4 pb-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-[0.18em]">Sistema</p>
        <RouterLink
          to="/logs"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors"
          :class="route.path === '/logs'
            ? 'bg-slate-800 text-white font-medium'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-6 4h6"/>
          </svg>
          Logs
        </RouterLink>
        <RouterLink
          to="/team"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors"
          :class="route.path === '/team'
            ? 'bg-slate-800 text-white font-medium'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          Equipe
        </RouterLink>
        <RouterLink
          to="/settings"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors"
          :class="route.path === '/settings'
            ? 'bg-slate-800 text-white font-medium'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Configurações
        </RouterLink>
      </nav>

      <!-- User Info -->
      <div class="border-t border-slate-800 p-3">
        <div class="flex items-center gap-3 px-2 py-2 rounded-md mb-1">
          <div class="w-7 h-7 rounded-md bg-slate-700 flex items-center justify-center text-white text-[11px] font-medium shrink-0">
            {{ initials }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-white text-xs font-medium truncate">{{ auth.user?.name || auth.user?.email }}</p>
            <p class="text-slate-500 text-[10px] font-mono uppercase tracking-wider truncate">Super Admin</p>
          </div>
        </div>
        <button @click="handleLogout"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Sair
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Topbar — minimalista, info densa, com breadcrumb-like indicator -->
      <header class="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{{ pageSection }}</span>
          <span class="text-slate-300">/</span>
          <h1 class="text-sm font-medium text-slate-900 truncate">{{ pageTitle }}</h1>
        </div>
        <div class="flex items-center gap-3">
          <!-- Status indicator: pequeno, "operations" vibe -->
          <div class="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>SISTEMA ONLINE</span>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto bg-slate-50">
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
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
  },
  {
    to: '/tenants',
    label: 'Tenants',
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>',
  },
  {
    to: '/plans',
    label: 'Planos',
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/></svg>',
  },
]

// Breadcrumb-like meta. Section = grupo (Plataforma / Sistema), título = página atual.
const pageMeta: Record<string, { section: string; title: string }> = {
  '/dashboard': { section: 'Plataforma', title: 'Dashboard' },
  '/tenants':   { section: 'Plataforma', title: 'Tenants' },
  '/plans':     { section: 'Plataforma', title: 'Planos' },
  '/settings':  { section: 'Sistema',    title: 'Configurações' },
  '/logs':      { section: 'Sistema',    title: 'Logs' },
  '/team':      { section: 'Sistema',    title: 'Equipe da plataforma' },
}

// Detalhe de tenant precisa ser tratado pelo prefixo
const pageTitle = computed(() => {
  if (route.path.startsWith('/tenants/') && route.path !== '/tenants') return 'Detalhe do Tenant'
  return pageMeta[route.path]?.title || 'Admin Panel'
})
const pageSection = computed(() => {
  if (route.path.startsWith('/tenants/') && route.path !== '/tenants') return 'Plataforma · Tenants'
  return pageMeta[route.path]?.section || 'Plataforma'
})

const initials = computed(() => {
  const name: string = auth.user?.name || auth.user?.email || 'SA'
  return name.slice(0, 2).toUpperCase()
})

const handleLogout = () => {
  auth.logout()
  router.push('/login')
}
</script>
