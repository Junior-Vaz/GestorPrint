<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'

const { visible, title, message, confirmLabel, confirmClass, accept, reject } = useConfirm()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="visible" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/40">
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="visible" class="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm text-center">
            <div class="w-11 h-11 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 class="text-base font-medium text-slate-900 mb-2">{{ title }}</h3>
            <p class="text-sm text-slate-500 mb-6 leading-relaxed">{{ message }}</p>
            <div class="flex gap-2">
              <button
                @click="reject"
                class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="accept"
                class="flex-1 py-2.5 rounded-full text-sm font-medium text-white transition-colors"
                :class="confirmClass || 'bg-slate-900 hover:bg-slate-800'"
              >
                {{ confirmLabel }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
