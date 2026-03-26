<template>
  <div class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl min-w-32 bg-blue-100 border-2 border-blue-500 text-blue-900 font-black text-xs shadow-md shadow-blue-200/50">
    <Handle type="target" :position="Position.Top" />
    <span class="text-lg">📋</span>
    <span class="text-center">{{ data.label || 'Coleta' }}</span>
    <div v-if="data.fields?.length" class="flex flex-wrap gap-1 justify-center mt-1 max-w-40">
      <span v-for="f in data.fields" :key="f.name" class="px-1.5 py-0.5 bg-blue-300/60 rounded-md text-[10px] font-bold">{{ f.name }}</span>
    </div>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeData } from '../../../types/flow'
defineProps<{ data: NodeData }>()
</script>
