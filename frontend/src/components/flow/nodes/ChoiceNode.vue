<template>
  <div class="relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl min-w-36 bg-orange-100 border-2 border-orange-500 text-orange-900 font-black text-xs shadow-md shadow-orange-200/50">
    <Handle type="target" :position="Position.Top" />
    <span class="text-lg">🔢</span>
    <span class="text-center">{{ data.label || 'Escolha' }}</span>
    <div v-if="data.options?.length" class="relative flex flex-wrap gap-1 justify-center mt-1 pb-2 max-w-44">
      <div v-for="opt in data.options" :key="opt.id" class="relative px-2 py-0.5 bg-orange-300/60 rounded-md text-[10px] font-bold">
        {{ opt.text }}
        <Handle type="source" :position="Position.Bottom" :id="opt.id" :style="handleStyle(opt.id)" />
      </div>
    </div>
    <Handle v-else type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeData } from '../../../types/flow'

const props = defineProps<{ data: NodeData }>()

function handleStyle(optId: string) {
  const idx = (props.data.options || []).findIndex(o => o.id === optId)
  const total = (props.data.options || []).length
  const pct = total > 1 ? (idx / (total - 1)) * 100 : 50
  return { left: `${pct}%`, bottom: '-8px', position: 'absolute' }
}
</script>
