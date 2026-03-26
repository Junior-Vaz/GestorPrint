<template>
  <div class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl min-w-27.5 bg-emerald-100 border-2 border-emerald-500 text-emerald-800 font-black text-xs shadow-md shadow-emerald-200/50">
    <span class="text-lg">▶</span>
    <span class="text-center">{{ data.label || 'Início' }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeData } from '../../../types/flow'
defineProps<{ data: NodeData }>()
</script>
