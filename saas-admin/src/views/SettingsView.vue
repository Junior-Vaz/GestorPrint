<template>
  <SidebarLayout>
    <div class="p-6 max-w-4xl mx-auto space-y-5">

      <!-- Header -->
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-[11px] font-mono text-slate-400 uppercase tracking-[0.18em]">
            Configurações da plataforma
          </p>
          <h1 class="text-[22px] font-medium text-slate-900 mt-0.5 tracking-tight">Integrações & secrets</h1>
        </div>
        <div class="flex gap-2">
          <button @click="fetchAll" :disabled="loading"
            class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors">
            <svg v-if="!loading" class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <div v-else class="h-3.5 w-3.5 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
            Recarregar
          </button>
          <button @click="saveAll" :disabled="!dirty || saving"
            class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50">
            <span v-if="saving" class="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            {{ saving ? 'Salvando...' : 'Salvar alterações' }}
          </button>
        </div>
      </div>

      <!-- Aviso explicativo de comportamento -->
      <div class="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start gap-2.5">
        <svg class="w-4 h-4 mt-0.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-xs text-slate-600 leading-relaxed">
          Configurações vivem no banco — secrets sensíveis ficam mascarados (<span class="font-mono">****1234</span>).
          Deixar um campo vazio + salvar volta a usar a env var como fallback (útil em dev).
          Mudanças propagam em até <span class="font-mono">30s</span> (TTL do cache).
        </p>
      </div>

      <!-- Loading -->
      <div v-if="loading && !settings" class="flex items-center justify-center py-16">
        <div class="h-6 w-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>

      <template v-else-if="settings">

        <!-- Tabs — separa Asaas / SMTP / URLs em visões focadas -->
        <div class="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div class="flex gap-0 border-b border-slate-200 px-5">
            <button v-for="tab in SETTINGS_TABS" :key="tab.id" @click="activeTab = tab.id"
              :class="['inline-flex items-center gap-2 px-3 py-3 text-xs font-medium transition-colors -mb-px border-b-2',
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900']">
              <span>{{ tab.label }}</span>
              <span :class="['inline-flex px-1.5 py-0 rounded text-[9px] font-mono uppercase tracking-wider',
                tabStatus(tab.id).cls]">
                {{ tabStatus(tab.id).label }}
              </span>
            </button>
          </div>

        <!-- ─── Asaas ─────────────────────────────────────────────────────────── -->
        <section v-if="activeTab === 'asaas'">
          <div class="p-5 space-y-4">
            <FieldEditor
              label="API Key"
              keyName="asaasApiKey"
              :setting="settings.asaasApiKey"
              :draft="drafts.asaasApiKey"
              @update="(v: string) => drafts.asaasApiKey = v"
              placeholder="$aact_..."
              hint="Painel Asaas → Integrações → Chaves de API"
            />
            <div>
              <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Ambiente</label>
              <div class="flex gap-2">
                <button v-for="opt in ['sandbox', 'production']" :key="opt"
                  @click="drafts.asaasEnv = opt"
                  :class="['px-3 py-1.5 rounded-md text-[11px] font-mono uppercase tracking-wider transition-colors border',
                    drafts.asaasEnv === opt
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50']">
                  {{ opt }}
                </button>
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5 font-mono">
                <span class="text-slate-500">DB:</span> {{ settings.asaasEnv?.value || '(vazio)' }}
                <span v-if="settings.asaasEnv?.fromEnv" class="ml-2 text-amber-700">via env var</span>
              </p>
            </div>
            <FieldEditor
              label="Webhook token"
              keyName="asaasWebhookToken"
              :setting="settings.asaasWebhookToken"
              :draft="drafts.asaasWebhookToken"
              @update="(v: string) => drafts.asaasWebhookToken = v"
              placeholder="Qualquer string secreta"
              hint="Cadastrar no painel Asaas → Webhooks → Token de autenticação"
            />
            <!-- URL do webhook (só leitura) -->
            <div class="border border-slate-100 rounded-md bg-slate-50 p-3">
              <div class="flex items-center justify-between mb-1.5">
                <p class="text-[10px] font-mono text-slate-500 uppercase tracking-wider">URL do webhook (cole no Asaas)</p>
                <span v-if="apiUrlMissing"
                  class="text-[10px] font-mono text-amber-700 uppercase tracking-wider">fallback dev</span>
              </div>
              <div class="flex items-center gap-2">
                <code class="flex-1 text-xs text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-md font-mono truncate">
                  {{ webhookUrl || '—' }}
                </code>
                <button @click="copy(webhookUrl, 'webhook')" :disabled="!webhookUrl"
                  class="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors shrink-0">
                  {{ copied === 'webhook' ? 'Copiado!' : 'Copiar' }}
                </button>
              </div>
              <p v-if="apiUrlMissing" class="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                A API URL não está cadastrada — usando o host atual como fallback.
                <button @click="activeTab = 'urls'"
                  class="underline font-medium hover:text-amber-900 transition-colors">
                  Configurar agora
                </button>
              </p>
            </div>
          </div>
        </section>

        <!-- ─── SMTP ──────────────────────────────────────────────────────────── -->
        <section v-if="activeTab === 'smtp'">
          <div class="p-5 space-y-4">
            <p class="text-[11px] text-slate-500 leading-relaxed">
              Usado pra emails da plataforma (trial vencendo, fatura, recuperação de senha do super admin).
              <strong>Não é</strong> o SMTP do tenant — esse fica no ERP de cada cliente.
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldEditor
                label="Host"
                keyName="smtpHost"
                :setting="settings.smtpHost"
                :draft="drafts.smtpHost"
                @update="(v: string) => drafts.smtpHost = v"
                placeholder="smtp.gmail.com"
              />
              <FieldEditor
                label="Porta"
                keyName="smtpPort"
                :setting="settings.smtpPort"
                :draft="drafts.smtpPort"
                @update="(v: string) => drafts.smtpPort = v"
                placeholder="587"
              />
              <FieldEditor
                label="Usuário"
                keyName="smtpUser"
                :setting="settings.smtpUser"
                :draft="drafts.smtpUser"
                @update="(v: string) => drafts.smtpUser = v"
                placeholder="email@dominio.com"
              />
              <FieldEditor
                label="Senha"
                keyName="smtpPass"
                :setting="settings.smtpPass"
                :draft="drafts.smtpPass"
                @update="(v: string) => drafts.smtpPass = v"
                placeholder="senha do SMTP"
              />
              <div class="sm:col-span-2">
                <FieldEditor
                  label="From (remetente)"
                  keyName="smtpFrom"
                  :setting="settings.smtpFrom"
                  :draft="drafts.smtpFrom"
                  @update="(v: string) => drafts.smtpFrom = v"
                  placeholder="GestorPrint <noreply@dominio.com>"
                  hint="Vazio = usa o smtpUser"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- ─── URLs ──────────────────────────────────────────────────────────── -->
        <section v-if="activeTab === 'urls'">
          <div class="p-5 space-y-4">
            <FieldEditor
              label="API URL"
              keyName="apiUrl"
              :setting="settings.apiUrl"
              :draft="drafts.apiUrl"
              @update="(v: string) => drafts.apiUrl = v"
              placeholder="https://api.gestorprint.com.br"
              hint="Usado pra montar a URL do webhook Asaas. Sem barra no final."
            />
          </div>
        </section>

        </div><!-- /tabs container -->

      </template>
    </div>

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
import { ref, reactive, computed, onMounted } from 'vue'
import SidebarLayout from '../components/SidebarLayout.vue'
import AlertModal from '../components/AlertModal.vue'
import FieldEditor from '../components/SettingFieldEditor.vue'
import { apiFetch } from '../utils/api'

