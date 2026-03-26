<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <div class="p-2 bg-purple-500 rounded-xl text-white shadow-lg shadow-purple-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          Agente de IA WhatsApp
        </h1>
        <p class="text-slate-500 mt-1 font-medium italic">Configure a IA e desenhe o fluxo de atendimento visual</p>
      </div>
      <div class="flex items-center gap-3 bg-white/80 px-4 py-2.5 rounded-xl border border-white/40 shadow-lg">
        <span class="text-xs font-black text-slate-400 uppercase tracking-wider">{{ config.enabled ? 'Agente Ativo' : 'Agente Inativo' }}</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="config.enabled" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-slate-200 pb-0">
      <button
        v-for="tab in tabs" :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'px-5 py-2.5 text-sm font-black rounded-t-xl border-b-2 transition-all',
          activeTab === tab.id
            ? 'bg-white border-purple-600 text-purple-700 shadow-sm'
            : 'border-transparent text-slate-400 hover:text-slate-600'
        ]"
      >{{ tab.label }}</button>
    </div>

    <!-- ─── Tab: Configurações ──────────────────────────────────────────────── -->
    <template v-if="activeTab === 'config'">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Gemini Card -->
        <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-100 bg-slate-50/80">
            <h3 class="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider">
              <div class="p-2 bg-amber-50 rounded-xl border border-amber-100">
                <Sparkles class="w-4 h-4 text-amber-500" />
              </div>
              Google Gemini (LLM)
            </h3>
          </div>
          <div class="p-6 space-y-5">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Google Gemini API Key</label>
              <input type="password" v-model="config.geminiKey" placeholder="Chave do Google AI Studio..."
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Modelo de IA</label>
                <select v-model="config.geminiModel"
                  class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm">
                  <option value="gemini-3-flash-preview">Gemini 3 Flash Preview ⚡ (Recomendado)</option>
                  <option value="gemini-2.0-flash-001">Gemini 2.0 Flash 🔥</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Máx. Tokens</label>
                <input type="number" v-model.number="config.maxTokens" min="100" max="8000" step="100"
                  class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm" />
              </div>
            </div>
          </div>
        </div>

        <!-- Evolution Card -->
        <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-100 bg-slate-50/80">
            <h3 class="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider">
              <div class="p-2 bg-green-50 rounded-xl border border-green-100">
                <MessageCircle class="w-4 h-4 text-green-500" />
              </div>
              Evolution API (WhatsApp)
            </h3>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">API Endpoint URL</label>
              <input type="text" v-model="config.evolutionUrl" placeholder="https://sua-api.com"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Instância</label>
                <input type="text" v-model="config.evolutionInstance" placeholder="gestorprint"
                  class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm" />
              </div>
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">API Key</label>
                <input type="password" v-model="config.evolutionKey" placeholder="Chave Evolution"
                  class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm" />
              </div>
            </div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" v-model="config.allowFileUploads" class="w-4 h-4 accent-purple-600" />
              <span class="text-sm font-bold text-slate-700">Receber arquivos (imagens, PDFs)</span>
            </label>
          </div>
        </div>

        <!-- Bot Personality full-width -->
        <div class="md:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-100 bg-slate-50/80">
            <h3 class="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider">
              <div class="p-2 bg-purple-50 rounded-xl border border-purple-100">
                <Bot class="w-4 h-4 text-purple-600" />
              </div>
              Serviços Liberados &amp; Prompt Base
            </h3>
          </div>
          <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="space-y-3">
              <div>
                <h4 class="text-xs font-black text-slate-900 uppercase">Categorias de produtos</h4>
                <p class="text-[10px] text-slate-400 font-bold">Quais produtos a IA pode vender?</p>
              </div>
              <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
                <label v-for="type in productTypes" :key="type.id"
                  :class="['flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer',
                    config.allowedProductTypes.includes(type.id) ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-100 hover:border-slate-300']">
                  <div :class="['w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all',
                    config.allowedProductTypes.includes(type.id) ? 'bg-purple-600 border-purple-600' : 'bg-white border-slate-200']">
                    <svg v-if="config.allowedProductTypes.includes(type.id)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <input type="checkbox" :value="type.id" v-model="config.allowedProductTypes" class="hidden" />
                  <span :class="['text-xs font-bold leading-none', config.allowedProductTypes.includes(type.id) ? 'text-purple-900' : 'text-slate-600']">{{ type.name }}</span>
                </label>
              </div>
            </div>
            <div class="md:col-span-2 space-y-3">
              <div>
                <h4 class="text-xs font-black text-slate-900 uppercase">System Prompt Base</h4>
                <p class="text-[10px] text-slate-400 font-bold">Instruções globais — cada nó do fluxo pode ter seu próprio prompt.</p>
              </div>
              <textarea v-model="config.agentPrompt" rows="10"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all resize-none"
                placeholder="Ex: Você é o atendente da Gráfica GestorPrint..."></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Save bar -->
      <div class="flex items-center justify-end bg-white/50 backdrop-blur-md p-5 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
        <button @click="saveConfig" :disabled="loading"
          class="flex items-center gap-3 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50">
          <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
          <Save v-else class="w-5 h-5" />
          Salvar Configurações
        </button>
      </div>
    </template>

    <!-- ─── Tab: Fluxo de Atendimento ──────────────────────────────────────── -->
    <template v-else-if="activeTab === 'flow'">
      <!-- Flow canvas area — fixed height -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden" style="height: 600px;">
        <div class="flex h-full">
          <NodePalette />
          <div class="flex-1 relative">
            <FlowCanvas
              v-if="flowLoaded"
              ref="canvasRef"
              :initial-nodes="flowNodes"
              :initial-edges="flowEdges"
              @node-select="onNodeSelect"
              @deselect="selectedNode = null"
            />
            <div v-else class="flex items-center justify-center h-full text-slate-400 font-bold text-sm">
              Carregando fluxo...
            </div>
          </div>
          <NodeInspector v-if="!previewOpen" :node="selectedNode" @update="onNodeUpdate" />
          <FlowPreview
            v-if="previewOpen"
            :nodes="canvasRef?.getFlowData()?.nodes ?? flowNodes"
            :edges="canvasRef?.getFlowData()?.edges ?? flowEdges"
          />
        </div>
      </div>

      <!-- Flow save bar -->
      <div class="flex items-center justify-between bg-white/50 backdrop-blur-md p-5 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
        <p class="text-xs font-bold text-slate-400">Conecte os nós arrastando os handles entre eles. Arraste componentes da paleta para o canvas.</p>
        <div class="flex items-center gap-3">
          <button @click="templatesOpen = true"
            class="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
            Templates
          </button>
          <button @click="previewOpen = !previewOpen"
            :class="previewOpen
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-100'
              : 'bg-green-500 hover:bg-green-600 text-white shadow-green-100'"
            class="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all shadow-lg active:scale-95">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {{ previewOpen ? 'Fechar Preview' : 'Testar Fluxo' }}
          </button>
          <button @click="saveFlow" :disabled="savingFlow"
            class="flex items-center gap-3 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50">
            <Loader2 v-if="savingFlow" class="w-5 h-5 animate-spin" />
            <Save v-else class="w-5 h-5" />
            Salvar Fluxo
          </button>
        </div>
      </div>

      <FlowTemplates v-if="templatesOpen" @close="templatesOpen = false" @apply="applyTemplate" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Bot, Sparkles, MessageCircle, Save, Loader2 } from 'lucide-vue-next'
