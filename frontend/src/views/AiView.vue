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
        <p class="text-slate-500 mt-1 font-medium italic">Configure o cérebro do seu assistente virtual e integre com o WhatsApp</p>
      </div>

      <div class="flex items-center gap-3 bg-white/80 px-4 py-2.5 rounded-xl border border-white/40 shadow-lg">
        <span class="text-xs font-black text-slate-400 uppercase tracking-wider">{{ config.enabled ? 'Agente Ativo' : 'Agente Inativo' }}</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="config.enabled" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>
    </div>

    <!-- Config Cards Grid -->
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
            <input
              type="password"
              v-model="config.geminiKey"
              placeholder="Chave do Google AI Studio..."
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm"
            >
            <p class="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <Info class="w-3 h-3" />
              Obtenha grátis no <a href="https://aistudio.google.com/" target="_blank" class="text-purple-600 font-bold hover:underline">Google AI Studio</a>
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Modelo de IA</label>
              <select
                v-model="config.geminiModel"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm"
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash ⚡ (Recomendado)</option>
                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite 🪶 (Mais cota grátis)</option>
                <option value="gemini-1.5-flash-002">Gemini 1.5 Flash 💨 (Rápido)</option>
                <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B 🔋 (Mais leve)</option>
              </select>
              <p class="text-[10px] text-slate-400 mt-1 font-medium">Modelos pagos precisam de faturamento ativo</p>
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Máx. Tokens Resposta</label>
              <input
                type="number"
                v-model.number="config.maxTokens"
                min="100"
                max="8000"
                step="100"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm"
              >
              <p class="text-[10px] text-slate-400 mt-1 font-medium">Mais tokens = respostas mais longas (e mais caro)</p>
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
            <input
              type="text"
              v-model="config.evolutionUrl"
              placeholder="https://sua-api.com"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm"
            >
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Instância</label>
              <input
                type="text"
                v-model="config.evolutionInstance"
                placeholder="gestorprint"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm"
              >
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">API Key</label>
              <input
                type="password"
                v-model="config.evolutionKey"
                placeholder="Chave Evolution"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-sm"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Bot Personality -->
      <div class="md:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider">
            <div class="p-2 bg-purple-50 rounded-xl border border-purple-100">
              <Bot class="w-4 h-4 text-purple-600" />
            </div>
            Cérebro & Comportamento
          </h3>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black text-slate-400 uppercase">Receber Arquivos</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="config.allowFileUploads" class="sr-only peer">
              <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>
        </div>

        <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Categories -->
          <div class="space-y-4">
            <div>
              <h4 class="text-xs font-black text-slate-900 uppercase">Serviços Liberados</h4>
              <p class="text-[10px] text-slate-400 font-bold">Quais produtos a IA pode vender?</p>
            </div>
            <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
              <label v-for="type in productTypes" :key="type.id"
                :class="['flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer',
                  config.allowedProductTypes.includes(type.id) ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-100 hover:border-slate-300']">
                <div :class="['w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all',
                  config.allowedProductTypes.includes(type.id) ? 'bg-purple-600 border-purple-600' : 'bg-white border-slate-200']">
                  <svg v-if="config.allowedProductTypes.includes(type.id)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <input
                  type="checkbox"
                  :value="type.id"
                  v-model="config.allowedProductTypes"
                  class="hidden"
                >
                <span :class="['text-xs font-bold leading-none', config.allowedProductTypes.includes(type.id) ? 'text-purple-900' : 'text-slate-600']">
                  {{ type.name }}
                </span>
              </label>
            </div>
          </div>

          <!-- Prompt -->
          <div class="md:col-span-2 space-y-4">
            <div>
              <h4 class="text-xs font-black text-slate-900 uppercase">Instruções de Personalidade (Prompt)</h4>
              <p class="text-[10px] text-slate-400 font-bold">Defina como o Agente deve se comportar com seus clientes.</p>
            </div>
            <textarea
              v-model="config.agentPrompt"
              rows="10"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all resize-none"
              placeholder="Ex: Você é o atendente da Gráfica GestorPrint. Seja educado, rápido e ajude o cliente com preços e prazos..."
            ></textarea>

            <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3">
              <Info class="w-5 h-5 text-blue-500 shrink-0" />
              <p class="text-[11px] text-blue-700 font-bold leading-relaxed">
                <span class="text-blue-900 block mb-1">💡 DICA DE EXPERT</span>
                Instrua a IA a usar as ferramentas de estoque (`get_inventory`) e status de pedido (`get_order_status`) para respostas precisas. O Agente sempre priorizará o pagamento via Pix.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions Footer -->
    <div class="flex items-center justify-between bg-white/50 backdrop-blur-md p-5 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div class="flex items-center gap-3 px-2">
        <div class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
          <Bot class="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <div class="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Status da Configuração</div>
          <div class="text-[11px] font-bold text-slate-400">Totalmente sincronizado com o servidor.</div>
        </div>
      </div>

      <button
        @click="saveConfig"
        :disabled="loading"
        class="flex items-center gap-3 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
      >
        <Save v-if="!loading" class="w-5 h-5" />
        <Loader2 v-else class="w-5 h-5 animate-spin" />
        Salvar Configurações
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Bot, Sparkles, MessageCircle, Save, Info, Loader2 } from 'lucide-vue-next'
import { apiFetch } from '../utils/api'
import { useToast } from '@/composables/useToast'

const { showToast } = useToast()
const loading = ref(false)
const productTypes = ref<any[]>([])
const config = ref({
  enabled: false,
  geminiKey: '',
  geminiModel: 'gemini-2.0-flash',
  maxTokens: 1000,
  evolutionUrl: 'https://api.cslsoftwares.com.br',
  evolutionKey: '',
  evolutionInstance: 'gestorprint',
  agentPrompt: 'Você é um atendente inteligente da Gráfica GestorPrint. \nREGRAS CRÍTICAS:\n1. Sempre consulte o estoque e preços usando get_inventory.\n2. Para fechar um pedido, você DEVE gerar um Pix usando generate_pix e informar ao cliente que a produção só começa após o pagamento.\n3. Se o cliente enviar fotos ou artes, use upload_artwork para anexar ao pedido.\n4. Seja sempre educado e profissional.',
  allowedProductTypes: [] as number[],
  allowFileUploads: true
})

const fetchConfig = async () => {
  try {
    const res = await apiFetch('/api/mcp/config')
    if (res.ok) {
      const data = await res.json()
      config.value = { ...config.value, ...data }
    }
  } catch (error) {
    console.error('Error fetching AI config:', error)
  }
}

const fetchProductTypes = async () => {
  try {
    const res = await apiFetch('/api/product-types')
    if (res.ok) productTypes.value = await res.json()
  } catch (error) {
    console.error('Error fetching product types:', error)
  }
}

const saveConfig = async () => {
  loading.value = true
  try {
    const res = await apiFetch('/api/mcp/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value)
    })
    if (res.ok) showToast('Configurações salvas com sucesso!', 'success')
    else showToast('Erro ao salvar configurações.', 'error')
  } catch (error) {
    showToast('Erro ao salvar configurações.', 'error')
    console.error('Error saving AI config:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchConfig()
  fetchProductTypes()
})
</script>
