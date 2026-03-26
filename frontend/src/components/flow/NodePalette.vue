<template>
  <div class="w-36 shrink-0 flex flex-col gap-1.5 p-3 bg-slate-50/80 border-r border-slate-200 overflow-y-auto">
    <p class="px-1 pt-1 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Componentes</p>
    <div
      v-for="item in items" :key="item.type"
      draggable="true"
      @dragstart="onDrag($event, item.type)"
      class="flex items-center gap-2 px-3 py-2 rounded-xl border-2 bg-white text-xs font-bold cursor-grab select-none transition-all hover:scale-[1.03] hover:opacity-80"
      :style="{ borderColor: item.color, color: item.color }"
    >
      <span>{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const items = [
  { type: 'start',       label: 'Início',      icon: '▶', color: '#10b981' },
  { type: 'triage',      label: 'Triagem',     icon: '🔀', color: '#8b5cf6' },
  { type: 'collect',     label: 'Coleta',      icon: '📋', color: '#3b82f6' },
  { type: 'situational', label: 'Situacional', icon: '🔍', color: '#f59e0b' },
  { type: 'choice',      label: 'Escolha',     icon: '🔢', color: '#f97316' },
  { type: 'vision',      label: 'Visão IA',    icon: '👁',  color: '#6366f1' },
  { type: 'action',      label: 'Ação',        icon: '⚡', color: '#ef4444' },
  { type: 'end',         label: 'Fim',         icon: '🏁', color: '#64748b' },
]

function onDrag(event: DragEvent, type: string) {
  event.dataTransfer?.setData('application/vueflow', type)
}
</script>