// Estrutura de uma config — vem do backend já mascarada se isSecret
interface Setting { value: string; isSecret: boolean; fromEnv: boolean }

interface PlatformSettings {
  asaasApiKey:        Setting
  asaasEnv:           Setting
  asaasWebhookToken:  Setting
  smtpHost:           Setting
  smtpPort:           Setting
  smtpUser:           Setting
  smtpPass:           Setting
  smtpFrom:           Setting
  apiUrl:             Setting
}

const settings = ref<PlatformSettings | null>(null)
const loading = ref(false)
const saving = ref(false)
const copied = ref<string | null>(null)

// Tabs — separa Asaas / SMTP / URLs em visões focadas pra reduzir scroll
const SETTINGS_TABS = [
  { id: 'asaas', label: 'Asaas' },
  { id: 'smtp',  label: 'SMTP'  },
  { id: 'urls',  label: 'URLs'  },
] as const
type SettingsTabId = typeof SETTINGS_TABS[number]['id']
const activeTab = ref<SettingsTabId>('asaas')

// Calcula o status do bloco pra mostrar como badge no tab
function tabStatus(id: SettingsTabId): { label: string; cls: string } {
  if (!settings.value) return { label: '...', cls: 'bg-slate-100 text-slate-400' }
  if (id === 'asaas') {
    return settings.value.asaasApiKey?.value
      ? { label: 'OK',       cls: 'bg-emerald-50 text-emerald-700' }
      : { label: 'Pendente', cls: 'bg-red-50 text-red-700' }
  }
  if (id === 'smtp') {
    return settings.value.smtpHost?.value
      ? { label: 'OK',       cls: 'bg-emerald-50 text-emerald-700' }
      : { label: 'Opcional', cls: 'bg-amber-50 text-amber-700' }
  }
  return settings.value.apiUrl?.value
    ? { label: 'OK',       cls: 'bg-emerald-50 text-emerald-700' }
    : { label: 'Pendente', cls: 'bg-amber-50 text-amber-700' }
}

