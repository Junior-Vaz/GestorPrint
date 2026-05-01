<template>
  <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/40" @click="$emit('close')"></div>

    <div class="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="p-6 text-center">
        <div class="w-11 h-11 bg-red-50 text-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="text-base font-medium text-slate-900 mb-2">Erro na transação</h3>
        <p class="text-sm text-slate-500 leading-relaxed">
          Não foi possível processar o pagamento através do <span class="text-slate-900 font-medium">Mercado Pago</span>.
        </p>
        <p class="text-xs text-slate-400 mt-2">Verifique as credenciais da API ou a conectividade do servidor.</p>
      </div>

      <div class="px-6 pb-6">
        <div class="flex flex-col gap-2 text-xs text-slate-500 mb-5">
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Tente novamente em alguns instantes
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Certifique-se de que a conta MP está integrada
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="$emit('close')"
            class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
          <button
            @click="$emit('retry')"
            class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: Boolean
});

defineEmits(['close', 'retry']);
</script>
