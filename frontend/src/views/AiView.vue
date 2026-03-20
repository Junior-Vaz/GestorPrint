<template>
  <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Header -->
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 mb-3">
          <Sparkles class="w-3.5 h-3.5 text-purple-600" />
          <span class="text-[10px] font-black text-purple-600 uppercase tracking-widest">Inteligência Artificial</span>
        </div>
        <h2 class="text-3xl font-black text-slate-900 tracking-tight">Agente de IA WhatsApp</h2>
        <p class="text-slate-500 font-medium">Configure o cérebro do seu assistente virtual e integre com o WhatsApp.</p>
      </div>
      
      <div class="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
        <span class="text-xs font-black text-slate-400 uppercase tracking-wider">{{ config.enabled ? 'Agente Ativo' : 'Agente Inativo' }}</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="config.enabled" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Gemini Card -->
      <section class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div class="p-6 border-b border-slate-50 bg-slate-50/30">
          <h3 class="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider">
            <div class="p-2 bg-amber-50 rounded-xl border border-amber-100">
              <Sparkles class="w-4 h-4 text-amber-500" />
            </div>
            Google Gemini (LLM)
          </h3>
        </div>
        <div class="p-6 space-y-5">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Google Gemini API Key</label>
            <input 
              type="password" 
              v-model="config.geminiKey"
              placeholder="Chave do Google AI Studio..."
              class="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none transition-all"
            >
            <p class="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <Info class="w-3 h-3" />
              Obtenha grátis no <a href="https://aistudio.google.com/" target="_blank" class="text-purple-600 font-bold hover:underline">Google AI Studio</a>
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Modelo de IA</label>
              <select
                v-model="config.geminiModel"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-purple-600 outline-none transition-all"
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash ⚡ (Recomendado)</option>
                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite 🪶 (Mais cota grátis)</option>
                <option value="gemini-1.5-flash-002">Gemini 1.5 Flash 💨 (Rápido)</option>
                <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B 🔋 (Mais leve)</option>
              </select>
              <p class="text-[10px] text-slate-400 mt-1 font-medium">Modelos pagos precisam de faturamento ativo</p>
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Máx. Tokens Resposta</label>
              <input
                type="number"
                v-model.number="config.maxTokens"
                min="100"
                max="8000"
                step="100"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-purple-600 outline-none transition-all"
              >
              <p class="text-[10px] text-slate-400 mt-1 font-medium">Mais tokens = respostas mais longas (e mais caro)</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Evolution Card -->
      <section class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div class="p-6 border-b border-slate-50 bg-slate-50/30">
          <h3 class="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider">
            <div class="p-2 bg-green-50 rounded-xl border border-green-100">
              <MessageCircle class="w-4 h-4 text-green-500" />
            </div>
            Evolution API (WhatsApp)
          </h3>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">API Endpoint URL</label>
            <input 
              type="text" 
              v-model="config.evolutionUrl"
              placeholder="https://sua-api.com"
              class="w-full bg-slate-50 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-purple-600 outline-none"
            >
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Instância</label>
              <input 
                type="text" 
                v-model="config.evolutionInstance"
                placeholder="gestorprint"
                class="w-full bg-slate-50 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-purple-600 outline-none"
              >
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">API Key</label>
              <input 
                type="password" 
                v-model="config.evolutionKey"
                placeholder="Chave Evolution"
                class="w-full bg-slate-50 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-purple-600 outline-none"
              >
            </div>
          </div>
        </div>
      </section>

      <!-- Bot Personality -->
      <section class="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider">
            <div class="p-2 bg-purple-50 rounded-xl border border-purple-100">
              <Bot class="w-4 h-4 text-purple-600" />
            </div>
            Cérebro & Comportamento
          </h3>
          <div class="flex items-center gap-6">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-slate-400 uppercase">Receber Arquivos</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="config.allowFileUploads" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              </label>
            </div>
          </div>
        </div>
        
        <div class="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Categories -->
          <div class="space-y-4">
            <header>
              <h4 class="text-xs font-black text-slate-900 uppercase">Serviços Liberados</h4>
              <p class="text-[10px] text-slate-400 font-bold">Quais produtos a IA pode vender?</p>
            </header>
            <div class="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <label v-for="type in productTypes" :key="type.id" 
                :class="['flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer', 
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
            <header>
              <h4 class="text-xs font-black text-slate-900 uppercase">Instruções de Personalidade (Prompt)</h4>
              <p class="text-[10px] text-slate-400 font-bold">Defina como o Agente deve se comportar com seus clientes.</p>
            </header>
            <textarea 
              v-model="config.agentPrompt"
              rows="10"
              class="w-full bg-slate-50 border-slate-100 rounded-3xl px-6 py-5 font-bold text-slate-700 text-sm leading-relaxed placeholder:text-slate-300 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none resize-none transition-all shadow-inner"
              placeholder="Ex: Você é o atendente da Gráfica GestorPrint. Seja educado, rápido e ajude o cliente com preços e prazos..."
            ></textarea>

            <div class="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-3">
              <Info class="w-5 h-5 text-blue-500 shrink-0" />
              <p class="text-[11px] text-blue-700 font-bold leading-relaxed">
                <span class="text-blue-900 block mb-1">💡 DICA DE EXPERT</span>
                Instrua a IA a usar as ferramentas de estoque (`get_inventory`) e status de pedido (`get_order_status`) para respostas precisas. O Agente sempre priorizará o pagamento via Pix.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Actions -->
    <footer class="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
       <div class="flex items-center gap-3 px-4">
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
        class="bg-indigo-600 hover:bg-black text-white px-10 py-4 rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-indigo-100 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
      >
        <Save v-if="!loading" class="w-5 h-5" />
        <Loader2 v-else class="w-5 h-5 animate-spin" />
        Salvar Configurações
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Bot, Sparkles, MessageCircle, UserRound, Save, Info, Loader2 } from 'lucide-vue-next'
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
