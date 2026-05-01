<script setup lang="ts">
import { ref, onMounted, onErrorCaptured } from 'vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'
import { usePlanStore } from '../../stores/plan'
import { usePermissionsStore } from '../../stores/permissions'
import PaymentSwitch from '../../components/shared/PaymentSwitch.vue'

const { showToast } = useToast()
const plan = usePlanStore()
const perms = usePermissionsStore()

// ── Captura erros de render/setup que iam pro vazio (Vue suprime alguns) ─────
// Sem isso, um TypeError no template (ex: nested property undefined) pode
// resultar em "tela em branco" SEM nada no console. Aqui logamos explícito.
const renderError = ref<string>('')
onErrorCaptured((err, instance, info) => {
  // eslint-disable-next-line no-console
  console.error('[EcommerceSettingsView] erro capturado:', err, '\nfase:', info, '\ninstance:', instance)
  renderError.value = `${(err as Error)?.message || err} (${info})`
  return false  // não propaga — evita que o app inteiro caia
})

interface OriginAddress {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}

interface BusinessHourSlot {
  day: number       // 0 = domingo, 6 = sábado
  open: string      // HH:MM
  close: string     // HH:MM
}

interface BusinessHours {
  enabled: boolean
  timezone: string
  schedule: BusinessHourSlot[]
}

interface StoreConfig {
  storeName: string
  storeDescription: string
  publicEmail: string
  publicPhone: string
  whatsapp: string
  publicAddress: string
  publicHours: string
  instagramUrl: string
  facebookUrl: string
  paymentMethods: { pix: boolean; card: boolean; boleto: boolean }
  returnDays: number
  blockOutOfStock: boolean
  allowGuestCheckout: boolean
  primaryColor: string
  promoBanner: { enabled: boolean; text: string; link: string; color: string }
  businessHours: BusinessHours
  pickupEnabled: boolean
  pickupAddress: string
  pickupInstructions: string
  responsibleCpf: string
  // Modo férias — pausa a loja sem precisar tirar produtos do ar
  vacationMode: boolean
  vacationMessage: string
  vacationReturnsAt: string  // ISO date (YYYY-MM-DD) ou ''
}

interface StoreSettings {
  originCep: string
  originAddress: OriginAddress
  meAccessToken: string
  meEnvironment: 'sandbox' | 'production'
  mpAccessToken: string
  mpPublicKey: string
  mpWebhookSecret: string
  storeConfig: StoreConfig
}

const settings = ref<StoreSettings | null>(null)
const loading = ref(true)
const saving = ref(false)

/**
 * Atualiza um método de pagamento garantindo a existência do objeto pai
 * `paymentMethods`. Em alguns estados (settings recém-carregado de tenant
 * antigo, sem o JSON populado) o objeto pode vir undefined — esse helper
 * cria o shape sob demanda em vez de crashar com TypeError.
 */
function setPaymentMethod(key: 'pix' | 'card' | 'boleto', value: boolean) {
  if (!settings.value) return
  if (!settings.value.storeConfig.paymentMethods) {
    settings.value.storeConfig.paymentMethods = { pix: false, card: false, boleto: false }
  }
  settings.value.storeConfig.paymentMethods[key] = value
}

// Domínio da loja — vive no Tenant, não no Settings, então tem endpoint separado.
// Carregamos junto e salvamos junto pra UX consistente (uma tela de "configurações").
const storeDomain = ref('')
const savingDomain = ref(false)

/**
 * Garante que `storeConfig` e seus subobjetos existam mesmo quando o backend
 * retorna campos vazios (tenant novo, primeira visita à tela). Sem isso,
 * `v-model="settings.storeConfig.paymentMethods.pix"` quebra com TypeError
 * "Cannot read properties of undefined" e a tela fica em branco.
 */
