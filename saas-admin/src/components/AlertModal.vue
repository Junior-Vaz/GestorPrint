<template>
  <Teleport to="body">
    <Transition name="alert-fade">
      <div v-if="show"
        class="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4"
        @click.self="$emit('close')">

        <div class="bg-white border border-slate-200 rounded-md w-full max-w-md p-6 shadow-xl">

          <div class="flex items-start gap-3">
            <!-- Ícone — pequeno, alinhado à esquerda do título -->
            <div :class="['w-8 h-8 rounded-md flex items-center justify-center shrink-0', iconBg]">
              <svg v-if="type === 'error'" class="w-4 h-4" :class="iconText" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <svg v-else-if="type === 'warning'" class="w-4 h-4" :class="iconText" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <svg v-else class="w-4 h-4" :class="iconText" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">{{ typeLabel }}</p>
              <h3 class="text-sm font-medium text-slate-900 mt-0.5">{{ title }}</h3>
              <p class="text-xs text-slate-600 leading-relaxed mt-2">{{ message }}</p>
            </div>
          </div>

          <div class="mt-5 flex justify-end">
            <button
              @click="$emit('close')"
              class="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors"
            >
              {{ type === 'error' ? 'Entendido' : type === 'warning' ? 'Ok, entendi' : 'Perfeito' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
  type: 'error' | 'warning' | 'success'
  title: string
  message: string
}>()

defineEmits<{ close: [] }>()

const iconBg = computed(() => ({
  error:   'bg-red-50',
  warning: 'bg-amber-50',
  success: 'bg-emerald-50',
}[props.type]))

const iconText = computed(() => ({
  error:   'text-red-700',
  warning: 'text-amber-700',
  success: 'text-emerald-700',
}[props.type]))

const typeLabel = computed(() => ({
  error:   'Erro',
  warning: 'Atenção',
  success: 'Sucesso',
}[props.type]))
</script>

<style scoped>
.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: opacity 0.18s ease;
}
.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
}
.alert-fade-enter-active > div,
.alert-fade-leave-active > div {
  transition: transform 0.18s ease;
}
.alert-fade-enter-from > div {
  transform: scale(0.97) translateY(4px);
}
.alert-fade-leave-to > div {
  transform: scale(0.97) translateY(4px);
}
</style>
