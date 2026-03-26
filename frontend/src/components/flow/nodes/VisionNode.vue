<template>
  <div class="relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl min-w-36 bg-indigo-100 border-2 border-indigo-500 text-indigo-900 font-black text-xs shadow-md shadow-indigo-200/50">
    <Handle type="target" :position="Position.Top" />
    <span class="text-lg">👁</span>
    <span class="text-center">{{ data.label || 'Visão IA' }}</span>
    <div v-if="data.edges?.length" class="relative flex flex-wrap gap-1 justify-center mt-1 pb-2 max-w-44">
      <div v-for="edge in data.edges" :key="edge.id" class="relative px-2 py-0.5 bg-indigo-300/60 rounded-md text-[10px] font-bold">
        {{ edge.label }}
        <Handle type="source" :position="Position.Bottom" :id="edge.id" :style="edgeHandleStyle(edge.id)" />
      </div>
    </div>
    <Handle v-else type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeData } from '../../../types/flow'

const props = defineProps<{ data: NodeData }>()

function edgeHandleStyle(edgeId: string) {
  const idx = (props.data.edges || []).findIndex(e => e.id === edgeId)
  const total = (props.data.edges || []).length
  const pct = total > 1 ? (idx / (total - 1)) * 100 : 50
  return { left: `${pct}%`, bottom: '-8px', position: 'absolute' }
}
</script>
