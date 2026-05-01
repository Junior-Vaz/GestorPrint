<template>
  <div>
    <div class="flex items-center justify-between mb-1">
      <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">{{ label }}</label>
      <span v-if="setting?.fromEnv" class="text-[10px] font-mono text-amber-700 uppercase tracking-wider">via env var</span>
      <span v-else-if="setting?.value" class="text-[10px] font-mono text-emerald-700 uppercase tracking-wider">salvo</span>
    </div>
    <div class="relative">
      <input
        :type="setting?.isSecret && !revealed ? 'password' : 'text'"
        :value="draft"
        @input="(e: Event) => $emit('update', (e.target as HTMLInputElement).value)"
        :placeholder="setting?.isSecret && setting?.value ? setting.value : (placeholder || '')"
        class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors"
        :class="setting?.isSecret ? 'pr-9 font-mono' : ''"
      />
      <button v-if="setting?.isSecret" type="button" @click="revealed = !revealed"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors"
        :title="revealed ? 'Ocultar' : 'Mostrar'">
        <svg v-if="!revealed" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
        </svg>
      </button>
    </div>
    <p v-if="hint" class="text-[11px] text-slate-400 mt-1">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Setting { value: string; isSecret: boolean; fromEnv: boolean }

defineProps<{
  label: string
  keyName: string
  setting?: Setting
  draft: string
  placeholder?: string
  hint?: string
}>()

defineEmits<{ update: [value: string] }>()

const revealed = ref(false)
</script>
