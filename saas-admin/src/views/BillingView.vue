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
          <p class="text-slate-500 mt-1 font-medium italic">Overview de assinaturas — gerencie em detalhe na página do tenant</p>
        </div>
        <button @click="fetchAll" :disabled="pageLoading"
          class="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-60">
          <svg v-if="!pageLoading" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <div v-else class="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Atualizar
        </button>
      </div>

      <!-- Config Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-xl shadow-slate-200/60">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Webhook URL</p>
          <div class="flex items-center gap-2">
            <code class="text-xs text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg truncate flex-1 border border-indigo-100">{{ config?.webhookUrl || '—' }}</code>
            <button @click="copyWebhookUrl" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0" title="Copiar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Read-only table -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div class="w-2 h-6 bg-emerald-500 rounded-full"></div>
            Status Asaas por Tenant
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
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="t in tenants" :key="t.id" class="hover:bg-indigo-50/30 transition-colors">
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
                  <span v-else class="text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">Pendente</span>
                </td>
                <td class="px-6 py-4">
                  <span v-if="t.asaasCustomerId" class="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">{{ t.asaasCustomerId }}</span>
                  <span v-else class="text-xs text-slate-400 italic">Não criado</span>
                </td>
                <td class="px-6 py-4">
                  <span v-if="t.asaasSubscriptionId" class="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">{{ t.asaasSubscriptionId }}</span>
                  <span v-else class="text-xs text-slate-400 italic">Sem assinatura</span>
                </td>
                <td class="px-6 py-4">
                  <RouterLink :to="`/tenants/${t.id}`"
                    class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors border border-indigo-100 whitespace-nowrap">
                    Gerenciar →
                  </RouterLink>
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
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import SidebarLayout from '../components/SidebarLayout.vue'
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

const config = ref<any>(null)
const tenants = ref<Tenant[]>([])
const pageLoading = ref(false)

const fetchAll = async () => {
  pageLoading.value = true
  try {
    const [cfgRes, tenantsRes] = await Promise.all([
      apiFetch('/api/billing/config'),
      apiFetch('/api/tenants'),
    ])
    if (cfgRes.ok) config.value = await cfgRes.json()
    if (tenantsRes.ok) tenants.value = await tenantsRes.json()
  } finally {
    pageLoading.value = false
  }
}

const copyWebhookUrl = () => {
  if (config.value?.webhookUrl) navigator.clipboard.writeText(config.value.webhookUrl)
}

onMounted(fetchAll)
</script>
