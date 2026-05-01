<script setup lang="ts">
/**
 * Stack de avatares mostrando usuários online no mesmo tenant. Renderiza
 * até `max` avatares sobrepostos + chip "+N" quando passa do limite.
 *
 * Cada avatar tem dot verde pulsante embaixo-direita (indicador de online),
 * tooltip nativa com nome + função, e cor de fundo gerada por hash do nome
 * pra fallback de iniciais (mesmo padrão usado no avatar do customer).
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { usePresenceStore, type OnlineUser } from '../../stores/presence'
import { useAuthStore } from '../../stores/auth'

const props = withDefaults(defineProps<{
  /** Quantos avatares mostrar antes de colapsar em "+N". Default: 4 */
  max?: number
  /** Inclui o próprio usuário no stack? Default: false (mais limpo) */
  includeSelf?: boolean
}>(), {
  max: 4,
  includeSelf: false,
})

const presence = usePresenceStore()
const auth = useAuthStore()

const filtered = computed<OnlineUser[]>(() => {
  if (props.includeSelf) return presence.users
  return presence.users.filter(u => u.userId !== auth.user?.id)
})

const visible = computed(() => filtered.value.slice(0, props.max))
const overflow = computed(() => Math.max(0, filtered.value.length - props.max))

// Iniciais — mesma técnica usada no UsersView/CustomersView
function initials(name: string) {
  return (name || '?').split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase())
    .join('') || '?'
}

// Hash de cor pelo nome — mesma pessoa sempre tem a mesma cor
const PALETTE = [
  { bg: '#FEE2E2', fg: '#991B1B' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#DBEAFE', fg: '#1E40AF' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#E0E7FF', fg: '#3730A3' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#FFEDD5', fg: '#9A3412' },
]
function colorOf(name: string): { bg: string; fg: string; dot?: string } {
  let h = 0
  for (const c of name || '?') h = (h * 31 + c.charCodeAt(0)) % 1000
  // `!` é seguro porque PALETTE.length > 0 garantido em build time + módulo é
  // estático. TS strict reclama por causa de noUncheckedIndexedAccess.
  return PALETTE[h % PALETTE.length]!
}

function roleLabel(role: string) {
  return role === 'ADMIN' ? 'Administrador'
    : role === 'SALES' ? 'Vendas'
    : role === 'PRODUCTION' ? 'Produção' : role
}
function tooltipFor(u: OnlineUser) {
  return `${u.name}\n${roleLabel(u.role)} · online`
}

// Tempo relativo desde que entrou — "agora", "há 5 min", "há 2h"
function timeSince(ts: number) {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr}h`
  return `há ${Math.floor(hr / 24)}d`
}

// ── Popover state ────────────────────────────────────────────────────────
const showPopover = ref(false)
const wrapperEl = ref<HTMLDivElement | null>(null)

function togglePopover() {
  showPopover.value = !showPopover.value
}

// Fecha o popover ao clicar fora do componente. Usar mousedown em vez de click
// pra evitar race com botões que abrem outros popovers no mesmo gesto.
function onClickOutside(e: MouseEvent) {
  if (!showPopover.value) return
  const el = wrapperEl.value
  if (el && !el.contains(e.target as Node)) {
    showPopover.value = false
  }
}
function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') showPopover.value = false
}

// Auto-conecta/desconecta. Como esse componente fica no header global,
// conecta uma vez ao logar e desconecta ao deslogar (App.vue desmonta).
// O store é singleton — múltiplas chamadas a connect() são no-op.
onMounted(() => {
  presence.connect()
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onEsc)
})
onBeforeUnmount(() => {
  presence.disconnect()
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <div v-if="filtered.length > 0" ref="wrapperEl" class="relative">
    <!-- Stack clicável — abre popover com lista completa -->
    <button type="button" @click="togglePopover"
      :title="`${filtered.length} ${filtered.length === 1 ? 'pessoa online' : 'pessoas online'}`"
      class="flex items-center -space-x-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-full">
      <!-- Wrapper externo: sem overflow-hidden pra dot verde poder "vazar".
           Wrapper interno é quem segura overflow-hidden + ring branco da foto. -->
      <div v-for="u in visible" :key="u.userId"
        :title="tooltipFor(u)"
        class="relative transition-transform hover:scale-110 hover:z-10">
        <div class="w-7 h-7 rounded-full ring-2 ring-white overflow-hidden">
          <img v-if="u.photoUrl" :src="u.photoUrl" :alt="u.name"
            class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-[10px] font-semibold"
            :style="{ background: colorOf(u.name).bg, color: colorOf(u.name).fg }">
            {{ initials(u.name) }}
          </div>
        </div>
        <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white">
          <span class="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60"></span>
        </span>
      </div>

      <!-- Chip "+N" quando overflow -->
      <div v-if="overflow > 0"
        class="relative w-7 h-7 rounded-full ring-2 ring-white bg-slate-100 text-slate-600 text-[10px] font-semibold flex items-center justify-center hover:bg-slate-200 transition-colors">
        +{{ overflow }}
      </div>
    </button>

    <!-- Popover com lista completa — animação de entrada via Transition -->
    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1">
      <div v-if="showPopover"
        class="absolute right-0 mt-3 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-slate-900">Online agora</div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              {{ filtered.length }} {{ filtered.length === 1 ? 'colaborador' : 'colaboradores' }} no sistema
            </div>
          </div>
          <button @click="showPopover = false"
            class="w-7 h-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
            title="Fechar">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Lista scroll -->
        <div class="max-h-72 overflow-y-auto py-1">
          <div v-for="u in filtered" :key="u.userId"
            class="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
            <!-- Avatar com dot online -->
            <div class="relative shrink-0">
              <div class="w-9 h-9 rounded-full overflow-hidden ring-1 ring-slate-100">
                <img v-if="u.photoUrl" :src="u.photoUrl" :alt="u.name"
                  class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-xs font-semibold"
                  :style="{ background: colorOf(u.name).bg, color: colorOf(u.name).fg }">
                  {{ initials(u.name) }}
                </div>
              </div>
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            </div>
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-900 truncate">{{ u.name }}</div>
              <div class="text-[11px] text-slate-500 truncate">
                {{ roleLabel(u.role) }}
                <span class="text-slate-300 mx-1">·</span>
                <span class="text-emerald-600">{{ timeSince(u.since) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