// Drafts: o que o usuário está digitando. Quando bater igual ao value mascarado
// não enviamos (evita reescrever ****1234 como senha real).
// Tipo fixo (não Record<string,string>) pra evitar string|undefined no strict mode.
type DraftKeys =
  | 'asaasApiKey' | 'asaasEnv' | 'asaasWebhookToken'
  | 'smtpHost' | 'smtpPort' | 'smtpUser' | 'smtpPass' | 'smtpFrom'
  | 'apiUrl'
const drafts = reactive<Record<DraftKeys, string>>({
  asaasApiKey: '', asaasEnv: 'sandbox', asaasWebhookToken: '',
  smtpHost: '', smtpPort: '', smtpUser: '', smtpPass: '', smtpFrom: '',
  apiUrl: '',
})

const alert = reactive({ show: false, type: 'success' as 'error' | 'warning' | 'success', title: '', message: '' })

const showAlert = (type: typeof alert.type, title: string, message: string) => {
  alert.type = type; alert.title = title; alert.message = message; alert.show = true
}

// Construímos a webhookUrl com base no apiUrl atual (preferência: draft, depois DB).
// Se nada estiver configurado, caímos pra origem da aba (fallback útil em dev:
// o painel admin roda em :5174, o backend em :3000, e o webhook do Asaas vai
// precisar do domínio público real depois — mas em dev fica funcional).
const webhookUrl = computed(() => {
  const base = drafts.apiUrl || settings.value?.apiUrl?.value || ''
  if (base) return `${base.replace(/\/$/, '')}/api/billing/webhooks`
  // Fallback: usa o host atual trocando a porta pra 3000 (convenção de dev)
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(window.location.origin)
      // Em dev (porta 5174) trocamos pra 3000 onde o backend escuta
      if (u.port === '5174') u.port = '3000'
      return `${u.origin.replace(/\/$/, '')}/api/billing/webhooks`
    } catch { /* ignore */ }
  }
  return ''
})

// True quando o apiUrl não está configurado no banco — nesse caso o webhookUrl
// está usando o fallback de dev e o admin precisa salvar a URL real antes de
// colar no painel Asaas
const apiUrlMissing = computed(() => {
  const v = drafts.apiUrl || settings.value?.apiUrl?.value || ''
  return !v
})

// Marca dirty quando algum draft difere do estado salvo (e não é placeholder mascarado)
const dirty = computed(() => {
  if (!settings.value) return false
  for (const key of Object.keys(drafts) as (keyof PlatformSettings)[]) {
    const current = settings.value[key]
    if (!current) continue
    const draft = drafts[key]
    // Secret não foi tocado — mostra **** mas o draft está vazio (sentinel) → não é dirty
    if (current.isSecret && draft === '') continue
    // Secret foi tocado e está diferente do mascarado → é edição real
    if (current.isSecret && draft !== current.value) return true
    // Não-secret: compara direto
    if (!current.isSecret && draft !== current.value) return true
  }
  return false
})

const fetchAll = async () => {
  loading.value = true
  try {
    const res = await apiFetch('/api/admin/platform-settings')
    if (res.ok) {
      settings.value = await res.json()
      // Inicializa drafts: secrets ficam vazios (preserva mascaramento), não-secrets carregam o valor
      if (settings.value) {
        for (const key of Object.keys(settings.value) as (keyof PlatformSettings)[]) {
          drafts[key] = settings.value[key].isSecret ? '' : (settings.value[key].value || '')
        }
        // Default sandbox se vazio
        if (!drafts.asaasEnv) drafts.asaasEnv = 'sandbox'
      }
    } else {
      showAlert('error', 'Falha ao carregar', 'Não foi possível buscar as configurações da plataforma.')
    }
  } finally { loading.value = false }
}

const saveAll = async () => {
  if (!settings.value) return
  saving.value = true
  try {
    // Monta payload só com campos alterados
    const payload: Record<string, string> = {}
    for (const key of Object.keys(drafts) as (keyof PlatformSettings)[]) {
      const current = settings.value[key]
      const draft = drafts[key]
      // Secret vazio = não tocou (preservar)
      if (current.isSecret && draft === '') continue
      // Secret diferente do mascarado = nova senha real
      if (current.isSecret && draft !== current.value) {
        payload[key] = draft
      }
      // Não-secret diferente = editou
      if (!current.isSecret && draft !== current.value) {
        payload[key] = draft
      }
    }

    if (Object.keys(payload).length === 0) {
      saving.value = false
      return
    }

    const res = await apiFetch('/api/admin/platform-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      showAlert('success', 'Configurações salvas', 'As alterações entram em vigor em até 30s.')
      await fetchAll()
    } else {
      const err = await res.json().catch(() => ({}))
      showAlert('error', 'Erro ao salvar', err.message || 'Falha desconhecida.')
    }
  } finally { saving.value = false }
}

const copy = async (text: string, key: string) => {
  if (!text) return
  await navigator.clipboard.writeText(text)
  copied.value = key
  setTimeout(() => (copied.value = null), 2000)
}

onMounted(fetchAll)
</script>
