<template>
  <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <!-- Backdrop with blur -->
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <!-- Modal Card -->
    <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-red-100 transform transition-all duration-300 scale-100">
      <!-- Header with caution icon -->
      <div class="bg-red-50 p-6 flex flex-col items-center">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 class="text-xl font-bold text-slate-800 text-center">Erro na Transação</h3>
      </div>
      
      <!-- Content -->
      <div class="p-6">
        <div class="bg-red-50/50 rounded-xl p-4 border border-red-100/50 mb-6">
          <p class="text-slate-600 text-center leading-relaxed">
            Não foi possível processar o pagamento através do gateway <strong>Mercado Pago</strong>.
          </p>
          <p class="text-sm text-red-500 mt-2 text-center italic">
            "Verifique as credenciais da API ou a conectividade do servidor."
          </p>
        </div>
        
        <div class="space-y-3">
          <div class="flex items-start gap-3 text-slate-500 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span>Tente novamente em alguns instantes</span>
          </div>
          <div class="flex items-start gap-3 text-slate-500 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span>Certifique-se de que a conta MP está integrada</span>
          </div>
        </div>
      </div>
      
      <!-- Footer Actions -->
      <div class="p-6 pt-0 flex gap-3">
        <button 
          @click="$emit('close')"
          class="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
        >
          Fechar
        </button>
        <button 
          @click="$emit('retry')"
          class="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95"
        >
          Tentar Novamente
        </button>
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
