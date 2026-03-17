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

const getStyles = (type: string) => {
  switch (type) {
    case 'success': return 'bg-emerald-50 border-emerald-100 text-emerald-800'
    case 'error': return 'bg-rose-50 border-rose-100 text-rose-800'
    case 'warning': return 'bg-amber-50 border-amber-100 text-amber-800'
    case 'info': return 'bg-blue-50 border-blue-100 text-blue-800'
    default: return 'bg-slate-50 border-slate-100 text-slate-800'
  }
}

const getIconStyles = (type: string) => {
  switch (type) {
    case 'success': return 'text-emerald-500'
    case 'error': return 'text-rose-500'
    case 'warning': return 'text-amber-500'
    case 'info': return 'text-blue-500'
    default: return 'text-slate-500'
  }
}
</script>

<template>
  <div class="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
    <TransitionGroup 
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-y-4 opacity-0 scale-95"
      enter-to-class="transform translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <div 
        v-for="toast in toasts" 
        :key="toast.id"
        class="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto min-w-[300px] max-w-md"
        :class="getStyles(toast.type)"
      >
        <component :is="getIcon(toast.type)" class="w-5 h-5 shrink-0" :class="getIconStyles(toast.type)" />
        <p class="text-sm font-semibold flex-1">{{ toast.message }}</p>
        <button 
          @click="removeToast(toast.id)"
          class="p-1 hover:bg-black/5 rounded-lg transition-colors"
        >
          <X class="w-4 h-4 opacity-50" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
