<template>
  <SidebarLayout>
    <div class="p-6 max-w-7xl mx-auto flex flex-col gap-4 h-full">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 shrink-0">
        <div>
          <div class="flex items-center gap-2">
            <span :class="['w-1.5 h-1.5 rounded-full', connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400']"></span>
            <p class="text-[11px] font-mono text-slate-400 uppercase tracking-[0.18em]">
              {{ connected ? 'Stream live · tempo real' : 'Desconectado' }}
            </p>
          </div>
          <h1 class="text-[22px] font-medium text-slate-900 mt-0.5 tracking-tight">Logs do sistema</h1>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Level filters -->
          <div class="flex gap-1">
            <button v-for="f in LEVEL_FILTERS" :key="f.value"
              @click="toggleLevel(f.value)"
              :class="['px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors border',
                activelevels.has(f.value) ? f.activeClass : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400']">
              {{ f.label }}
            </button>
          </div>

          <input v-model="search" placeholder="Filtrar mensagens..."
            class="px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:border-slate-400 w-44 transition-colors" />

          <button @click="clear"
            class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-md transition-colors">
            Limpar
          </button>

          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" v-model="autoScroll" class="accent-slate-900 w-3.5 h-3.5" />
            <span class="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Auto-scroll</span>
          </label>
        </div>
      </div>

      <!-- Log terminal — fundo escuro mantém a vibe "console", dialoga com a sidebar -->
      <div ref="terminal"
        class="flex-1 min-h-0 bg-slate-950 rounded-md border border-slate-800 overflow-y-auto font-mono text-[11px] leading-relaxed p-3"
        @scroll="onScroll">

        <div v-if="filtered.length === 0" class="flex items-center justify-center h-full text-slate-500">
          <span class="font-mono text-[11px] uppercase tracking-wider">Aguardando logs...</span>
        </div>

        <div v-for="(entry, i) in filtered" :key="i"
          class="flex gap-3 py-0.5 hover:bg-white/5 rounded px-1 transition-colors">
          <span class="text-slate-600 shrink-0 tabular-nums">{{ formatTime(entry.timestamp) }}</span>
          <span :class="['shrink-0 font-medium w-14 text-center rounded uppercase tracking-wider', LEVEL_STYLE[entry.level]]">{{ entry.level }}</span>
          <span v-if="entry.context" class="text-blue-400 shrink-0 max-w-[140px] truncate">[{{ entry.context }}]</span>
          <span :class="['flex-1 break-all whitespace-pre-wrap', MSG_STYLE[entry.level] || 'text-slate-200']">{{ entry.message }}</span>
        </div>
      </div>

      <!-- Footer count -->
      <div class="shrink-0 flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
        <span>{{ filtered.length }} de {{ logs.length }} entradas</span>
        <span v-if="logs.length >= 500" class="text-amber-600">Buffer máximo (500) atingido — logs antigos descartados</span>
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
  { value: 'log',     label: 'LOG',     activeClass: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { value: 'warn',    label: 'WARN',    activeClass: 'bg-amber-50 border-amber-200 text-amber-700' },
  { value: 'error',   label: 'ERROR',   activeClass: 'bg-red-50 border-red-200 text-red-700' },
  { value: 'debug',   label: 'DEBUG',   activeClass: 'bg-blue-50 border-blue-200 text-blue-700' },
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
  // Namespace dedicado /logs — só super admins. Backend valida JWT no handshake.
  const token = localStorage.getItem('sa_token')
  socket = io('/logs', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
  })

  socket.on('connect', () => { connected.value = true })
  socket.on('disconnect', () => { connected.value = false })
  socket.on('auth_error', (err: any) => {
    connected.value = false
    console.warn('[ws] auth_error', err?.reason)
  })

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
