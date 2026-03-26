<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted } from 'vue'
import { useToast } from '../composables/useToast'

const { showToast } = useToast()

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
    const { id, tenantId, updatedAt, createdAt, ...payload } = settings.value as any
    const res = await apiFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      showSuccess.value = true
      setTimeout(() => { showSuccess.value = false }, 3000)
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
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <div class="p-2 bg-slate-600 rounded-xl text-white shadow-lg shadow-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          Configurações da Empresa
        </h1>
        <p class="text-slate-500 mt-1 font-medium italic">Personalize os dados que aparecem nos orçamentos e documentos oficiais</p>
      </div>
    </div>

    <!-- Main Form Card -->
    <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center p-20">
        <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <form v-else @submit.prevent="saveSettings" class="p-8 space-y-8">

        <!-- Logo Upload Section -->
        <div class="flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
          <div class="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden relative group shrink-0 shadow-sm">
            <template v-if="settings.logoUrl">
              <img :src="settings.logoUrl" class="w-full h-full object-contain p-2" alt="Logo da Empresa" />
              <div class="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button v-if="logoInput" @click.prevent="logoInput.click()" class="text-white text-xs font-bold px-3 py-1.5 bg-indigo-600 rounded-lg">Trocar</button>
              </div>
            </template>
            <template v-else>
              <button v-if="logoInput" @click.prevent="logoInput.click()" class="flex flex-col items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors w-full h-full">
                <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span class="text-[10px] uppercase font-black tracking-wider">Adicionar Logo</span>
              </button>
            </template>

            <div v-if="uploadingLogo" class="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
              <div class="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <input type="file" ref="logoInput" @change="handleLogoUpload" accept="image/png, image/jpeg" class="hidden" />
          </div>

          <div>
            <h3 class="font-black text-slate-800 text-lg mb-1">Logo da Empresa</h3>
            <p class="text-sm text-slate-500 leading-relaxed max-w-sm">Esta logo será exibida no cabeçalho de todos os orçamentos e Ordens de Serviço gerados em PDF.</p>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Recomendado: PNG Transparente</p>
          </div>
        </div>

        <!-- Company Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nome da Gráfica / Razão Social</label>
            <input
              v-model="settings.companyName"
              type="text"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              placeholder="Ex: GestorPrint Express"
            />
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">CNPJ</label>
            <input
              v-model="settings.cnpj"
              type="text"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-mono"
              placeholder="00.000.000/0001-00"
            />
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Telefone / WhatsApp</label>
            <input
              v-model="settings.phone"
              type="text"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Email de Contato</label>
            <input
              v-model="settings.email"
              type="email"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              placeholder="contato@suagrafica.com"
            />
          </div>

          <div class="md:col-span-2">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Endereço Completo</label>
            <input
              v-model="settings.address"
              type="text"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              placeholder="Rua Exemplo, 123 - Bairro, Cidade - UF"
            />
          </div>
        </div>

        <!-- SMTP Settings -->
        <div class="pt-6 border-t border-slate-100">
          <h3 class="text-sm font-black text-slate-800 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            Configurações de E-mail (SMTP)
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="md:col-span-2">
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Servidor SMTP</label>
              <input v-model="settings.smtpHost" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm" placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Porta</label>
              <input v-model="settings.smtpPort" type="number" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-mono" />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Usuário SMTP</label>
              <input v-model="settings.smtpUser" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm" placeholder="exemplo@gmail.com" />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Senha SMTP</label>
              <input v-model="settings.smtpPass" type="password" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm" />
            </div>
            <div class="flex items-center gap-3 pt-7">
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="settings.smtpSecure" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                <span class="ml-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usar SSL/TLS</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Mercado Pago Settings -->
        <div class="pt-6 border-t border-slate-100">
          <h3 class="text-sm font-black text-slate-800 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <svg class="w-4 h-4 text-sky-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/></svg>
            Gateway de Pagamento (Mercado Pago)
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Access Token (Prod/Sandbox)</label>
              <input v-model="settings.mpAccessToken" type="password" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm font-mono" placeholder="APP_USR-..." />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Public Key</label>
              <input v-model="settings.mpPublicKey" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm font-mono" placeholder="APP_USR-..." />
            </div>
            <div class="md:col-span-2">
              <p class="text-[10px] text-slate-400 italic">Insira suas credenciais do Mercado Pago para habilitar pagamentos via PIX e Link de Pagamento. Use tokens iniciados em <b>TEST-</b> para ambiente de testes.</p>
            </div>
          </div>
        </div>

        <!-- Save Row -->
        <div class="flex items-center justify-between pt-4 border-t border-slate-100">
          <div v-if="showSuccess" class="text-emerald-500 font-bold flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Configurações salvas!
          </div>
          <div v-else></div>

          <button
            type="submit"
            :disabled="saving"
            class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50 text-sm"
          >
            <span v-if="saving" class="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
            Salvar Configurações
          </button>
        </div>
      </form>
    </div>

    <!-- Preview Box -->
    <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6">
      <h4 class="text-slate-800 font-black mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
        <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        Visualização no PDF
      </h4>
      <div class="bg-slate-50 rounded-xl p-5 border border-slate-100 shadow-sm max-w-md pointer-events-none opacity-80">
        <div class="text-xl font-bold text-slate-800">{{ settings.companyName || 'Sua Gráfica' }}</div>
        <div class="text-[10px] text-slate-400 uppercase mt-1">CNPJ: {{ settings.cnpj || '00.000.000/0001-00' }}</div>
        <div class="text-[10px] text-slate-400 uppercase">TEL: {{ settings.phone || '(00) 0000-0000' }}</div>
      </div>
    </div>
  </div>
</template>
