<template>
  <Teleport to="body">
    <Transition name="alert-fade">
      <div v-if="show"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        @click.self="$emit('close')">

        <div class="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 w-full max-w-md p-8 text-center">

          <!-- Ícone -->
          <div :class="['w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg', iconBg]">
            <!-- Error -->
            <svg v-if="type === 'error'" class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <!-- Warning -->
            <svg v-else-if="type === 'warning'" class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <!-- Success -->
            <svg v-else class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>

          <!-- Título -->
          <h3 class="text-xl font-extrabold text-slate-800 mb-2">{{ title }}</h3>

          <!-- Mensagem -->
          <p class="text-slate-500 font-medium leading-relaxed mb-7">{{ message }}</p>

          <!-- Botão -->
          <button
            @click="$emit('close')"
            :class="['w-full py-3 font-bold text-white rounded-xl transition-all active:scale-95 shadow-lg', btnBg]"
          >
            {{ type === 'error' ? 'Entendido' : type === 'warning' ? 'Ok, entendi' : 'Perfeito!' }}
          </button>
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
  error:   'bg-red-500 shadow-red-100',
  warning: 'bg-amber-500 shadow-amber-100',
  success: 'bg-emerald-500 shadow-emerald-100',
}[props.type]))

const btnBg = computed(() => ({
  error:   'bg-red-500 hover:bg-red-600 shadow-red-100',
  warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-100',
  success: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100',
}[props.type]))
</script>

<style scoped>
.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: opacity 0.2s ease;
}
.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
}
.alert-fade-enter-active > div,
.alert-fade-leave-active > div {
  transition: transform 0.2s ease;
}
.alert-fade-enter-from > div {
  transform: scale(0.95) translateY(8px);
}
.alert-fade-leave-to > div {
  transform: scale(0.95) translateY(8px);
}
</style>