import { apiFetch } from '../utils/api'
import { useToast } from '@/composables/useToast'
import FlowCanvas from '../components/flow/FlowCanvas.vue'
import NodePalette from '../components/flow/NodePalette.vue'
import NodeInspector from '../components/flow/NodeInspector.vue'
import FlowPreview from '../components/flow/FlowPreview.vue'
import FlowTemplates from '../components/flow/FlowTemplates.vue'
import type { FlowNodeDef, FlowEdgeDef } from '../types/flow'

const { showToast } = useToast()

const tabs = [
  { id: 'config', label: '⚙️  Configurações' },
  { id: 'flow',   label: '🗺️  Fluxo de Atendimento' },
]
const activeTab = ref<'config' | 'flow'>('config')

// ── Config ────────────────────────────────────────────────────────────────────
const loading = ref(false)
const productTypes = ref<any[]>([])
const config = ref({
  enabled: false,
  geminiKey: '',
  geminiModel: 'gemini-1.5-flash',
  maxTokens: 1000,
  evolutionUrl: 'https://api.cslsoftwares.com.br',
  evolutionKey: '',
  evolutionInstance: 'gestorprint',
  agentPrompt: 'Você é um atendente inteligente da nossa gráfica...',
  allowedProductTypes: [] as number[],
  allowFileUploads: true,
})

async function fetchConfig() {
  try {
    const res = await apiFetch('/api/mcp/config')
    if (res.ok) config.value = { ...config.value, ...await res.json() }
  } catch {}
}

async function fetchProductTypes() {
  try {
    const res = await apiFetch('/api/product-types')
    if (res.ok) productTypes.value = await res.json()
  } catch {}
}

async function saveConfig() {
  loading.value = true
  try {
    const res = await apiFetch('/api/mcp/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value),
    })
    if (res.ok) showToast('Configurações salvas com sucesso!', 'success')
    else showToast('Erro ao salvar configurações.', 'error')
  } finally {
    loading.value = false
  }
}

// ── Flow ──────────────────────────────────────────────────────────────────────
const flowLoaded = ref(false)
const savingFlow = ref(false)
const previewOpen = ref(false)
const templatesOpen = ref(false)
const flowNodes = ref<FlowNodeDef[]>([])
const flowEdges = ref<FlowEdgeDef[]>([])
const selectedNode = ref<FlowNodeDef | null>(null)
const canvasRef = ref<InstanceType<typeof FlowCanvas> | null>(null)

async function fetchFlow() {
  try {
    const res = await apiFetch('/api/mcp/flow-config')
    if (res.ok) {
      const data = await res.json()
      flowNodes.value = data.nodes || []
      flowEdges.value = data.edges || []
    }
  } finally {
    flowLoaded.value = true
  }
}

async function saveFlow() {
  if (!canvasRef.value) return
  savingFlow.value = true
  try {
    const { nodes, edges } = canvasRef.value.getFlowData()
    const res = await apiFetch('/api/mcp/flow-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, edges }),
    })
    if (res.ok) showToast('Fluxo salvo com sucesso!', 'success')
    else showToast('Erro ao salvar fluxo.', 'error')
  } finally {
    savingFlow.value = false
  }
}

function applyTemplate(nodes: FlowNodeDef[], edges: FlowEdgeDef[]) {
  flowNodes.value = nodes
  flowEdges.value = edges
  // Re-mount canvas with new data
  flowLoaded.value = false
  setTimeout(() => { flowLoaded.value = true }, 50)
}

function onNodeSelect(node: FlowNodeDef) { selectedNode.value = node }
function onNodeUpdate(updated: FlowNodeDef) {
  canvasRef.value?.updateNodeData(updated)
  selectedNode.value = updated
}

onMounted(() => {
  fetchConfig()
  fetchProductTypes()
  fetchFlow()
})
</script>
