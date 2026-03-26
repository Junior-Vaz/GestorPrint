<template>
  <div class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl min-w-36 bg-red-100 border-2 border-red-500 text-red-900 font-black text-xs shadow-md shadow-red-200/50">
    <Handle type="target" :position="Position.Top" />
    <span class="text-lg">⚡</span>
    <span class="text-center">{{ data.label || 'Ação' }}</span>
    <span class="px-2 py-0.5 bg-red-300/60 rounded-full text-[10px] font-bold">{{ actionLabel }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeData } from '../../../types/flow'

const props = defineProps<{ data: NodeData }>()

const actionLabel = computed(() => {
  switch (props.data.action) {
    case 'create_estimate':  return 'Criar Orçamento'
    case 'generate_pix':     return 'Gerar PIX'
    case 'calculate_and_pix': return 'Calcular + PIX'
    case 'notify_operator':  return 'Notificar Operador'
    default: return 'Ação'
  }
})
</script>