function normalizeSettings(raw: any): StoreSettings {
  const sc = raw?.storeConfig || {}
  const pm = sc.paymentMethods || {}
  return {
    originCep:        raw?.originCep || '',
    originAddress:    raw?.originAddress || {},
    meAccessToken:    raw?.meAccessToken || '',
    meEnvironment:    raw?.meEnvironment || 'sandbox',
    mpAccessToken:    raw?.mpAccessToken || '',
    mpPublicKey:      raw?.mpPublicKey || '',
    mpWebhookSecret:  raw?.mpWebhookSecret || '',
    storeConfig: {
      storeName:          sc.storeName ?? '',
      storeDescription:   sc.storeDescription ?? '',
      publicEmail:        sc.publicEmail ?? '',
      publicPhone:        sc.publicPhone ?? '',
      whatsapp:           sc.whatsapp ?? '',
      publicAddress:      sc.publicAddress ?? '',
      publicHours:        sc.publicHours ?? '',
      instagramUrl:       sc.instagramUrl ?? '',
      facebookUrl:        sc.facebookUrl ?? '',
      paymentMethods: {
        pix:    pm.pix    !== false,   // default ligado
        card:   pm.card   !== false,
        boleto: pm.boleto !== false,
      },
      returnDays:         typeof sc.returnDays === 'number' ? sc.returnDays : 7,
      blockOutOfStock:    sc.blockOutOfStock !== false,
      allowGuestCheckout: sc.allowGuestCheckout !== false,
      primaryColor:       sc.primaryColor ?? '#1D9E75',
      promoBanner: {
        enabled: !!(sc.promoBanner?.enabled),
        text:    String(sc.promoBanner?.text ?? ''),
        link:    String(sc.promoBanner?.link ?? ''),
        color:   String(sc.promoBanner?.color ?? '#0f172a'),
      },
      pickupEnabled:      !!(sc.pickupEnabled),
      pickupAddress:      String(sc.pickupAddress      ?? ''),
      pickupInstructions: String(sc.pickupInstructions ?? ''),
      responsibleCpf:     String(sc.responsibleCpf     ?? ''),
      vacationMode:       !!(sc.vacationMode),
      vacationMessage:    String(sc.vacationMessage    ?? ''),
      vacationReturnsAt:  String(sc.vacationReturnsAt  ?? ''),
      businessHours: {
        enabled:  !!(sc.businessHours?.enabled),
        timezone: String(sc.businessHours?.timezone ?? 'America/Sao_Paulo'),
        // Garante schema saudável (filtra entradas inválidas vindas do JSON)
        schedule: Array.isArray(sc.businessHours?.schedule)
          ? sc.businessHours.schedule
              .filter((s: any) => s && typeof s.day === 'number' && /^\d{2}:\d{2}$/.test(s.open) && /^\d{2}:\d{2}$/.test(s.close))
              .map((s: any) => ({ day: Number(s.day), open: String(s.open), close: String(s.close) }))
          : [],
      },
    },
  }
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/**
 * Adiciona um slot de horário (uma faixa "abre 8h, fecha 18h" pra um dia).
 * Permitido múltiplos slots por dia (pra fechamento de almoço, por ex).
 */
function addHourSlot(day: number) {
  if (!settings.value) return
  settings.value.storeConfig.businessHours.schedule.push({ day, open: '08:00', close: '18:00' })
}

function removeHourSlot(idx: number) {
  if (!settings.value) return
  settings.value.storeConfig.businessHours.schedule.splice(idx, 1)
}

/**
 * Helper: aplica horário comercial padrão (Seg–Sex 8h–18h, Sáb 8h–12h).
 * Vivifica a tela vazia — quase ninguém vai cadastrar 6 entradas na mão.
 */
function applyDefaultSchedule() {
  if (!settings.value) return
  const defaults: BusinessHourSlot[] = [
    { day: 1, open: '08:00', close: '18:00' },
    { day: 2, open: '08:00', close: '18:00' },
    { day: 3, open: '08:00', close: '18:00' },
    { day: 4, open: '08:00', close: '18:00' },
    { day: 5, open: '08:00', close: '18:00' },
    { day: 6, open: '08:00', close: '12:00' },
  ]
  settings.value.storeConfig.businessHours.schedule = defaults
}

const fetchSettings = async () => {
  loading.value = true
  try {
    const [sRes, dRes] = await Promise.all([
      apiFetch('/api/ecommerce/admin/settings'),
      apiFetch('/api/ecommerce/admin/domain'),
    ])
    if (sRes.ok) {
      const raw = await sRes.json()
      settings.value = normalizeSettings(raw)
    }
    if (dRes.ok) {
      const j = await dRes.json()
      storeDomain.value = j.storeDomain || ''
    }
  } finally { loading.value = false }
}

const saveDomain = async () => {
  savingDomain.value = true
  try {
    const res = await apiFetch('/api/ecommerce/admin/domain', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeDomain: storeDomain.value.trim() }),
    })
    if (res.ok) {
      const j = await res.json()
      storeDomain.value = j.storeDomain || ''
      showToast(storeDomain.value ? 'Domínio salvo' : 'Domínio removido', 'success')
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || 'Erro ao salvar domínio', 'error')
    }
  } finally { savingDomain.value = false }
}

const saveSettings = async () => {
  if (!settings.value) return
  saving.value = true
  try {
    const res = await apiFetch('/api/ecommerce/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings.value),
    })
    if (res.ok) {
      showToast('Configurações salvas', 'success')
      // Re-normaliza a resposta (não chama fetchSettings de novo — evita race
      // de re-render que apagava a tela ao mudar switch + save em sequência)
      try {
        const updated = await res.json()
        if (updated && typeof updated === 'object') {
          settings.value = normalizeSettings(updated)
        }
      } catch { /* manter estado local — backend salvou ok */ }
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || 'Erro ao salvar', 'error')
    }
  } catch (e: any) {
    showToast(e?.message || 'Erro inesperado', 'error')
  } finally { saving.value = false }
}

// ── Lookup CEP via ViaCEP ─────────────────────────────────────────────────
// UX: máscara automática + busca quando completa 8 dígitos OU on blur OU
// botão "Buscar". Mostra erro inline e flag de sucesso pra feedback visual.
const cepLoading = ref(false)
const cepError   = ref('')
const cepFound   = ref(false)   // true após encontrar CEP válido — esverdeia a borda

function maskCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

