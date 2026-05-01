<template>
  <div class="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3 text-sm">
    <div class="flex items-center gap-2 text-slate-500">
      <span class="text-xs">Mostrando {{ from }}–{{ to }} de {{ total }}</span>
      <select
        :value="limit"
        @change="$emit('update:limit', Number(($event.target as HTMLSelectElement).value)); $emit('update:page', 1)"
        class="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 text-xs focus:outline-none focus:border-slate-400 transition-colors"
      >
        <option v-for="n in [10, 20, 50, 100]" :key="n" :value="n">{{ n }} / página</option>
      </select>
    </div>

    <div class="flex items-center gap-1">
      <button
        @click="$emit('update:page', page - 1)"
        :disabled="page <= 1"
        class="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <template v-for="p in pages" :key="p">
        <span v-if="p === '...'" class="px-2 text-slate-400 text-xs">…</span>
        <button
          v-else
          @click="$emit('update:page', p as number)"
          :class="[
            'min-w-[32px] h-8 px-2 rounded-md text-xs transition-colors',
            p === page
              ? 'bg-slate-900 text-white font-medium'
              : 'border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          ]"
        >
          {{ p }}
        </button>
      </template>

      <button
        @click="$emit('update:page', page + 1)"
        :disabled="page >= totalPages"
        class="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'PaginationControls' })

const props = defineProps<{
  page: number
  totalPages: number
  total: number
  limit: number
}>()

defineEmits<{
  'update:page': [value: number]
  'update:limit': [value: number]
}>()

const from = computed(() => props.total === 0 ? 0 : (props.page - 1) * props.limit + 1)
const to = computed(() => Math.min(props.page * props.limit, props.total))

const pages = computed(() => {
  const total = props.totalPages
  const current = props.page
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const result: (number | string)[] = [1]
  if (current > 3) result.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) result.push(i)
  if (current < total - 2) result.push('...')
  result.push(total)
  return result
})
</script>
