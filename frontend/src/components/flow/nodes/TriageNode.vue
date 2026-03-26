<template>
  <div class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl min-w-28 bg-violet-100 border-2 border-violet-500 text-violet-900 font-black text-xs shadow-md shadow-violet-200/50">
    <Handle type="target" :position="Position.Top" />
    <span class="text-lg">🔀</span>
    <span class="text-center">{{ data.label || 'Triagem' }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeData } from '../../../types/flow'
defineProps<{ data: NodeData }>()
</script>
