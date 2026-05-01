<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-vue-next'

const { toasts, removeToast } = useToast()

const getIcon = (type: string) => {
  switch (type) {
    case 'success': return CheckCircle
    case 'error': return XCircle
    case 'warning': return AlertCircle
    case 'info': return Info
    default: return Info
  }
}

const getIconColor = (type: string) => {
  switch (type) {
    case 'success': return '#1D9E75'
    case 'error':   return '#A32D2D'
    case 'warning': return '#BA7517'
    case 'info':    return '#185FA5'
    default:        return '#64748B'
  }
}
</script>

<template>
  <div class="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-slate-200 bg-white pointer-events-auto min-w-[280px] max-w-md"
      >
        <component :is="getIcon(toast.type)" class="w-4 h-4 shrink-0" :style="{ color: getIconColor(toast.type) }" />
        <p class="text-sm text-slate-900 flex-1">{{ toast.message }}</p>
        <button
          @click="removeToast(toast.id)"
          class="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
