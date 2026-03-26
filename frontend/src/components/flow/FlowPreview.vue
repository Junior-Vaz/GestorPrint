<template>
  <div class="w-80 shrink-0 flex flex-col border-l border-slate-200 bg-white">
    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-3 bg-green-600 text-white shrink-0">
      <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center font-black text-base">🤖</div>
      <div class="flex-1 min-w-0">
        <p class="font-black text-sm">Preview Real</p>
        <p class="text-[10px] text-green-200 font-medium">Gemini + Motor de Fluxo</p>
      </div>
      <button @click="reset" title="Reiniciar conversa"
        class="text-green-200 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-green-700 transition-all shrink-0">
        ↺
      </button>
    </div>

    <!-- Messages -->
    <div ref="chatEl" class="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-100">
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
        <p class="text-xs text-slate-400 font-bold">Envie uma mensagem para iniciar o fluxo com IA real</p>
        <p class="text-[10px] text-slate-300 font-medium">O fluxo atual do canvas será usado (incluindo alterações não salvas)</p>
      </div>
      <div v-for="(msg, i) in messages" :key="i" :class="['flex', msg.from === 'user' ? 'justify-end' : 'justify-start']">
        <div :class="[
          'max-w-[85%] px-3 py-2 rounded-2xl text-xs font-medium shadow-sm whitespace-pre-wrap',
          msg.from === 'user'
            ? 'bg-green-500 text-white rounded-br-sm'
            : 'bg-white text-slate-800 rounded-bl-sm'
        ]">{{ msg.text }}</div>
      </div>
      <div v-if="loading" class="flex justify-start">
        <div class="bg-white px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm flex gap-1 items-center">
          <span v-for="n in 3" :key="n" class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" :style="{ animationDelay: `${(n-1)*0.15}s` }" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="px-3 py-2 bg-red-50 border-t border-red-100 text-[11px] text-red-600 font-bold">
      {{ error }}
    </div>

    <!-- Input -->
    <div class="flex items-center gap-2 px-3 py-2.5 bg-white border-t border-slate-200 shrink-0">
      <input
        v-model="inputText"
        @keydown.enter="send"
        placeholder="Digite uma mensagem..."
        :disabled="loading"
        class="flex-1 px-3 py-2 bg-slate-100 rounded-full text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-green-400/40 transition-all disabled:opacity-50"
      />
      <button @click="send" :disabled="!inputText.trim() || loading"
        class="w-8 h-8 bg-green-500 hover:bg-green-600 disabled:opacity-40 rounded-full flex items-center justify-center text-white transition-all shrink-0">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { nanoid } from 'nanoid'
import { apiFetch } from '../../utils/api'
import type { FlowNodeDef, FlowEdgeDef } from '../../types/flow'

const props = defineProps<{
  nodes: FlowNodeDef[]
  edges: FlowEdgeDef[]
}>()

interface Msg { from: 'user' | 'bot'; text: string }

const messages  = ref<Msg[]>([])
const inputText = ref('')
const loading   = ref(false)
const error     = ref('')
const chatEl    = ref<HTMLElement | null>(null)
const sessionId = ref(nanoid(8))

watch(messages, () => nextTick(() => {
  if (chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight
}), { deep: true })

async function send() {
  const text = inputText.value.trim()
  if (!text || loading.value) return
  inputText.value = ''
  error.value = ''
  messages.value.push({ from: 'user', text })
  loading.value = true

  try {
    const res = await apiFetch('/api/mcp/flow-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId.value,
        message: text,
        nodes: props.nodes,
        edges: props.edges,
      }),
    })

    if (!res.ok) { error.value = 'Erro ao conectar ao motor de IA.'; return }

    const data = await res.json()
    if (data.response) {
      messages.value.push({ from: 'bot', text: data.response })
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function reset() {
  messages.value = []
  error.value = ''
  inputText.value = ''

  // Delete server-side session
  await apiFetch('/api/mcp/flow-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionId.value, reset: true }),
  }).catch(() => {})

  // New session ID so next message starts fresh
  sessionId.value = nanoid(8)
}
</script>
