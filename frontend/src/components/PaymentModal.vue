<script setup lang="ts">
import { ref } from 'vue'
import { apiFetch } from '../utils/api'

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
        statusMessage.value = 'Pagamento Confirmado!'
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

import { watch, onUnmounted } from 'vue'
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
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-md" @click="emit('close')"></div>
      
      <!-- Modal Content -->
      <div class="bg-white w-full max-w-md rounded-[40px] shadow-2xl relative z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <!-- Close Button -->
        <button @click="emit('close')" class="absolute top-6 right-6 z-20 w-10 h-10 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all group">
          <svg class="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <!-- Native Pix View -->
        <div v-if="qrCodeBase64" class="p-10 flex flex-col items-center text-center">
          <div class="w-16 h-16 bg-emerald-100 rounded-[28px] flex items-center justify-center text-emerald-600 mb-6">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
          </div>
          
          <h3 class="text-2xl font-black text-slate-900 mb-1">Escaneie o Pix</h3>
          <p class="text-sm text-slate-500 font-medium mb-8">Pague com qualquer banco ou carteira digital.</p>

          <div class="bg-slate-50 p-6 rounded-[32px] border border-slate-100 mb-8 w-full flex items-center justify-center max-w-[280px] shadow-inner relative">
            <img :src="`data:image/png;base64,${qrCodeBase64}`" class="w-full h-auto rounded-lg" alt="QR Code Pix" />
          </div>

          <div v-if="amount" class="mb-8">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor do Pedido</div>
            <div class="text-3xl font-black text-slate-900">R$ {{ amount.toFixed(2) }}</div>
          </div>

          <div class="w-full space-y-4">
            <button 
              @click="copyToClipboard"
              :class="['w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3', copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-200']"
            >
              <svg v-if="!copied" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-5 5h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              {{ copied ? 'Copiado!' : 'Copiar "Copia e Cola"' }}
            </button>

            <button 
              @click="checkStatus"
              :disabled="checking"
              class="w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <span v-if="checking" class="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></span>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
              {{ checking ? 'Verificando...' : 'Já paguei / Verificar status' }}
            </button>
          </div>
        </div>

        <!-- Fallback Iframe (for non-Pix or missing data) -->
        <div v-else class="h-[80vh] flex flex-col">
          <div class="p-6 border-b border-slate-100 bg-white shrink-0">
            <h3 class="font-black text-slate-900">Pagamento Externo</h3>
          </div>
          <iframe :src="url" class="flex-1 w-full" frameborder="0"></iframe>
        </div>

        <!-- Footer -->
        <div class="p-6 bg-slate-50 border-t border-slate-100 text-center shrink-0">
          <div class="flex items-center justify-center gap-2 mb-1">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Aguardando Confirmação</span>
          </div>
          <p v-if="!statusMessage" class="text-[9px] text-slate-400 font-medium italic">O sistema atualizará assim que o pagamento for concluído.</p>
          <p v-else :class="['text-[10px] font-black uppercase tracking-wider transition-all duration-300', statusMessage.includes('Confirmado') ? 'text-emerald-500 animate-bounce' : 'text-amber-500']">
            {{ statusMessage }}
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>
