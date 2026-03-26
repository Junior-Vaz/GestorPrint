<template>
  <div class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl min-w-32 bg-amber-100 border-2 border-amber-500 text-amber-900 font-black text-xs shadow-md shadow-amber-200/50">
    <Handle type="target" :position="Position.Top" />
    <span class="text-lg">🔍</span>
    <span class="text-center">{{ data.label || 'Situacional' }}</span>
    <span class="px-2 py-0.5 bg-amber-300/60 rounded-full text-[10px] font-bold">{{ erpQueryLabel }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeData } from '../../../types/flow'

const props = defineProps<{ data: NodeData }>()
const erpQueryLabel = computed(() =>
  props.data.erpQuery === 'inventory' ? 'Catálogo' : 'Status Pedido'
)
</script>
