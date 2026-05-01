<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted } from 'vue'
import { useToast } from '../composables/useToast'
import { usePermissionsStore } from '../stores/permissions'

const { showToast } = useToast()
const perms = usePermissionsStore()

const settings = ref({
  companyName: '',
  cnpj: '',
  phone: '',
  email: '',
  address: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  mpAccessToken: '',
  mpPublicKey: '',
  logoUrl: '',
  smtpSecure: false,
  updatedAt: ''
})
const loading = ref(true)
const saving = ref(false)
const showSuccess = ref(false)
const uploadingLogo = ref(false)
const logoInput = ref<HTMLInputElement | null>(null)

// Teste de SMTP — verifica conexão e/ou envia email real
const smtpTesting = ref(false)
const smtpMessage = ref('')

async function testSmtp() {
  smtpTesting.value = true
  smtpMessage.value = ''
  try {
    // Salva config primeiro (senão verify usa a antiga ainda)
    await saveSettings()
    const res = await apiFetch('/api/settings/test-smtp', { method: 'POST' })
    const data = await res.json()
    smtpMessage.value = data.ok
      ? '✅ Conexão SMTP OK!'
      : `❌ ${data.error || 'Falha na conexão.'}`
  } catch (e: any) {
    smtpMessage.value = `❌ ${e?.message || 'Erro inesperado'}`
  } finally {
    smtpTesting.value = false
  }
}

async function testSmtpSend() {
  const to = prompt('Email pra receber o teste:', settings.value.email || '')
  if (!to?.trim()) return
  smtpTesting.value = true
  smtpMessage.value = ''
  try {
    await saveSettings()
    const res = await apiFetch('/api/settings/test-smtp-send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to: to.trim() }),
    })
    const data = await res.json()
    smtpMessage.value = data.ok
      ? `✅ Email enviado pra ${to}!`
      : `❌ ${data.error || 'Falha no envio.'}`
  } catch (e: any) {
    smtpMessage.value = `❌ ${e?.message || 'Erro inesperado'}`
  } finally {
    smtpTesting.value = false
  }
}

const fetchSettings = async () => {
  loading.value = true
  try {
    const res = await apiFetch('/api/settings')
    if (res.ok) {
      settings.value = await res.json()
    }
  } catch (e) {
    console.error('Error fetching settings', e)
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    // Lista explícita pra não vazar campos que vieram do GET /settings
    // (pricingConfig, meAccessToken, paymentMethods, businessHours, etc) e
    // estourar o ValidationPipe com `forbidNonWhitelisted: true`.
    const s = settings.value
    const payload = {
      companyName:   s.companyName,
      cnpj:          s.cnpj,
      phone:         s.phone,
      email:         s.email || undefined,   // evita IsEmail estourar com ""
      address:       s.address,
      logoUrl:       s.logoUrl,
      smtpHost:      s.smtpHost,
      smtpPort:      s.smtpPort,
      smtpUser:      s.smtpUser,
      smtpPass:      s.smtpPass,
      smtpSecure:    s.smtpSecure,
      mpAccessToken: s.mpAccessToken,
      mpPublicKey:   s.mpPublicKey,
    }
    const res = await apiFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      showSuccess.value = true
      setTimeout(() => { showSuccess.value = false }, 3000)
    } else {
      const err = await res.json().catch(() => ({}))
      console.error('Error saving settings:', err)
    }
  } catch (e) {
    console.error('Error saving settings', e)
  } finally {
    saving.value = false
  }
}

const handleLogoUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadingLogo.value = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await apiFetch('/api/settings/logo', {
      method: 'POST',
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      settings.value.logoUrl = data.logoUrl
    } else {
      showToast('Erro ao enviar a logo.', 'error')
    }
  } catch (e) {
    console.error('Logo upload error:', e)
  } finally {
    uploadingLogo.value = false
    if (logoInput.value) logoInput.value.value = ''
  }
}

