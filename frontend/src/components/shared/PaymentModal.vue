<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { apiFetch } from '../../utils/api'

const props = defineProps<{
  transactionId?: number;
  url: string;
  isOpen: boolean;
  qrCode?: string;
  qrCodeBase64?: string;
  amount?: number;
}>()

const emit = defineEmits(['close', 'paid'])
const copied = ref(false)
const checking = ref(false)
const statusMessage = ref('')
let pollingInterval: any = null

const checkStatus = async () => {
  if (!props.transactionId || checking.value) return
  checking.value = true
  try {
    const res = await apiFetch(`/api/payments/check/${props.transactionId}`)
    if (res.ok) {
      const data = await res.json()
      if (data.status === 'PAID') {
        statusMessage.value = 'Pagamento confirmado!'
        stopPolling()
        emit('paid')
        setTimeout(() => { emit('close') }, 1500)
      } else {
        statusMessage.value = 'Ainda não recebemos a confirmação. Tente em alguns instantes.'
        setTimeout(() => { if (statusMessage.value.includes('Ainda')) statusMessage.value = '' }, 4000)
      }
    } else {
      statusMessage.value = 'Erro ao verificar status no servidor.'
    }
  } catch (e) {
    console.error('Error checking status', e)
    statusMessage.value = 'Erro de conexão ao verificar.'
  } finally {
    checking.value = false
  }
}

const startPolling = () => {
  stopPolling()
  pollingInterval = setInterval(checkStatus, 5000)
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

watch(() => props.isOpen, (next) => {
  if (next && props.transactionId) {
    startPolling()
  } else {
    stopPolling()
  }
})

onUnmounted(stopPolling)

const copyToClipboard = () => {
  if (props.qrCode) {
    navigator.clipboard.writeText(props.qrCode)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-150"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="emit('close')"></div>

      <div class="bg-white w-full max-w-md rounded-2xl border border-slate-200 relative z-10 overflow-hidden flex flex-col">
        <button @click="emit('close')"
                class="absolute top-4 right-4 z-20 w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <!-- Pix view -->
        <div v-if="qrCodeBase64" class="p-8 flex flex-col items-center text-center">
          <div class="w-11 h-11 rounded-full flex items-center justify-center mb-4"
               style="background:#E1F5EE; color:#0F6E56">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7"/>
            </svg>
          </div>

          <h3 class="text-base font-medium text-slate-900 mb-1">Escaneie o Pix</h3>
          <p class="text-sm text-slate-500 mb-6">Pague com qualquer banco ou carteira digital.</p>

          <div class="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-5 w-full flex items-center justify-center max-w-[260px]">
            <img :src="`data:image/png;base64,${qrCodeBase64}`" class="w-full h-auto rounded" alt="QR Code Pix" />
          </div>

          <div v-if="amount" class="mb-6">
            <div class="text-xs text-slate-500 mb-0.5">Valor</div>
            <div class="text-2xl font-medium text-slate-900">R$ {{ amount.toFixed(2) }}</div>
          </div>

          <div class="w-full space-y-2">
            <button
              @click="copyToClipboard"
              class="w-full py-2.5 rounded-full font-medium text-sm transition-colors flex items-center justify-center gap-2"
              :class="copied ? 'text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'"
              :style="copied ? { backgroundColor: '#1D9E75' } : {}"
            >
              <svg v-if="!copied" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-5 5h3m-3 4h3m-6-4h.01M9 16h.01"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              {{ copied ? 'Copiado' : 'Copiar Pix copia-e-cola' }}
            </button>

            <button
              @click="checkStatus"
              :disabled="checking"
              class="w-full py-2.5 rounded-full font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <span v-if="checking" class="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></span>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {{ checking ? 'Verificando…' : 'Já paguei' }}
            </button>
          </div>
        </div>

        <!-- Fallback iframe -->
        <div v-else class="h-[80vh] flex flex-col">
          <div class="px-5 py-4 border-b border-slate-100 shrink-0">
            <h3 class="text-base font-medium text-slate-900">Pagamento</h3>
          </div>
          <iframe :src="url" class="flex-1 w-full" frameborder="0"></iframe>
        </div>

        <div class="px-6 py-3 border-t border-slate-100 text-center shrink-0">
          <div class="flex items-center justify-center gap-2">
            <span class="relative flex h-1.5 w-1.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style="background:#1D9E75"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5" style="background:#1D9E75"></span>
            </span>
            <span class="text-xs text-slate-500">Aguardando confirmação</span>
          </div>
          <p v-if="statusMessage" :class="['text-xs mt-1', statusMessage.includes('confirmado') ? '' : 'text-amber-600']"
             :style="statusMessage.includes('confirmado') ? { color: '#1D9E75' } : {}">
            {{ statusMessage }}
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>
