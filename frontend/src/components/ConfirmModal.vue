<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'

const { visible, title, message, confirmLabel, confirmClass, accept, reject } = useConfirm()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="visible" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="visible" class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div class="flex items-start gap-4">
              <div class="p-2.5 bg-rose-100 rounded-xl shrink-0">
                <svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-slate-800 text-base">{{ title }}</h3>
                <p class="text-slate-500 text-sm mt-1 leading-relaxed">{{ message }}</p>
              </div>
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button
                @click="reject"
                class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="accept"
                class="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
                :class="confirmClass"
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