onMounted(fetchSettings)
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1100px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header -->
      <div class="flex items-center justify-between mb-7 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Configurações</div>
          <div class="text-xs text-slate-500 mt-0.5">Dados da empresa, e-mail e gateway de pagamento</div>
        </div>
        <div class="flex items-center gap-2">
          <Transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 translate-x-2"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition ease-in duration-150"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0">
            <span v-if="showSuccess" class="inline-flex items-center gap-1.5 text-xs" style="color:#0F6E56">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              Salvo
            </span>
          </Transition>
          <button v-if="perms.can.edit('settings')" @click="saveSettings" :disabled="saving || loading"
                  class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors disabled:opacity-50">
            <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
            {{ saving ? 'Salvando…' : 'Salvar alterações' }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-6">
        <div v-for="i in 3" :key="`l${i}`" class="border border-slate-200 rounded-xl p-6">
          <div class="h-4 bg-slate-100 rounded animate-pulse w-40 mb-4"></div>
          <div class="grid grid-cols-2 gap-3">
            <div class="h-10 bg-slate-50 rounded-md animate-pulse"></div>
            <div class="h-10 bg-slate-50 rounded-md animate-pulse"></div>
            <div class="h-10 bg-slate-50 rounded-md animate-pulse col-span-2"></div>
          </div>
        </div>
      </div>

      <form v-else @submit.prevent="saveSettings" class="space-y-6">

        <!-- Logo -->
        <section class="border border-slate-200 rounded-xl p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <div class="text-base font-medium text-slate-900">Logo da empresa</div>
              <div class="text-xs text-slate-500 mt-0.5">Aparece no cabeçalho de orçamentos, ordens de serviço e recibos</div>
            </div>
            <span class="text-[11px] text-slate-400">PNG transparente recomendado</span>
          </div>

          <div class="flex flex-col md:flex-row items-start gap-5">
            <div class="w-32 h-32 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden relative group shrink-0">
              <template v-if="settings.logoUrl">
                <img :src="settings.logoUrl" class="w-full h-full object-contain p-2" alt="Logo" />
                <div class="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button v-if="logoInput" type="button" @click="logoInput.click()"
                          class="text-white text-xs font-medium px-3 py-1.5 bg-white/20 rounded-full border border-white/30 hover:bg-white/30 transition-colors">
                    Trocar
                  </button>
                </div>
              </template>
              <button v-else-if="logoInput" type="button" @click="logoInput.click()"
                      class="flex flex-col items-center justify-center text-slate-400 hover:text-slate-900 transition-colors w-full h-full">
                <svg class="w-6 h-6 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span class="text-xs">Adicionar logo</span>
              </button>
              <div v-if="uploadingLogo" class="absolute inset-0 bg-white/80 flex items-center justify-center">
                <div class="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
              </div>
              <input type="file" ref="logoInput" @change="handleLogoUpload" accept="image/png, image/jpeg" class="hidden" />
            </div>

            <div class="flex-1 text-sm text-slate-500 leading-relaxed">
              Use preferencialmente <span class="text-slate-900 font-medium">PNG com fundo transparente</span>, resolução mínima de 400×400px.
              A logo será redimensionada automaticamente nos documentos gerados.
            </div>
          </div>
        </section>

        <!-- Dados da empresa -->
        <section class="border border-slate-200 rounded-xl p-6">
          <div class="mb-5">
            <div class="text-base font-medium text-slate-900">Dados da empresa</div>
            <div class="text-xs text-slate-500 mt-0.5">Informações exibidas em documentos oficiais</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Nome / razão social</label>
              <input v-model="settings.companyName" type="text" placeholder="Ex: GestorPrint Express"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">CNPJ</label>
              <input v-model="settings.cnpj" type="text" placeholder="00.000.000/0001-00"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Telefone / WhatsApp</label>
              <input v-model="settings.phone" type="text" placeholder="(00) 00000-0000"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">E-mail de contato</label>
              <input v-model="settings.email" type="email" placeholder="contato@suagrafica.com"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs text-slate-500 mb-1.5">Endereço completo</label>
              <input v-model="settings.address" type="text" placeholder="Rua, número, bairro, cidade, UF"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
          </div>
        </section>

        <!-- SMTP -->
        <section class="border border-slate-200 rounded-xl p-6">
          <div class="mb-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="flex items-center gap-2">
                <div class="text-base font-medium text-slate-900">E-mail (SMTP)</div>
                <span v-if="settings.smtpHost" class="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full" style="background:#E1F5EE; color:#0F6E56">
                  <span class="w-1.5 h-1.5 rounded-full" style="background:#1D9E75"></span>
                  configurado
                </span>
                <span v-else class="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  não configurado
                </span>
              </div>
              <div class="text-xs text-slate-500 mt-0.5">Envio de orçamentos e recibos por e-mail</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2">
              <label class="block text-xs text-slate-500 mb-1.5">Servidor SMTP</label>
              <input v-model="settings.smtpHost" type="text" placeholder="smtp.gmail.com"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Porta</label>
              <input v-model.number="settings.smtpPort" type="number"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Usuário</label>
              <input v-model="settings.smtpUser" type="text" placeholder="usuario@gmail.com"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Senha</label>
              <input v-model="settings.smtpPass" type="password"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
            <div class="flex items-end pb-1">
              <label class="flex items-center gap-2 cursor-pointer">
                <span class="relative inline-flex items-center">
                  <input type="checkbox" v-model="settings.smtpSecure" class="sr-only peer">
                  <span class="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-slate-900 transition-colors"></span>
                  <span class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></span>
                </span>
                <span class="text-xs text-slate-600">Usar SSL/TLS (porta 465)</span>
              </label>
            </div>
          </div>

          <!-- Botões de teste + dica Gmail -->
          <div class="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <div class="flex items-center gap-2 flex-wrap">
              <button
                @click="testSmtp"
                :disabled="!settings.smtpHost || !settings.smtpUser || !settings.smtpPass || smtpTesting"
                type="button"
                class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-4 py-2 transition-colors"
              >
                <svg v-if="smtpTesting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Testar conexão
              </button>
              <button
                @click="testSmtpSend"
                :disabled="!settings.smtpHost || !settings.smtpUser || !settings.smtpPass || smtpTesting"
                type="button"
                class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-4 py-2 transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                Enviar email de teste
              </button>
              <span v-if="smtpMessage" class="text-[11px]" :class="smtpMessage.startsWith('❌') ? 'text-rose-600' : 'text-emerald-600'">
                {{ smtpMessage }}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 leading-relaxed">
              <strong>💡 Gmail:</strong> a senha NÃO é a do Gmail comum. Você precisa de uma <strong>"Senha de app"</strong> (Conta Google → Segurança → Verificação em 2 etapas → Senhas de app). Use <code class="bg-slate-100 px-1 rounded">smtp.gmail.com</code> porta <code class="bg-slate-100 px-1 rounded">587</code> (sem SSL) ou <code class="bg-slate-100 px-1 rounded">465</code> (com SSL).
            </p>
          </div>
        </section>

        <!-- Mercado Pago -->
        <section class="border border-slate-200 rounded-xl p-6">
          <div class="mb-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="flex items-center gap-2">
                <div class="text-base font-medium text-slate-900">Gateway de pagamento</div>
                <span v-if="settings.mpAccessToken" class="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full" style="background:#E1F5EE; color:#0F6E56">
                  <span class="w-1.5 h-1.5 rounded-full" style="background:#1D9E75"></span>
                  Mercado Pago ativo
                </span>
                <span v-else class="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  não configurado
                </span>
              </div>
              <div class="text-xs text-slate-500 mt-0.5">Habilita Pix e link de pagamento nos pedidos</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Access Token</label>
              <input v-model="settings.mpAccessToken" type="password" placeholder="APP_USR-…"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors font-mono">
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Public Key</label>
              <input v-model="settings.mpPublicKey" type="text" placeholder="APP_USR-…"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors font-mono">
            </div>
            <div class="md:col-span-2 text-xs text-slate-500">
              Tokens iniciados em <span class="text-slate-900 font-medium">TEST-</span> operam em sandbox. Use <span class="text-slate-900 font-medium">APP_USR-</span> em produção.
            </div>
          </div>
        </section>

        <!-- Preview -->
        <section class="border border-slate-200 rounded-xl p-6">
          <div class="mb-4">
            <div class="text-base font-medium text-slate-900">Pré-visualização</div>
            <div class="text-xs text-slate-500 mt-0.5">Como aparecerá no cabeçalho dos PDFs</div>
          </div>

          <div class="bg-slate-50 rounded-lg p-5 max-w-md">
            <div class="flex items-start gap-4">
              <div v-if="settings.logoUrl" class="w-14 h-14 bg-white rounded-md border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                <img :src="settings.logoUrl" class="w-full h-full object-contain p-1"/>
              </div>
              <div class="min-w-0">
                <div class="text-base font-medium text-slate-900 truncate">{{ settings.companyName || 'Sua gráfica' }}</div>
                <div class="text-xs text-slate-500 mt-0.5">CNPJ: {{ settings.cnpj || '00.000.000/0001-00' }}</div>
                <div class="text-xs text-slate-500">Tel: {{ settings.phone || '(00) 00000-0000' }}</div>
                <div v-if="settings.email" class="text-xs text-slate-500">{{ settings.email }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Save (sticky bottom) -->
        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" @click="fetchSettings"
                  class="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2.5 transition-colors">
            Cancelar
          </button>
          <button v-if="perms.can.edit('settings')" type="submit" :disabled="saving"
                  class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors disabled:opacity-50">
            <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
            {{ saving ? 'Salvando…' : 'Salvar alterações' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
