<template>
  <div class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl min-w-27.5 bg-slate-100 border-2 border-slate-400 text-slate-700 font-black text-xs shadow-md shadow-slate-200/50">
    <Handle type="target" :position="Position.Top" />
    <span class="text-lg">🏁</span>
    <span class="text-center">{{ data.label || 'Fim' }}</span>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeData } from '../../../types/flow'
defineProps<{ data: NodeData }>()
</script>
