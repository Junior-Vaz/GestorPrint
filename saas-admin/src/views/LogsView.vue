<template>
  <SidebarLayout>
    <div class="p-6 max-w-7xl mx-auto flex flex-col gap-6 h-full">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 p-6 shrink-0">
        <div class="flex items-center gap-4">
          <div class="p-2 bg-slate-800 rounded-xl text-white shadow-lg">
            <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-extrabold text-slate-800">Logs do Sistema</h1>
            <div class="flex items-center gap-2 mt-0.5">
              <span :class="['w-2 h-2 rounded-full', connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400']"></span>
              <span class="text-xs font-bold text-slate-400">{{ connected ? 'Conectado — tempo real' : 'Desconectado' }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <!-- Level filters -->
          <div class="flex gap-1">
            <button v-for="f in LEVEL_FILTERS" :key="f.value"
              @click="toggleLevel(f.value)"
              :class="['px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                activelevels.has(f.value) ? f.activeClass : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300']">
              {{ f.label }}
            </button>
          </div>

          <input v-model="search" placeholder="Filtrar mensagens..."
            class="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 w-44" />

          <button @click="clear"
            class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors">
            Limpar
          </button>

          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" v-model="autoScroll" class="accent-indigo-600 w-3.5 h-3.5" />
            <span class="text-xs font-bold text-slate-500">Auto-scroll</span>
          </label>
        </div>
      </div>

      <!-- Log terminal -->
      <div ref="terminal"
        class="flex-1 min-h-0 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-y-auto font-mono text-xs leading-relaxed p-4"
        @scroll="onScroll">

        <div v-if="filtered.length === 0" class="flex items-center justify-center h-full text-slate-500 italic">
          Aguardando logs...
        </div>

        <div v-for="(entry, i) in filtered" :key="i"
          class="flex gap-3 py-0.5 hover:bg-white/5 rounded px-1 transition-colors">
          <span class="text-slate-500 shrink-0 tabular-nums">{{ formatTime(entry.timestamp) }}</span>
          <span :class="['shrink-0 font-black w-14 text-center rounded', LEVEL_STYLE[entry.level]]">{{ entry.level.toUpperCase() }}</span>
          <span v-if="entry.context" class="text-indigo-400 shrink-0 max-w-[140px] truncate">[{{ entry.context }}]</span>
          <span :class="['flex-1 break-all whitespace-pre-wrap', MSG_STYLE[entry.level] || 'text-slate-200']">{{ entry.message }}</span>
        </div>
      </div>

      <!-- Footer count -->
      <div class="shrink-0 flex items-center justify-between text-xs text-slate-400 font-medium px-1">
        <span>{{ filtered.length }} de {{ logs.length }} entradas</span>
        <span v-if="logs.length >= 500" class="text-amber-500 font-bold">Buffer máximo (500) atingido — logs antigos descartados</span>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { io, Socket } from 'socket.io-client'
import SidebarLayout from '../components/SidebarLayout.vue'
import { apiFetch } from '../utils/api'

interface LogEntry {
  level: 'log' | 'error' | 'warn' | 'debug' | 'verbose'
  context: string
  message: string
  timestamp: string
}

const LEVEL_FILTERS = [
  { value: 'log',     label: 'LOG',     activeClass: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
  { value: 'warn',    label: 'WARN',    activeClass: 'bg-amber-100 border-amber-300 text-amber-700' },
  { value: 'error',   label: 'ERROR',   activeClass: 'bg-red-100 border-red-300 text-red-700' },
  { value: 'debug',   label: 'DEBUG',   activeClass: 'bg-blue-100 border-blue-300 text-blue-700' },
  { value: 'verbose', label: 'VERBOSE', activeClass: 'bg-slate-100 border-slate-300 text-slate-600' },
]
const LEVEL_STYLE: Record<string, string> = {
  log:     'text-emerald-400',
  warn:    'text-amber-400',
  error:   'text-red-400',
  debug:   'text-blue-400',
  verbose: 'text-slate-500',
}
const MSG_STYLE: Record<string, string> = {
  error:   'text-red-300',
  warn:    'text-amber-200',
  debug:   'text-blue-300',
  verbose: 'text-slate-500',
}

const logs = ref<LogEntry[]>([])
const connected = ref(false)
const search = ref('')
const autoScroll = ref(true)
const activelevels = ref(new Set(['log', 'warn', 'error', 'debug', 'verbose']))
const terminal = ref<HTMLElement | null>(null)

let socket: Socket | null = null

const filtered = computed(() => {
  let list = logs.value.filter(e => activelevels.value.has(e.level))
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(e => e.message.toLowerCase().includes(q) || e.context.toLowerCase().includes(q))
  }
  return list
})

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

const scrollToBottom = () => {
  if (terminal.value) terminal.value.scrollTop = terminal.value.scrollHeight
}

const onScroll = () => {
  if (!terminal.value) return
  const el = terminal.value
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  if (!atBottom && autoScroll.value) autoScroll.value = false
}

watch(filtered, async () => {
  if (autoScroll.value) {
    await nextTick()
    scrollToBottom()
  }
})

const toggleLevel = (level: string) => {
  if (activelevels.value.has(level)) {
    activelevels.value.delete(level)
  } else {
    activelevels.value.add(level)
  }
  activelevels.value = new Set(activelevels.value) // trigger reactivity
}

const clear = () => { logs.value = [] }

const connect = () => {
  socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] })

  socket.on('connect', () => { connected.value = true })
  socket.on('disconnect', () => { connected.value = false })

  socket.on('system_log', (entry: LogEntry) => {
    logs.value.push(entry)
    if (logs.value.length > 500) logs.value.shift()
  })
}

onMounted(async () => {
  // Load existing buffer
  try {
    const res = await apiFetch('/api/logs')
    if (res.ok) {
      const data = await res.json()
      logs.value = data
      await nextTick()
      scrollToBottom()
    }
  } catch { /* ignore */ }

  connect()
})

onUnmounted(() => {
  socket?.disconnect()
})
</script>
