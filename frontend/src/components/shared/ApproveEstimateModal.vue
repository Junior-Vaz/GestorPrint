<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Quando truthy, modal abre. Tipicamente é { id, type } ou null */
  target: { id: number; type: string } | null
  /** v-model:date — data de entrega (YYYY-MM-DD ou vazio) */
  date: string
  /** v-model:priority — 'NORMAL' | 'URGENT' */
  priority: 'NORMAL' | 'URGENT'
  /** Loading state durante submit */
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:date', v: string): void
  (e: 'update:priority', v: 'NORMAL' | 'URGENT'): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const today = computed(() => new Date().toISOString().split('T')[0])

function setDate(v: string) { emit('update:date', v) }
function setPriority(v: 'NORMAL' | 'URGENT') { emit('update:priority', v) }
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    leave-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="target" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="emit('cancel')"></div>

      <!-- Modal card -->
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 z-10 shadow-2xl">
        <div class="flex items-start gap-3 mb-5">
          <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:#1D9E75">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <h3 class="text-base font-medium text-slate-900">Aprovar orçamento</h3>
            <p class="text-sm text-slate-500 mt-0.5">Será convertido em pedido de produção (#ORC-{{ target?.id }})</p>
          </div>
        </div>

        <!-- Data de entrega -->
        <div class="mb-4">
          <label class="text-xs text-slate-500 ml-1 block mb-1.5">Data de entrega <span class="text-slate-400">(opcional)</span></label>
          <input :value="date" @input="setDate(($event.target as HTMLInputElement).value)"
            type="date" :min="today"
            class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"/>
          <p class="text-[11px] text-slate-400 mt-1.5">Deixe vazio pra definir depois no Kanban.</p>
        </div>

        <!-- Prioridade -->
        <div class="mb-6">
          <label class="text-xs text-slate-500 ml-1 block mb-2">Prioridade</label>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" @click="setPriority('NORMAL')"
              :class="['px-4 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2',
                priority === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300']">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>
              Normal
            </button>
            <button type="button" @click="setPriority('URGENT')"
              :class="['px-4 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2',
                priority === 'URGENT' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300']">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Urgente
            </button>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2">
          <button @click="emit('cancel')" type="button"
            class="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium border border-slate-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button @click="emit('confirm')" :disabled="loading" type="button"
            class="px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            style="background:#1D9E75"
            onmouseover="this.style.background='#168A65'"
            onmouseout="this.style.background='#1D9E75'">
            <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Aprovar e enviar
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