function onCepInput(e: Event) {
  if (!settings.value) return
  const target = e.target as HTMLInputElement
  settings.value.originCep = maskCep(target.value)
  cepError.value = ''
  cepFound.value = false
  // Auto-busca quando completa 8 dígitos (CEP válido)
  if ((settings.value.originCep || '').replace(/\D/g, '').length === 8) {
    lookupCep()
  }
}

const lookupCep = async () => {
  if (!settings.value) return
  const cep = (settings.value.originCep || '').replace(/\D/g, '')
  if (cep.length !== 8) {
    cepError.value = cep.length > 0 ? 'CEP precisa ter 8 dígitos' : ''
    return
  }
  cepLoading.value = true
  cepError.value = ''
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    if (!res.ok) {
      cepError.value = 'Não foi possível consultar o CEP'
      return
    }
    const data = await res.json()
    if (data.erro) {
      cepError.value = 'CEP não encontrado'
      return
    }
    settings.value.originAddress = {
      street:       data.logradouro || '',
      neighborhood: data.bairro || '',
      city:         data.localidade || '',
      state:        data.uf || '',
      number:       settings.value.originAddress?.number || '',
      complement:   settings.value.originAddress?.complement || '',
    }
    cepFound.value = true
  } catch {
    cepError.value = 'Falha ao consultar CEP — verifique sua conexão'
  } finally {
    cepLoading.value = false
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────
// Organização em 5 grupos — a tela vinha crescendo demais (banner promo,
// businessHours, frete, MP, métodos, regras). Tabs mantém UX manejável e dão
// hierarquia visual: o admin acha rápido onde cada coisa vive.
type SettingsTab = 'geral' | 'marketing' | 'envio' | 'pagamentos' | 'regras'
const tab = ref<SettingsTab>('geral')

const TABS: { key: SettingsTab; label: string; description: string }[] = [
  { key: 'geral',       label: 'Geral',        description: 'Domínio e identidade pública' },
  { key: 'marketing',   label: 'Marketing',    description: 'Banner promocional e horário online' },
  { key: 'envio',       label: 'Envio',        description: 'Origem do envio e Melhor Envios' },
  { key: 'pagamentos',  label: 'Pagamentos',   description: 'Mercado Pago e métodos aceitos' },
  { key: 'regras',      label: 'Regras',       description: 'Política e comportamento do checkout' },
]

onMounted(fetchSettings)
</script>

<template>
  <div class="max-w-4xl mx-auto px-6 py-8 space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-xl font-medium text-slate-900">Configurações da loja</h1>
      <p class="text-sm text-slate-500 mt-1">Credenciais, dados públicos e regras do ecommerce</p>
    </div>

    <!-- Banner de erro capturado: visível se algo quebrar no render -->
    <div v-if="renderError" class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
      <div class="font-semibold mb-1">⚠ Erro ao renderizar a tela</div>
      <div class="font-mono text-xs">{{ renderError }}</div>
      <button @click="renderError = ''; fetchSettings()" class="mt-3 inline-flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-medium px-3 py-1.5 rounded-full">
        Recarregar
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="settings" class="space-y-6">
      <!-- ── Tabs nav ─────────────────────────────────────────────────────
           Sticky abaixo do header da view pra permanecer acessível enquanto
           o usuário faz scroll dentro de uma seção longa (ex: Pagamentos
           tem MP + métodos com bastante conteúdo). -->
      <div class="border-b border-slate-200 sticky top-0 bg-white z-10 -mx-6 px-6 pt-1">
        <div class="flex items-center gap-1 overflow-x-auto">
          <button
            v-for="t in TABS" :key="t.key"
            @click="tab = t.key"
            :class="['px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              tab === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700']"
          >
            {{ t.label }}
          </button>
        </div>
        <p class="text-xs text-slate-400 py-2">
          {{ TABS.find(t => t.key === tab)?.description }}
        </p>
      </div>

      <!-- ─────────────────────────────────────────────────────────────────
           ABA: Geral — domínio + dados públicos da loja
           ───────────────────────────────────────────────────────────────── -->
      <template v-if="tab === 'geral'">
      <!-- Domínio da loja — usado pra resolução automática de tenant na SPA do Ecommerce.
           A SPA verifica o hostname e descobre qual loja carregar; sem o domínio aqui
           cadastrado, a SPA mostra "loja não encontrada". -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">Domínio da loja</h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Endereço onde sua loja vai ser hospedada. A SPA do Ecommerce identifica seu tenant pelo domínio.
          </p>
        </div>
        <div class="flex flex-col md:flex-row md:items-end gap-3">
          <div class="flex-1">
            <label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Domínio
            </label>
            <input
              v-model="storeDomain"
              type="text"
              placeholder="loja.minhagrafica.com.br"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:border-slate-400"
              @keydown.enter="saveDomain"
            />
            <p class="text-[11px] text-slate-400 mt-1.5">
              Sem <span class="font-mono">https://</span> e sem caminho. Ex: <span class="font-mono">loja.minhagrafica.com.br</span>.
              Aponte esse domínio (registro DNS A ou CNAME) para o servidor da plataforma.
              Deixe vazio para desativar a loja online.
            </p>
          </div>
          <button
            v-if="perms.can.edit('ecommerce-settings')"
            @click="saveDomain"
            :disabled="savingDomain"
            class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-full px-5 py-2 transition-colors"
          >
            <span v-if="savingDomain" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
            <span v-else>Salvar domínio</span>
          </button>
        </div>
        <div v-if="storeDomain" class="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 flex items-start gap-2">
          <svg class="w-4 h-4 mt-0.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          <div>
            <span class="font-medium text-slate-900">Loja online em:</span>
            <a :href="`https://${storeDomain}`" target="_blank" class="text-slate-700 underline ml-1 font-mono">{{ storeDomain }}</a>
          </div>
        </div>
      </section>

      <!-- Loja (dados públicos) -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">Loja</h2>
          <p class="text-xs text-slate-500 mt-0.5">Dados que aparecem no site para o cliente final</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Nome da loja</label>
            <input v-model="settings.storeConfig.storeName" type="text"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Cor primária</label>
            <div class="flex items-center gap-2">
              <input v-model="settings.storeConfig.primaryColor" type="color"
                class="w-10 h-9 border border-slate-200 rounded cursor-pointer" />
              <input v-model="settings.storeConfig.primaryColor" type="text"
                class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
            </div>
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1.5">Descrição curta</label>
            <input v-model="settings.storeConfig.storeDescription" type="text" maxlength="160"
              placeholder="Sua gráfica de confiança em…"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Email público</label>
            <input v-model="settings.storeConfig.publicEmail" type="email"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Telefone</label>
            <input v-model="settings.storeConfig.publicPhone" type="tel"
              placeholder="(11) 99999-9999"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1.5">WhatsApp (apenas números, com DDI)</label>
            <input v-model="settings.storeConfig.whatsapp" type="tel"
              placeholder="5511999999999"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1.5">Endereço público</label>
            <input v-model="settings.storeConfig.publicAddress" type="text"
              placeholder="Centro, Cidade — UF"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Horário de atendimento</label>
            <input v-model="settings.storeConfig.publicHours" type="text"
              placeholder="Seg a sáb · 08h — 18h"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Instagram (URL completa)</label>
            <input v-model="settings.storeConfig.instagramUrl" type="url"
              placeholder="https://instagram.com/sualoja"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1.5">Facebook (URL completa)</label>
            <input v-model="settings.storeConfig.facebookUrl" type="url"
              placeholder="https://facebook.com/sualoja"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
        </div>
      </section>
      </template>

      <!-- ─────────────────────────────────────────────────────────────────
           ABA: Marketing — banner promocional + horário online
           ───────────────────────────────────────────────────────────────── -->
      <template v-if="tab === 'marketing'">
      <!-- Horário de atendimento estruturado — usado pelo "Online agora" no
           botão flutuante do WhatsApp na loja. Quando ativado, o site avalia
           hora local (timezone configurável) contra a tabela e mostra um ponto
           verde se o cliente pode esperar resposta rápida. -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">Horário de atendimento (online agora)</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Habilite pra mostrar um indicador verde "online agora" no botão de WhatsApp
              da loja durante o expediente. Funciona em paralelo ao texto livre acima.
            </p>
          </div>
          <PaymentSwitch
            label="Ativo"
            :enabled="true"
            description=""
            :model-value="settings.storeConfig.businessHours.enabled"
            @update:model-value="settings.storeConfig.businessHours.enabled = $event"
          />
        </div>

        <div v-show="settings.storeConfig.businessHours.enabled" class="space-y-4">
          <!-- Botão de preset rápido pra evitar clicar 6x -->
          <div v-if="settings.storeConfig.businessHours.schedule.length === 0" class="bg-slate-50 rounded-lg p-4 text-center">
            <p class="text-xs text-slate-500 mb-2">Nenhuma faixa cadastrada ainda.</p>
            <button
              @click="applyDefaultSchedule"
              type="button"
              class="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-2"
            >
              Aplicar horário comercial padrão (Seg–Sex 8h–18h, Sáb 8h–12h)
            </button>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="(slot, idx) in settings.storeConfig.businessHours.schedule"
              :key="idx"
              class="flex items-center gap-2"
            >
              <select
                v-model.number="slot.day"
                class="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:border-slate-400"
              >
                <option v-for="(label, d) in DAY_LABELS" :key="d" :value="d">{{ label }}</option>
              </select>
              <input
                v-model="slot.open"
                type="time"
                class="border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-slate-400"
              />
              <span class="text-xs text-slate-400">até</span>
              <input
                v-model="slot.close"
                type="time"
                class="border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-slate-400"
              />
              <button
                @click="removeHourSlot(idx)"
                type="button"
                class="ml-auto text-xs text-red-600 hover:text-red-800 px-2 py-1"
                aria-label="Remover faixa"
              >Remover</button>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span class="text-xs text-slate-500">Adicionar faixa:</span>
            <button
              v-for="(label, d) in DAY_LABELS"
              :key="d"
              @click="addHourSlot(d)"
              type="button"
              class="text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5"
            >+ {{ label }}</button>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Fuso horário</label>
            <select
              v-model="settings.storeConfig.businessHours.timezone"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-slate-400"
            >
              <option value="America/Sao_Paulo">São Paulo (Brasil — Horário de Brasília)</option>
              <option value="America/Manaus">Manaus (BR — AMT)</option>
              <option value="America/Belem">Belém (BR — BRT)</option>
              <option value="America/Cuiaba">Cuiabá (BR — AMT)</option>
              <option value="America/Recife">Recife (BR — BRT)</option>
              <option value="America/Fortaleza">Fortaleza (BR — BRT)</option>
              <option value="America/Rio_Branco">Rio Branco (BR — ACT)</option>
            </select>
            <p class="text-[11px] text-slate-400 mt-1">A loja avalia o horário local conforme esse fuso, não o do navegador do cliente.</p>
          </div>
        </div>
      </section>

      <!-- Banner promocional — barra fina no topo de toda página da loja.
           Útil pra promoções globais, frete grátis acima de X, código de cupom,
           anúncios temporários. Opcional (toggle on/off). -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">Banner promocional</h2>
            <p class="text-xs text-slate-500 mt-0.5">Barra fina que aparece no topo de toda página da loja. Use pra anúncios globais.</p>
          </div>
          <PaymentSwitch
            label="Ativo"
            :enabled="true"
            description=""
            :model-value="settings.storeConfig.promoBanner.enabled"
            @update:model-value="settings.storeConfig.promoBanner.enabled = $event"
          />
        </div>

        <div v-show="settings.storeConfig.promoBanner.enabled" class="space-y-3">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Texto</label>
            <input
              v-model="settings.storeConfig.promoBanner.text"
              type="text"
              maxlength="160"
              placeholder="🚚 Frete grátis acima de R$ 199 · use o cupom BEMVINDO10"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <p class="text-[11px] text-slate-400 mt-1">Aceita emojis. Mantenha curto pra ler no mobile.</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="md:col-span-2">
              <label class="block text-xs text-slate-500 mb-1.5">Link <span class="text-slate-400 font-normal">(opcional)</span></label>
              <input
                v-model="settings.storeConfig.promoBanner.link"
                type="text"
                placeholder="/catalogo · /produto/cartao · https://..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400"
              />
              <p class="text-[11px] text-slate-400 mt-1">Se preencher, o banner inteiro vira clicável.</p>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Cor de fundo</label>
              <div class="flex items-center gap-2">
                <input v-model="settings.storeConfig.promoBanner.color" type="color"
                  class="w-10 h-9 border border-slate-200 rounded cursor-pointer" />
                <input v-model="settings.storeConfig.promoBanner.color" type="text"
                  class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
              </div>
            </div>
          </div>

          <!-- Preview ao vivo -->
          <div class="border border-slate-200 rounded-lg overflow-hidden">
            <div class="bg-slate-100 px-3 py-1.5 text-[11px] text-slate-500 uppercase tracking-wide">Preview</div>
            <div
              class="text-center text-xs font-medium py-2 px-4"
              :style="{ background: settings.storeConfig.promoBanner.color, color: '#fff' }"
            >
              {{ settings.storeConfig.promoBanner.text || 'Configure o texto acima' }}
            </div>
          </div>
        </div>
      </section>
      </template>

      <!-- ─────────────────────────────────────────────────────────────────
           ABA: Envio — origem + Melhor Envios
           ───────────────────────────────────────────────────────────────── -->
      <template v-if="tab === 'envio'">
      <!-- Origem do envio — endereço de onde os pedidos saem (usado no cálculo
           de frete pelo Melhor Envios). UX: digite o CEP e os campos se
           preenchem automaticamente via ViaCEP. -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-5">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div>
              <h2 class="text-sm font-semibold text-slate-900">Origem do envio</h2>
              <p class="text-xs text-slate-500 mt-0.5">De onde os pedidos saem. Usado pelo Melhor Envios pra calcular frete.</p>
            </div>
          </div>
        </div>

        <!-- CEP em destaque — campo principal, busca automática ou pelo botão -->
        <div>
          <label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">CEP</label>
          <div class="flex flex-col sm:flex-row gap-2 sm:items-start">
            <div class="relative flex-1 sm:max-w-[220px]">
              <input
                :value="settings.originCep"
                @input="onCepInput"
                @keydown.enter.prevent="lookupCep"
                type="text"
                inputmode="numeric"
                placeholder="00000-000"
                maxlength="9"
                :class="['w-full border rounded-lg pl-10 pr-9 py-2.5 text-sm font-mono outline-none transition-colors',
                  cepError ? 'border-red-300 focus:border-red-500'
                  : cepFound ? 'border-emerald-300 focus:border-emerald-500 bg-emerald-50/30'
                  : 'border-slate-200 focus:border-slate-400']"
              />
              <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <div v-if="cepLoading" class="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></div>
              <svg v-else-if="cepFound" class="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <button
              type="button"
              @click="lookupCep"
              :disabled="cepLoading"
              class="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50"
            >
              <svg v-if="!cepLoading" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span class="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" v-else></span>
              Buscar endereço
            </button>
            <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener"
              class="text-xs text-slate-400 hover:text-slate-600 self-end sm:self-center sm:py-2 underline-offset-2 hover:underline">
              Não sei o CEP
            </a>
          </div>
          <p v-if="cepError" class="text-xs text-red-600 mt-2 flex items-center gap-1">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
            {{ cepError }}
          </p>
          <p v-else-if="cepFound" class="text-xs text-emerald-700 mt-2 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Endereço encontrado · revise abaixo
          </p>
          <p v-else class="text-xs text-slate-400 mt-2">Digite o CEP e os demais campos serão preenchidos automaticamente.</p>
        </div>

        <!-- Demais campos do endereço — preenchidos via CEP, editáveis pra ajustar -->
        <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div class="md:col-span-4">
            <label class="block text-xs text-slate-500 mb-1.5">Rua / Logradouro</label>
            <input v-model="settings.originAddress.street" type="text" placeholder="Av. Paulista"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1.5">Número</label>
            <input v-model="settings.originAddress.number" type="text" placeholder="1000"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-3">
            <label class="block text-xs text-slate-500 mb-1.5">Complemento <span class="text-slate-400 font-normal">(opcional)</span></label>
            <input v-model="settings.originAddress.complement" type="text" placeholder="Sala 1, Galpão A…"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-3">
            <label class="block text-xs text-slate-500 mb-1.5">Bairro</label>
            <input v-model="settings.originAddress.neighborhood" type="text" placeholder="Bela Vista"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-4">
            <label class="block text-xs text-slate-500 mb-1.5">Cidade</label>
            <input v-model="settings.originAddress.city" type="text" placeholder="São Paulo"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1.5">UF</label>
            <input v-model="settings.originAddress.state" type="text" maxlength="2" placeholder="SP"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase font-mono outline-none focus:border-slate-400" />
          </div>
        </div>
      </section>

      <!-- Retirada na loja — opção de entrega independente do Melhor Envios.
           Quando habilitada, aparece como primeira opção no checkout (R$ 0).
           Útil pra clientes que moram perto da gráfica e querem economizar
           frete. Continua disponível mesmo se o ME estiver fora do ar. -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h6M9 13h6M9 17h6"/>
              </svg>
            </div>
            <div>
              <h2 class="text-sm font-semibold text-slate-900">Retirada na loja</h2>
              <p class="text-xs text-slate-500 mt-0.5">Cliente busca o pedido pessoalmente. Sempre aparece como primeira opção (R$ 0).</p>
            </div>
          </div>
          <PaymentSwitch
            label="Ativo"
            :enabled="true"
            description=""
            :model-value="settings.storeConfig.pickupEnabled"
            @update:model-value="settings.storeConfig.pickupEnabled = $event"
          />
        </div>

        <div v-show="settings.storeConfig.pickupEnabled" class="space-y-3">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Endereço de retirada</label>
            <input
              v-model="settings.storeConfig.pickupAddress"
              type="text"
              maxlength="200"
              placeholder="Av. Paulista 1000, Bela Vista — São Paulo/SP"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <p class="text-[11px] text-slate-400 mt-1">Endereço onde o cliente vai retirar. Aparece como nome da "transportadora" no checkout.</p>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Instruções <span class="text-slate-400 font-normal">(opcional)</span></label>
            <textarea
              v-model="settings.storeConfig.pickupInstructions"
              rows="2"
              maxlength="300"
              placeholder="Avisaremos por WhatsApp quando estiver pronto. Atendimento de seg a sex, 8h–18h."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
            ></textarea>
            <p class="text-[11px] text-slate-400 mt-1">Mostrado pro cliente na confirmação do pedido. Use pra explicar prazo de produção, horário, documentos necessários, etc.</p>
          </div>
        </div>
      </section>

      <!-- Melhor Envios — só visível se feature ativa -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Melhor Envios (frete)
              <svg v-if="!plan.hasMelhorEnvios" class="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24" title="Não disponível no plano atual">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Token de integração com transportadoras</p>
          </div>
          <a v-if="plan.hasMelhorEnvios" href="https://docs.melhorenvio.com.br" target="_blank" class="text-xs text-slate-500 hover:text-slate-900 underline">Documentação ↗</a>
        </div>
        <!-- Sem feature: placeholder com upgrade -->
        <div v-if="!plan.hasMelhorEnvios" class="bg-slate-50 border border-slate-100 rounded-lg p-4 text-xs text-slate-500 leading-relaxed">
          Cálculo de frete e compra de etiquetas via Melhor Envios não está incluído no plano atual.
          Faça upgrade pra liberar essa integração e oferecer cálculo de frete em tempo real no checkout da loja.
        </div>
        <!-- Com feature: campos editáveis -->
        <div v-else class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2">
              <label class="block text-xs text-slate-500 mb-1.5">Token de acesso</label>
              <input v-model="settings.meAccessToken" type="password"
                placeholder="••••••••"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Ambiente</label>
              <select v-model="settings.meEnvironment"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400">
                <option value="sandbox">Sandbox (testes)</option>
                <option value="production">Produção</option>
              </select>
            </div>
          </div>

          <!-- CPF do responsável legal — exigido pelo ME quando a loja é PJ.
               Se Settings.cnpj for um CPF (11 dígitos), esse campo é opcional.
               Se for CNPJ (14 dígitos), o ME bloqueia a emissão de etiqueta
               sem CPF do responsável (erro 422 "from.document deve ter um CPF válido"). -->
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">
              CPF do responsável legal
              <span class="text-slate-400 font-normal">(obrigatório pra emitir etiqueta com CNPJ)</span>
            </label>
            <input
              v-model="settings.storeConfig.responsibleCpf"
              type="text"
              maxlength="14"
              placeholder="000.000.000-00"
              class="w-full md:w-64 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
            <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">
              O Melhor Envios exige um CPF válido (do dono ou responsável legal) pra
              emitir etiquetas mesmo quando a empresa tem CNPJ. Sem isso, a compra de
              etiqueta falha com erro 422. Pessoas Físicas (Settings com CPF no campo CNPJ)
              podem deixar este campo vazio.
            </p>
          </div>
        </div>
      </section>
      </template>

      <!-- ─────────────────────────────────────────────────────────────────
           ABA: Pagamentos — Mercado Pago + métodos aceitos
           ───────────────────────────────────────────────────────────────── -->
      <template v-if="tab === 'pagamentos'">
      <!-- Mercado Pago — só se PIX ou Cartão estão liberados (compartilham as mesmas credenciais) -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Mercado Pago (pagamentos)
              <svg v-if="!plan.hasPix && !plan.hasMpCard" class="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Credenciais para
              <span :class="plan.hasPix ? '' : 'line-through text-slate-300'">Pix</span>,
              <span :class="plan.hasMpCard ? '' : 'line-through text-slate-300'">cartão</span>
              e boleto
            </p>
          </div>
          <a v-if="plan.hasPix || plan.hasMpCard" href="https://www.mercadopago.com.br/developers" target="_blank" class="text-xs text-slate-500 hover:text-slate-900 underline">Painel ↗</a>
        </div>
        <!-- Sem nenhuma feature MP: placeholder -->
        <div v-if="!plan.hasPix && !plan.hasMpCard" class="bg-slate-50 border border-slate-100 rounded-lg p-4 text-xs text-slate-500 leading-relaxed">
          Pagamentos online via Mercado Pago não estão incluídos no plano atual.
          Faça upgrade pra liberar PIX ou cartão de crédito no checkout da loja.
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Access Token</label>
            <input v-model="settings.mpAccessToken" type="password" placeholder="APP_USR-…"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Public Key</label>
            <input v-model="settings.mpPublicKey" type="text" placeholder="APP_USR-…"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1.5">
              Webhook Secret
              <span class="text-[10px] text-slate-400 font-normal">(MP → Webhooks → Configurar notificações → "Sua chave secreta")</span>
            </label>
            <input v-model="settings.mpWebhookSecret" type="password" placeholder="••••••••"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
            <p class="text-[11px] text-slate-400 mt-1">
              Sem o secret, o webhook aceita qualquer requisição (modo dev). <strong>Configure antes de subir pra produção</strong> — protege contra notificações falsas.
            </p>
          </div>
        </div>
      </section>

      <!-- Métodos de pagamento aceitos -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">Métodos de pagamento aceitos</h2>
            <p class="text-xs text-slate-500 mt-0.5">O cliente vê só os ativos no checkout</p>
          </div>
          <div v-if="!plan.hasPix && !plan.hasMpCard" class="hidden md:flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
            <svg class="w-3.5 h-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L11 9.586V7z" clip-rule="evenodd"/></svg>
            <span class="text-amber-800">Pagamentos online indisponíveis no seu plano</span>
          </div>
        </div>
        <!-- Switches sem <label>+peer: clique direto no botão — sem dependência de CSS sibling.
             Bug histórico: <label> envolvendo um <input class="sr-only peer"> gerava re-render
             estranho onde o container "sumia" da DOM por algumas frações. Esta versão usa
             estado reativo Vue puro: zero CSS peer, zero sr-only. -->
        <div class="space-y-3">
          <PaymentSwitch
            label="PIX"
            :enabled="!!plan.hasPix"
            :disabled-hint="'Disponível no plano superior — faça upgrade'"
            description="Confirmação instantânea"
            :model-value="!!settings.storeConfig.paymentMethods?.pix"
            @update:model-value="setPaymentMethod('pix', $event)"
          />
          <PaymentSwitch
            label="Cartão de crédito"
            :enabled="!!plan.hasMpCard"
            :disabled-hint="'Disponível no plano superior — faça upgrade'"
            description="Parcelamento em até 12×"
            :model-value="!!settings.storeConfig.paymentMethods?.card"
            @update:model-value="setPaymentMethod('card', $event)"
          />
          <PaymentSwitch
            label="Boleto bancário"
            :enabled="!!(plan.hasPix || plan.hasMpCard)"
            :disabled-hint="'Disponível no plano superior — faça upgrade'"
            description="Compensação em até 3 dias úteis"
            :model-value="!!settings.storeConfig.paymentMethods?.boleto"
            @update:model-value="setPaymentMethod('boleto', $event)"
          />

          <!-- Aviso: desconto PIX agora é por produto. Cada produto tem seu campo
               próprio em Catálogo → Produto → Geral → "Desconto no PIX". -->
          <div v-if="settings.storeConfig.paymentMethods?.pix && plan.hasPix" class="text-[11px] text-slate-500 leading-relaxed mt-2 px-1">
            <strong>Desconto no PIX:</strong> configure por produto em <span class="text-slate-700">Catálogo → editar produto → aba Geral → "Desconto no PIX"</span>. Assim cada item pode ter um desconto diferente baseado na sua margem.
          </div>
        </div>
      </section>
      </template>

      <!-- ─────────────────────────────────────────────────────────────────
           ABA: Regras — comportamento do checkout
           ───────────────────────────────────────────────────────────────── -->
      <template v-if="tab === 'regras'">
      <!-- Regras da loja -->
      <section class="border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">Regras da loja</h2>
          <p class="text-xs text-slate-500 mt-0.5">Comportamento do checkout e política</p>
        </div>
        <div class="space-y-3">
          <PaymentSwitch
            label="Bloquear venda quando estoque = 0"
            :enabled="true"
            description="Produtos sem estoque não podem ser adicionados ao carrinho"
            :model-value="!!settings.storeConfig.blockOutOfStock"
            @update:model-value="settings.storeConfig.blockOutOfStock = $event"
          />
          <PaymentSwitch
            label="Permitir compra sem cadastro"
            :enabled="true"
            description="Cliente faz checkout só com email + endereço"
            :model-value="!!settings.storeConfig.allowGuestCheckout"
            @update:model-value="settings.storeConfig.allowGuestCheckout = $event"
          />
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Prazo de devolução (dias corridos)</label>
            <input v-model.number="settings.storeConfig.returnDays" type="number" min="0" max="90"
              class="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            <p class="text-[11px] text-slate-400 mt-1">Mínimo legal no Brasil é 7 dias (CDC art. 49)</p>
          </div>
        </div>
      </section>

      <!-- ═══ Modo férias — pausa a loja sem precisar tirar produtos do ar ═══ -->
      <section class="border border-slate-200 rounded-xl p-5"
               :class="settings.storeConfig.vacationMode ? 'border-amber-300 bg-amber-50/30' : ''">
        <div class="flex items-start gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
               :class="settings.storeConfig.vacationMode ? 'bg-amber-100' : 'bg-slate-100'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                 :class="settings.storeConfig.vacationMode ? 'text-amber-600' : 'text-slate-500'">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 10h18M3 10l1 11h16l1-11M3 10V7a2 2 0 012-2h14a2 2 0 012 2v3M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-medium text-slate-900">Modo férias</h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Pausa a loja sem precisar despublicar produtos. A vitrine continua visível mas o checkout fica bloqueado com a mensagem que você definir.
            </p>
          </div>
          <span v-if="settings.storeConfig.vacationMode"
                class="shrink-0 inline-flex items-center gap-1.5 bg-amber-500 text-white text-[11px] font-medium px-2.5 py-1 rounded-full">
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            Ativo
          </span>
        </div>

        <PaymentSwitch
          label="Loja em modo férias"
          :enabled="true"
          description="Quando ativado, ninguém consegue finalizar pedidos novos"
          :model-value="!!settings.storeConfig.vacationMode"
          @update:model-value="settings.storeConfig.vacationMode = $event"
        />

        <div v-if="settings.storeConfig.vacationMode" class="mt-4 space-y-3">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Mensagem para os visitantes</label>
            <textarea v-model="settings.storeConfig.vacationMessage" rows="3"
              placeholder="Ex: Estamos de férias até 15/01. Volte em breve!"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none bg-white"></textarea>
            <p class="text-[11px] text-slate-400 mt-1">
              Aparece como banner no topo da loja e como erro caso alguém tente finalizar uma compra.
            </p>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Data de retorno <span class="text-slate-400">(opcional)</span></label>
            <input v-model="settings.storeConfig.vacationReturnsAt" type="date"
              :min="new Date().toISOString().split('T')[0]"
              class="w-44 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white"/>
            <p class="text-[11px] text-slate-400 mt-1">
              Se preenchida, a SPA mostra "Voltamos em DD/MM" no banner.
            </p>
          </div>
        </div>
      </section>
      </template>

      <!-- Save — global, salva todas as abas de uma vez (settings vivem no mesmo objeto).
           Domínio tem botão próprio dentro da aba Geral porque é endpoint separado. -->
      <div class="flex justify-end pt-2">
        <button v-if="perms.can.edit('ecommerce-settings')" @click="saveSettings" :disabled="saving"
          class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-full px-6 py-2.5 transition-colors">
          <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
          <span v-else>Salvar configurações</span>
        </button>
      </div>
    </div>

    <!-- Fallback final: nunca deixa a tela 100% vazia (caso loading=false e settings=null) -->
    <div v-else-if="!renderError" class="bg-slate-50 border border-slate-200 rounded-xl p-6 text-sm text-slate-600 text-center">
      <p>Não foi possível carregar as configurações.</p>
      <button @click="fetchSettings" class="mt-3 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-full">
        Tentar novamente
      </button>
    </div>
  </div>
</template>
