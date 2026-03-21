<template>
  <SidebarLayout>
    <div class="p-6 max-w-5xl mx-auto space-y-6">

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <div class="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-100">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
              </svg>
            </div>
            Configurações
          </h1>
          <p class="text-slate-500 mt-1 font-medium italic">Status das integrações e variáveis de ambiente da plataforma</p>
        </div>
        <button
          @click="fetchSettings"
          :disabled="loading"
          class="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-100 active:scale-95 disabled:opacity-60"
        >
          <svg v-if="!loading" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <div v-else class="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Atualizar
        </button>
      </div>

      <!-- Status Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Asaas API Key -->
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-xl shadow-slate-200/60 flex items-center gap-4">
          <div :class="['w-12 h-12 rounded-xl flex items-center justify-center shrink-0', settings?.asaasConfigured ? 'bg-emerald-100' : 'bg-red-100']">
            <svg class="w-6 h-6" :class="settings?.asaasConfigured ? 'text-emerald-600' : 'text-red-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="settings?.asaasConfigured" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Asaas API Key</p>
            <p class="text-lg font-extrabold mt-0.5" :class="settings?.asaasConfigured ? 'text-emerald-600' : 'text-red-500'">
              {{ settings?.asaasConfigured ? 'Configurada' : 'Não configurada' }}
            </p>
            <p class="text-xs text-slate-400 mt-0.5 font-medium capitalize">{{ settings?.asaasEnv || '—' }}</p>
          </div>
        </div>

        <!-- SMTP -->
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-xl shadow-slate-200/60 flex items-center gap-4">
          <div :class="['w-12 h-12 rounded-xl flex items-center justify-center shrink-0', settings?.smtpConfigured ? 'bg-emerald-100' : 'bg-amber-100']">
            <svg class="w-6 h-6" :class="settings?.smtpConfigured ? 'text-emerald-600' : 'text-amber-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">SMTP / Email</p>
            <p class="text-lg font-extrabold mt-0.5" :class="settings?.smtpConfigured ? 'text-emerald-600' : 'text-amber-500'">
              {{ settings?.smtpConfigured ? 'Configurado' : 'Não configurado' }}
            </p>
            <p class="text-xs text-slate-400 mt-0.5 font-medium">{{ settings?.smtpHost || 'Sem host definido' }}</p>
          </div>
        </div>

        <!-- Webhook Token -->
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-xl shadow-slate-200/60 flex items-center gap-4">
          <div :class="['w-12 h-12 rounded-xl flex items-center justify-center shrink-0', settings?.webhookTokenConfigured ? 'bg-emerald-100' : 'bg-amber-100']">
            <svg class="w-6 h-6" :class="settings?.webhookTokenConfigured ? 'text-emerald-600' : 'text-amber-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Webhook Token</p>
            <p class="text-lg font-extrabold mt-0.5" :class="settings?.webhookTokenConfigured ? 'text-emerald-600' : 'text-amber-500'">
              {{ settings?.webhookTokenConfigured ? 'Configurado' : 'Não configurado' }}
            </p>
            <p class="text-xs text-slate-400 mt-0.5 font-mono">{{ settings?.webhookTokenMask || '—' }}</p>
          </div>
        </div>
      </div>

      <!-- Asaas Webhook Config -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div class="w-2 h-6 bg-emerald-500 rounded-full"></div>
            Configuração do Webhook Asaas
          </h2>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">URL do Webhook (configurar no painel Asaas)</label>
            <div class="flex items-center gap-2">
              <code class="flex-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-2.5 rounded-xl font-mono truncate">
                {{ settings?.webhookUrl || '—' }}
              </code>
              <button @click="copy(settings?.webhookUrl || '')"
                class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 shrink-0">
                {{ copied === 'url' ? 'Copiado!' : 'Copiar' }}
              </button>
            </div>
          </div>

          <div class="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-4 text-sm text-amber-800 space-y-1.5">
            <p class="font-bold flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Como configurar a segurança do webhook:
            </p>
            <ol class="list-decimal pl-5 space-y-1 font-medium text-amber-700">
              <li>Acesse o painel do Asaas → Configurações → Webhooks</li>
              <li>Cadastre a URL acima como endpoint do webhook</li>
              <li>Defina um "Token de autenticação" (qualquer string secreta)</li>
              <li>Copie esse token e adicione como variável de ambiente: <code class="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">ASAAS_WEBHOOK_TOKEN</code></li>
              <li>O sistema validará automaticamente o header <code class="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">asaas-access-token</code> em cada requisição</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Env Vars Reference -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div class="w-2 h-6 bg-indigo-500 rounded-full"></div>
            Variáveis de Ambiente Necessárias
          </h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-100">
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Variável</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Descrição</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="env in envVars" :key="env.name" class="hover:bg-indigo-50/30 transition-colors">
                <td class="px-6 py-4">
                  <code class="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">{{ env.name }}</code>
                </td>
                <td class="px-6 py-4 text-sm text-slate-600 font-medium">{{ env.desc }}</td>
                <td class="px-6 py-4">
                  <span :class="['px-3 py-1 rounded-full text-xs font-black inline-flex', env.ok ? 'bg-emerald-100 text-emerald-700' : env.optional ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600']">
                    {{ env.ok ? 'OK' : env.optional ? 'Opcional' : 'Ausente' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Trial Automation Info -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div class="w-2 h-6 bg-purple-500 rounded-full"></div>
            Automação de Trial / Planos
          </h2>
        </div>
        <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
            <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p class="text-sm font-extrabold text-slate-800">Aviso de Trial</p>
            <p class="text-xs text-slate-500 font-medium mt-1">Email enviado 3 dias antes do trial expirar</p>
          </div>
          <div class="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
            <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
              </svg>
            </div>
            <p class="text-sm font-extrabold text-slate-800">Expiração de Trial</p>
            <p class="text-xs text-slate-500 font-medium mt-1">Tenant suspenso automaticamente ao expirar</p>
          </div>
          <div class="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
            <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <p class="text-sm font-extrabold text-slate-800">Expiração de Plano</p>
            <p class="text-xs text-slate-500 font-medium mt-1">Planos expirados suspensos às 02:00 diariamente</p>
          </div>
        </div>
        <div class="px-6 pb-5">
          <div class="bg-indigo-50/80 border border-indigo-100 rounded-2xl px-4 py-3 text-xs text-indigo-700 font-semibold flex items-center gap-2">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Cron job rodando via <code class="bg-indigo-100 px-1.5 py-0.5 rounded font-mono">@Cron('0 2 * * *')</code> — executa todo dia às 02:00 (horário do servidor).
          </div>
        </div>
      </div>

    </div>
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SidebarLayout from '../components/SidebarLayout.vue'
import { apiFetch } from '../utils/api'

interface Settings {
  asaasConfigured: boolean
  asaasEnv: string
  webhookUrl: string
  webhookTokenConfigured: boolean
  webhookTokenMask: string
  smtpConfigured: boolean
  smtpHost: string
}

const settings = ref<Settings | null>(null)
const loading = ref(false)
const copied = ref<string | null>(null)

const envVars = computed(() => [
  { name: 'ASAAS_API_KEY',         desc: 'Chave da API Asaas ($aact_...)',                  ok: settings.value?.asaasConfigured,        optional: false },
  { name: 'ASAAS_ENV',             desc: 'Ambiente: sandbox ou production',                  ok: true,                                   optional: true  },
  { name: 'ASAAS_WEBHOOK_TOKEN',   desc: 'Token de autenticação do webhook Asaas',           ok: settings.value?.webhookTokenConfigured, optional: true  },
  { name: 'API_URL',               desc: 'URL pública da API (ex: https://api.gestorprint.com.br)', ok: true,                           optional: true  },
  { name: 'SMTP_HOST',             desc: 'Servidor SMTP para envio de emails',               ok: settings.value?.smtpConfigured,        optional: true  },
  { name: 'SMTP_PORT',             desc: 'Porta do servidor SMTP (ex: 587)',                  ok: settings.value?.smtpConfigured,        optional: true  },
  { name: 'SMTP_USER',             desc: 'Usuário/email SMTP',                               ok: settings.value?.smtpConfigured,        optional: true  },
  { name: 'SMTP_PASS',             desc: 'Senha do SMTP',                                    ok: settings.value?.smtpConfigured,        optional: true  },
  { name: 'JWT_SECRET',            desc: 'Chave secreta para tokens JWT',                    ok: true,                                   optional: false },
])

const fetchSettings = async () => {
  loading.value = true
  const res = await apiFetch('/api/billing/platform-settings')
  if (res.ok) settings.value = await res.json()
  loading.value = false
}

const copy = async (text: string) => {
  if (!text) return
  await navigator.clipboard.writeText(text)
  copied.value = 'url'
  setTimeout(() => (copied.value = null), 2000)
}

onMounted(fetchSettings)
</script>
