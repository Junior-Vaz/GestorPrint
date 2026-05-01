<script setup lang="ts">
/**
 * Switch / toggle controlado por estado reativo Vue puro.
 *
 * Razão de existir: a versão anterior usava o padrão Tailwind com
 * <label> + <input class="sr-only peer"> + <div peer-checked:...>.
 * Em alguns ambientes (Tailwind 4 + HMR + tela com plan store reativo),
 * o container <label> sumia visualmente após clique — bug intermitente
 * difícil de reproduzir consistentemente.
 *
 * Esta versão NÃO usa <label> envolvendo, NÃO usa sr-only, NÃO usa peer.
 * O clique no botão chama setValue() que emite o novo valor — totalmente
 * controlado pelo Vue. Estilização visual é direta no template, sem CSS
 * sibling/parent, então não tem como o "container sumir".
 */
defineProps<{
  label: string
  description?: string
  modelValue: boolean
  enabled: boolean
  disabledHint?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function toggle(currentValue: boolean, enabled: boolean) {
  if (!enabled) return
  emit('update:modelValue', !currentValue)
}
</script>

<template>
  <div
    :class="[
      'flex items-center justify-between p-3 rounded-lg border transition-colors',
      enabled
        ? 'bg-slate-50 border-transparent hover:bg-slate-100'
        : 'bg-slate-50/40 border-dashed border-slate-200',
    ]"
  >
    <div class="flex items-center gap-3 min-w-0">
      <span
        v-if="!enabled"
        class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400 shrink-0"
        title="Não disponível no plano atual"
      >
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
      </span>
      <div class="min-w-0">
        <div
          class="text-sm font-medium truncate"
          :class="enabled ? 'text-slate-900' : 'text-slate-500'"
        >{{ label }}</div>
        <div
          v-if="description || disabledHint"
          class="text-xs"
          :class="enabled ? 'text-slate-500' : 'text-slate-400'"
        >
          {{ enabled ? description : (disabledHint || 'Não disponível no plano atual') }}
        </div>
      </div>
    </div>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="!enabled"
      @click="toggle(modelValue, enabled)"
      :class="[
        'relative w-10 h-5 rounded-full transition-colors shrink-0',
        modelValue ? 'bg-[#1D9E75]' : 'bg-slate-300',
        enabled ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed',
      ]"
    >
      <span
        class="absolute top-0.5 left-0.5 block w-4 h-4 bg-white rounded-full shadow transition-transform duration-150"
        :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
      ></span>
    </button>
  </div>
</template>
