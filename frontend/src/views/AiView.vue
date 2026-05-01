<template>
  <div class="max-w-5xl mx-auto px-6 py-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-xl font-medium text-slate-900">Agente de IA</h1>
        <p class="text-sm text-slate-500 mt-1">Configurações da inteligência artificial e da integração com o WhatsApp</p>
      </div>
      <div class="flex items-center gap-3 border border-slate-200 rounded-full px-4 py-2">
        <span class="text-xs font-medium" :class="config.enabled ? 'text-[#1D9E75]' : 'text-slate-500'">
          {{ config.enabled ? 'Agente ativo' : 'Agente inativo' }}
        </span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="config.enabled" class="sr-only peer" />
          <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#1D9E75] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
        </label>
      </div>
    </div>

    <!-- Tabs nav (mesmo padrão de ReportsView e outras telas) -->
    <div class="flex items-center gap-1 border-b border-slate-200 mb-5">
      <button
        v-for="t in tabs" :key="t.value"
        @click="activeTab = t.value"
        type="button"
        :class="['shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap',
          activeTab === t.value
            ? 'text-slate-900 border-slate-900 font-medium'
            : 'text-slate-500 border-transparent hover:text-slate-900']">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="t.icon"/>
        </svg>
        {{ t.label }}
      </button>
    </div>

    <!-- ════════════════════════════════════════════════════════════════ -->
    <!-- TAB: IA — provedor, modelo, key                                  -->
    <!-- ════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'ia'" class="space-y-5">
      <!-- Provedor de IA -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 class="text-sm font-medium text-slate-900">Inteligência artificial</h3>
          <span class="ml-auto text-[11px] text-slate-400">Escolha o provedor + modelo</span>
        </header>
        <div class="p-5 space-y-4">
          <!-- Provedor (7 opções: Google/OpenAI/Anthropic/Groq/DeepSeek/OpenRouter/Ollama) -->
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Provedor</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <button v-for="p in providers" :key="p.value"
                type="button"
                @click="selectProvider(p.value)"
                :class="config.aiProvider === p.value
                  ? 'border-slate-900 bg-slate-50 text-slate-900'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'"
                class="border rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors">
                {{ p.label }}
              </button>
            </div>
          </div>

          <!-- API Key (rótulo dinâmico baseado no provider) -->
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">API Key</label>
            <input
              type="password"
              v-model="config.geminiKey"
              :placeholder="`Chave de ${currentProvider?.label || 'IA'}`"
              class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors"
            />
            <p v-if="currentProvider" class="text-[11px] text-slate-400 mt-1.5">
              Obtenha em
              <a :href="currentProvider.consoleUrl" target="_blank" rel="noopener" class="underline hover:text-slate-600">
                {{ currentProviderHost }}
              </a>
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs text-slate-500">Modelo</label>
                <label class="inline-flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    v-model="customModelMode"
                    class="w-3 h-3 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-400"
                  />
                  Customizado
                </label>
              </div>
              <select
                v-if="!customModelMode"
                v-model="config.geminiModel"
                class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors bg-white"
              >
                <option v-for="m in currentModels" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <input
                v-else
                type="text"
                v-model="config.geminiModel"
                :placeholder="customModelPlaceholder"
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors font-mono"
              />
              <p v-if="customModelMode" class="text-[11px] text-slate-400 mt-1.5">
                Cole o ID exato do modelo
                <template v-if="config.aiProvider === 'openrouter'">
                  — veja em
                  <a href="https://openrouter.ai/models" target="_blank" rel="noopener" class="underline hover:text-slate-600">openrouter.ai/models</a>
                </template>
                <template v-else-if="config.aiProvider === 'ollama'">
                  — qualquer modelo que você puxou via <code class="bg-slate-100 px-1 py-0.5 rounded">ollama pull</code>
                </template>
                <template v-else>
                  conforme aparece na documentação do {{ currentProvider?.label || 'provider' }}.
                </template>
              </p>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Máx. tokens</label>
              <input
                type="number"
                v-model.number="config.maxTokens"
                min="100"
                max="8000"
                step="100"
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ════════════════════════════════════════════════════════════════ -->
    <!-- TAB: WhatsApp — Evolution + Restrições + Conexão + Teste         -->
    <!-- ════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'whatsapp'" class="space-y-5">
      <!-- Evolution / WhatsApp -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 class="text-sm font-medium text-slate-900">WhatsApp (Evolution API)</h3>
        </header>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Endpoint da API</label>
            <input
              type="text"
              v-model="config.evolutionUrl"
              placeholder="https://sua-api.com"
              class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Instância</label>
              <input
                type="text"
                v-model="config.evolutionInstance"
                placeholder="gestorprint"
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">API Key</label>
              <input
                type="password"
                v-model="config.evolutionKey"
                placeholder="Chave Evolution"
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>

          <label class="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              v-model="config.allowFileUploads"
              class="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-400"
            />
            <span class="text-sm text-slate-700">Receber arquivos (imagens, PDFs)</span>
          </label>
        </div>
      </section>

      <!-- ═════════ Restrições do agente — o que o WhatsApp pode oferecer ═════════ -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <h3 class="text-sm font-medium text-slate-900">Restrições do agente</h3>
          <span class="ml-auto text-[11px] text-slate-400">O que o cliente pode pedir pelo WhatsApp</span>
        </header>

      <div class="p-5 space-y-6">
        <!-- Tipos de orçamento permitidos -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-2">Tipos de orçamento permitidos</label>
          <p class="text-[11px] text-slate-500 mb-3">Marque os tipos que a IA pode criar via WhatsApp. Vazio = todos permitidos.</p>
          <div class="flex flex-wrap gap-2">
            <label v-for="t in ESTIMATE_TYPES" :key="t.value"
              class="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition-colors"
              :class="config.allowedEstimateTypes.includes(t.value)
                ? 'border-slate-900 bg-slate-50 text-slate-900'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'">
              <input type="checkbox" :value="t.value" v-model="config.allowedEstimateTypes" class="hidden" />
              <span class="text-base">{{ t.icon }}</span>
              <span>{{ t.label }}</span>
            </label>
          </div>
        </div>

        <!-- Produtos específicos -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-medium text-slate-700">Produtos disponíveis</label>
            <div class="flex items-center gap-3 text-[11px]">
              <button @click="selectAllProducts" type="button" class="text-slate-600 hover:text-slate-900 underline">Selecionar todos</button>
              <button @click="config.allowedProductIds = []" type="button" class="text-slate-600 hover:text-slate-900 underline">Limpar</button>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 mb-3">
            Marque os produtos que a IA pode oferecer. <strong class="text-slate-700">Vazio = todos os produtos.</strong>
            Selecionados: <span class="font-mono">{{ config.allowedProductIds.length }}</span> de {{ availableProducts.length }}
          </p>

          <!-- Filtro -->
          <div class="flex gap-2 mb-3">
            <input
              v-model="productFilter"
              type="text"
              placeholder="Filtrar produtos…"
              class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
            />
            <select v-model="categoryFilter"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white">
              <option value="">Todas categorias</option>
              <option v-for="c in availableCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <!-- Lista -->
          <div v-if="productsLoading" class="text-center py-6 text-xs text-slate-400">Carregando produtos…</div>
          <div v-else-if="filteredProducts.length === 0" class="text-center py-6 text-xs text-slate-400">
            {{ availableProducts.length === 0 ? 'Nenhum produto cadastrado.' : 'Nenhum produto bate com o filtro.' }}
          </div>
          <div v-else class="border border-slate-200 rounded-lg max-h-80 overflow-y-auto divide-y divide-slate-100">
            <label v-for="p in filteredProducts" :key="p.id"
              class="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" :value="p.id" v-model="config.allowedProductIds"
                class="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-400" />
              <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-800 truncate">{{ p.name }}</p>
                <p class="text-[11px] text-slate-400 truncate">
                  {{ p.productType?.name || 'Sem categoria' }} · R$ {{ p.unitPrice?.toFixed(2) }}/{{ p.unit }}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </section>
    <!-- (Testar agente e Conexão WhatsApp ficam mais abaixo, ainda dentro do tab whatsapp) -->
    </div>

    <!-- ════════════════════════════════════════════════════════════════ -->
    <!-- TAB: PROMPTS — personas dos agentes ERP e WhatsApp               -->
    <!-- ════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'prompts'" class="space-y-5">
      <!-- ═════════ Dados de negócio expostos pra IA ═════════ -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <h3 class="text-sm font-medium text-slate-900">Dados de negócio</h3>
          <span class="ml-auto text-[11px] text-slate-400">Alimentam variáveis de prompt e a tool <code class="bg-slate-100 px-1 rounded text-[10px]">get_business_info</code></span>
        </header>
        <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Formas de pagamento (chips editáveis) -->
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1.5">Formas de pagamento aceitas <span class="text-slate-400" v-text="' (variável {{paymentMethods}})'"></span></label>
            <div class="flex flex-wrap gap-1.5 mb-2">
              <span v-for="(m, i) in businessData.paymentMethods" :key="m"
                class="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs rounded-full pl-3 pr-1 py-1">
                {{ m }}
                <button @click="removePaymentMethod(i)" type="button"
                  class="text-slate-400 hover:text-rose-500 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-white"
                  title="Remover">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </span>
              <span v-if="!businessData.paymentMethods.length" class="text-[11px] text-slate-400 italic">
                Nenhuma — adicione abaixo.
              </span>
            </div>
            <div class="flex gap-2">
              <input
                v-model="newPaymentMethod"
                @keydown.enter.prevent="addPaymentMethod"
                type="text"
                placeholder="Ex: PIX, Cartão, Dinheiro, Boleto"
                class="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
              />
              <button @click="addPaymentMethod" type="button"
                class="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md transition-colors">
                Adicionar
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Horário de funcionamento <span class="text-slate-400" v-text="' ({{businessHours}})'"></span></label>
            <input
              v-model="businessData.businessHours"
              type="text"
              placeholder="Ex: Segunda a sexta, 9h às 18h"
              class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Prazo padrão (dias) <span class="text-slate-400" v-text="' ({{deliveryDays}})'"></span></label>
            <input
              v-model.number="businessData.defaultDeliveryDays"
              type="number"
              min="0"
              max="60"
              class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
        </div>
      </section>

      <!-- ═════════ Prompts dos agentes ═════════ -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 class="text-sm font-medium text-slate-900">Prompts dos agentes</h3>
          <span class="ml-auto text-[11px] text-slate-400">Personalidade e regras dos dois canais</span>
        </header>

      <div class="p-5 space-y-5">
        <!-- Variáveis disponíveis -->
        <details class="text-xs text-slate-500 -mt-2">
          <summary class="cursor-pointer hover:text-slate-700">Variáveis disponíveis (substituídas em runtime)</summary>
          <div class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono text-[11px]">
            <code v-for="v in PROMPT_VARS" :key="v"
              class="bg-slate-100 px-2 py-1 rounded"
              v-text="v"></code>
          </div>
          <p class="mt-1.5 text-[11px]">Use no prompt — o backend troca pelas infos do tenant antes de mandar pra IA.</p>
        </details>

        <!-- Prompt WhatsApp -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1.5">Prompt do agente WhatsApp (cliente final)</label>
          <textarea
            v-model="config.agentPrompt"
            rows="6"
            placeholder="Você é um atendente educado da nossa gráfica. Cumprimente o cliente, identifique a necessidade dele, ofereça produtos do catálogo, monte orçamento, gere cobrança PIX..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors resize-y font-mono leading-snug"
          ></textarea>
          <p class="text-[11px] text-slate-400 mt-1">Persona "atendente" — usada no canal WhatsApp.</p>
          <label class="flex items-start gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              v-model="config.whatsappPromptStrict"
              class="w-4 h-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-400"
            />
            <span class="text-[11px] text-slate-600 leading-snug">
              <strong class="text-slate-700">Modo prompt completo</strong> — quando ligado, o sistema NÃO apenda mais as REGRAS CRÍTICAS automáticas. Você assume responsabilidade total pelo prompt.
            </span>
          </label>
        </div>

        <!-- Prompt ERP -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1.5">Prompt do agente do chat ERP (operador)</label>
          <textarea
            v-model="config.erpAgentPrompt"
            rows="6"
            placeholder="Você é o assistente operacional do ERP. Ajuda o operador a executar tarefas — buscar pedidos, criar orçamentos, gerar cobranças, conferir KPIs — usando as ferramentas..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors resize-y font-mono leading-snug"
          ></textarea>
          <p class="text-[11px] text-slate-400 mt-1">Persona "mão direita do operador" — usada no widget flutuante. Vazio = usa default do sistema (mapeamento intenção→tool + regras de comportamento).</p>
          <label class="flex items-start gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              v-model="config.erpPromptStrict"
              class="w-4 h-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-400"
            />
            <span class="text-[11px] text-slate-600 leading-snug">
              <strong class="text-slate-700">Modo prompt completo</strong> — quando ligado, o sistema NÃO apenda o mapeamento intenção→tool nem as REGRAS CRÍTICAS. O texto acima vira o system prompt inteiro.
            </span>
          </label>
        </div>
      </div>
      </section>

      <!-- ═════════ Voz da IA (TTS) ═════════ -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
          </svg>
          <h3 class="text-sm font-medium text-slate-900">Voz da IA</h3>
          <span class="ml-auto text-[11px] text-slate-400">Como a IA fala — quando você usa "ler em voz" ou modo voz contínuo</span>
        </header>
        <div class="p-5 space-y-4">
          <!-- 4 providers em grid 2x2 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button" @click="selectTtsProvider('browser')"
              :class="config.ttsProvider === 'browser' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'"
              class="border rounded-xl p-4 text-left transition-colors"
            >
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-base">💻</span>
                <span class="text-sm font-medium text-slate-900">Navegador</span>
                <span class="text-[10px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">grátis</span>
              </div>
              <p class="text-[11px] text-slate-500 leading-snug">Web Speech API. Offline. Voz robótica em alguns SOs.</p>
            </button>

            <button
              type="button" @click="selectTtsProvider('google')"
              :class="config.ttsProvider === 'google' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'"
              class="border rounded-xl p-4 text-left transition-colors"
            >
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-base">🌍</span>
                <span class="text-sm font-medium text-slate-900">Google Cloud</span>
                <span class="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">4M chars FREE/mês</span>
              </div>
              <p class="text-[11px] text-slate-500 leading-snug">Vozes Neural2 pt-BR. Free tier cobre uso normal de ERP.</p>
            </button>

            <button
              type="button" @click="selectTtsProvider('openai')"
              :class="config.ttsProvider === 'openai' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'"
              class="border rounded-xl p-4 text-left transition-colors"
            >
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-base">✨</span>
                <span class="text-sm font-medium text-slate-900">OpenAI</span>
                <span class="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">~R$ 0,08/min</span>
              </div>
              <p class="text-[11px] text-slate-500 leading-snug">Voz natural. Boa relação custo/qualidade. 6 vozes.</p>
            </button>

            <button
              type="button" @click="selectTtsProvider('elevenlabs')"
              :class="config.ttsProvider === 'elevenlabs' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'"
              class="border rounded-xl p-4 text-left transition-colors"
            >
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-base">🎙️</span>
                <span class="text-sm font-medium text-slate-900">ElevenLabs</span>
                <span class="text-[10px] bg-rose-100 text-rose-700 rounded-full px-2 py-0.5">premium · ~R$ 1,30/min</span>
              </div>
              <p class="text-[11px] text-slate-500 leading-snug">Qualidade insuperável. Vozes customizáveis. Free 10k chars/mês.</p>
            </button>
          </div>

          <!-- ───────── OpenAI ───────── -->
          <div v-if="config.ttsProvider === 'openai'" class="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">API Key da OpenAI</label>
              <input v-model="config.openaiTtsKey" type="password" placeholder="sk-…"
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors font-mono" />
              <p class="text-[11px] text-slate-400 mt-1.5">
                Pegue em
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" class="underline hover:text-slate-600">platform.openai.com/api-keys</a>
              </p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Voz</label>
                <select v-model="config.ttsVoice" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 bg-white">
                  <option v-for="o in OPENAI_VOICES" :key="o.v" :value="o.v">{{ o.label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Modelo</label>
                <select v-model="config.ttsModel" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 bg-white">
                  <option value="tts-1">tts-1 (rápido, R$ 0,08/min)</option>
                  <option value="tts-1-hd">tts-1-hd (HD, R$ 0,16/min)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- ───────── ElevenLabs ───────── -->
          <div v-else-if="config.ttsProvider === 'elevenlabs'" class="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">API Key da ElevenLabs</label>
              <input v-model="config.elevenlabsKey" type="password" placeholder="sk_…"
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors font-mono" />
              <p class="text-[11px] text-slate-400 mt-1.5">
                Pegue em
                <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener" class="underline hover:text-slate-600">elevenlabs.io/app/settings/api-keys</a>
              </p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Voz (ID)</label>
                <select v-model="config.ttsVoice" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 bg-white">
                  <option v-for="o in ELEVENLABS_VOICES" :key="o.v" :value="o.v">{{ o.label }}</option>
                </select>
                <p class="text-[11px] text-slate-400 mt-1">
                  Ou cole um voice_id custom em
                  <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noopener" class="underline hover:text-slate-600">voice library</a>
                </p>
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Modelo</label>
                <select v-model="config.ttsModel" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 bg-white">
                  <option value="eleven_multilingual_v2">Multilingual v2 (recomendado pt-BR)</option>
                  <option value="eleven_turbo_v2_5">Turbo v2.5 (mais rápido)</option>
                  <option value="eleven_flash_v2_5">Flash v2.5 (super rápido, qualidade menor)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- ───────── Google Cloud ───────── -->
          <div v-else-if="config.ttsProvider === 'google'" class="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">API Key do Google Cloud</label>
              <input v-model="config.googleTtsKey" type="password" placeholder="AIza…"
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors font-mono" />
              <p class="text-[11px] text-slate-400 mt-1.5">
                Crie em
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" class="underline hover:text-slate-600">console.cloud.google.com</a>
                — habilite a API "Cloud Text-to-Speech" no projeto.
              </p>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Voz</label>
              <select v-model="config.ttsVoice" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 bg-white">
                <option v-for="o in GOOGLE_VOICES" :key="o.v" :value="o.v">{{ o.label }}</option>
              </select>
              <p class="text-[11px] text-slate-400 mt-1">
                Neural2 e Wavenet entram nos 1M chars FREE/mês. Standard são mais baratas mas menos naturais.
              </p>
            </div>
          </div>

          <!-- Botão testar (vale pra todos os providers cloud) -->
          <div v-if="config.ttsProvider !== 'browser'" class="flex items-center gap-2 pt-1">
            <button
              @click="testVoice"
              :disabled="testingVoice ||
                (config.ttsProvider === 'openai'     && !config.openaiTtsKey) ||
                (config.ttsProvider === 'elevenlabs' && !config.elevenlabsKey) ||
                (config.ttsProvider === 'google'     && !config.googleTtsKey)"
              type="button"
              class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-4 py-2 transition-colors"
            >
              <svg v-if="testingVoice" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Testar voz
            </button>
            <span v-if="testVoiceMessage" class="text-[11px]" :class="testVoiceMessage.startsWith('❌') ? 'text-rose-600' : 'text-slate-500'">
              {{ testVoiceMessage }}
            </span>
          </div>
        </div>
      </section>
    </div>

    <!-- ════════════════════════════════════════════════════════════════ -->
    <!-- TAB: COMANDOS — chips do widget chat ERP                         -->
    <!-- ════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'commands'" class="space-y-5">
      <!-- ═════════ Comandos rápidos do widget ═════════ -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <h3 class="text-sm font-medium text-slate-900">Comandos rápidos</h3>
          <span class="text-[11px] text-slate-400 hidden sm:inline">Chips no estado vazio do widget</span>
        </div>
        <button
          @click="addQuickCommand"
          type="button"
          class="text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5 transition-colors"
        >
          + Adicionar
        </button>
      </header>

      <div class="p-5 space-y-2">
        <p v-if="config.quickCommands.length === 0" class="text-xs text-slate-400 text-center py-4">
          Nenhum customizado — o widget usa os defaults do sistema (dashboard, pedidos pendentes, financeiro, etc).
        </p>
        <div v-for="(cmd, i) in config.quickCommands" :key="i"
          class="flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-2">
          <input
            v-model="cmd.icon"
            type="text"
            placeholder="📊"
            maxlength="4"
            class="w-12 text-center text-base bg-transparent border border-transparent hover:border-slate-200 rounded outline-none focus:border-slate-400 px-1 py-1"
          />
          <input
            v-model="cmd.text"
            type="text"
            placeholder="Frase que dispara uma tool (ex: 'Pedidos pendentes hoje')"
            class="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none px-2 py-1"
          />
          <button
            @click="removeQuickCommand(i)"
            type="button"
            class="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-rose-50"
            title="Remover"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
            </svg>
          </button>
        </div>
      </div>
      </section>
    </div>

    <!-- ════════════════════════════════════════════════════════════════ -->
    <!-- TAB: WhatsApp (continuação) — Testar agente + Conexão QR         -->
    <!-- (mesmo v-show da tab whatsapp; aparecem juntos)                   -->
    <!-- ════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'whatsapp'" class="space-y-5">
      <!-- ═════════ Testar agente — preview rápido ═════════ -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 class="text-sm font-medium text-slate-900">Testar agente</h3>
          <span class="ml-auto text-[11px] text-slate-400">Simula uma conversa sem mandar mensagem real</span>
      </header>

      <div class="p-5 space-y-3">
        <!-- Histórico do teste -->
        <div v-if="testMessages.length > 0" class="space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50 max-h-64 overflow-y-auto">
          <div v-for="(m, i) in testMessages" :key="i"
            :class="m.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
            <div :class="m.role === 'user'
                ? 'bg-slate-900 text-white rounded-2xl rounded-br-md'
                : 'bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-bl-md'"
              class="max-w-[80%] px-3 py-1.5 text-xs whitespace-pre-wrap">
              {{ m.text }}
            </div>
          </div>
        </div>

        <!-- Input de teste -->
        <div class="flex gap-2">
          <input
            v-model="testInput"
            @keydown.enter="runTest"
            type="text"
            placeholder="Digite uma mensagem como se fosse o cliente..."
            :disabled="testing"
            class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors disabled:opacity-50"
          />
          <button @click="runTest" :disabled="!testInput.trim() || testing"
            class="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
            <svg v-if="testing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span v-else>Enviar</span>
          </button>
          <button v-if="testMessages.length > 0" @click="resetTest"
            class="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
            Limpar
          </button>
        </div>
        <p class="text-[11px] text-slate-400">⚠️ O preview simula uma conversa real com o agente WhatsApp — usa as mesmas tools e prompt configurados.</p>
      </div>
      </section>

      <!-- ═════════ Conexão WhatsApp ═════════ -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2.5">
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <h3 class="text-sm font-medium text-slate-900">Conexão do WhatsApp</h3>
          </div>

          <div class="flex items-center gap-2 text-xs">
            <span class="w-1.5 h-1.5 rounded-full" :style="{ background: statusDot }"></span>
            <span class="font-medium" :style="{ color: statusColor }">{{ statusLabel }}</span>
          </div>
        </header>

      <div class="p-5">
        <!-- Estado: desconectado / QR pronto / aguardando -->
        <div v-if="isConnected" class="flex flex-col items-center py-8 text-center">
          <div class="w-14 h-14 rounded-full flex items-center justify-center mb-3" style="background: #E1F5EE">
            <svg class="w-7 h-7" fill="none" stroke="#1D9E75" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div class="text-base font-medium text-slate-900 mb-1">WhatsApp conectado</div>
          <p class="text-sm text-slate-500 max-w-sm">Sua instância <strong class="text-slate-700">{{ config.evolutionInstance || '—' }}</strong> está pareada e recebendo mensagens.</p>

          <div class="flex items-center gap-2 mt-5">
            <button
              @click="() => refreshStatus()"
              :disabled="statusLoading"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-full px-4 py-2 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Atualizar
            </button>
            <button
              v-if="perms.can.edit('ai')"
              @click="logout"
              :disabled="actionLoading"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
              style="background: #A32D2D"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              Desconectar
            </button>
          </div>
        </div>

        <div v-else-if="qrBase64" class="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
          <div class="justify-self-center md:justify-self-start">
            <div class="border border-slate-200 rounded-xl p-3 bg-white">
              <img :src="qrBase64" alt="QR Code WhatsApp" class="w-56 h-56 block" />
            </div>
          </div>
          <div>
            <div class="text-base font-medium text-slate-900 mb-2">Escaneie para conectar</div>
            <ol class="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>Abra o WhatsApp no celular</li>
              <li>Toque em <strong>Mais opções</strong> (três pontos) &rarr; <strong>Aparelhos conectados</strong></li>
              <li>Selecione <strong>Conectar um aparelho</strong></li>
              <li>Aponte a câmera para este QR code</li>
            </ol>

            <div class="flex items-center gap-2 text-xs text-slate-400 mt-4">
              <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              Aguardando leitura…
            </div>

            <div class="flex items-center gap-2 mt-4">
              <button
                @click="connect"
                :disabled="actionLoading"
                class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-full px-4 py-2 transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Gerar novo QR code
              </button>
              <button
                @click="cancelConnect"
                class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="statusError" class="flex items-start gap-3 p-4 rounded-lg" style="background: #FCEBEB">
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="#A32D2D" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <div class="min-w-0">
            <div class="text-sm font-medium" style="color: #A32D2D">Erro ao conectar</div>
            <div class="text-sm mt-0.5" style="color: #7f1d1d">{{ statusError }}</div>
            <button @click="connect" class="mt-2 text-sm font-medium underline" style="color: #A32D2D">Tentar novamente</button>
          </div>
        </div>

        <div v-else class="flex flex-col items-center py-8 text-center">
          <div class="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div class="text-base font-medium text-slate-900 mb-1">WhatsApp desconectado</div>
          <p class="text-sm text-slate-500 max-w-sm">
            {{ isConfigured
              ? 'Gere um QR code para parear sua instância com o WhatsApp Business.'
              : 'Preencha URL, instância e API Key acima, salve e então gere o QR code.' }}
          </p>

          <div class="flex items-center gap-2 mt-5">
            <button
              v-if="perms.can.edit('ai')"
              @click="connect"
              :disabled="!isConfigured || actionLoading"
              class="inline-flex items-center gap-1.5 bg-[#1D9E75] hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors"
            >
              <svg v-if="actionLoading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 5a2 2 0 012-2h.01M15.5 3.5L12 7l3.5 3.5M3 12h18"/>
              </svg>
              Gerar QR code
            </button>
            <button
              @click="() => refreshStatus()"
              :disabled="statusLoading"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-full px-4 py-2 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Atualizar status
            </button>
          </div>
        </div>
      </div>
      </section>

      <!-- ═════════ Webhook do Evolution ═════════ -->
      <section class="border border-slate-200 rounded-xl overflow-hidden">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"/>
          </svg>
          <h3 class="text-sm font-medium text-slate-900">Webhook do Evolution</h3>
          <span class="ml-auto text-[11px] text-slate-400">Onde a Evolution chama quando chega mensagem</span>
        </header>

        <div class="p-5 space-y-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">URL do webhook</label>
            <input
              v-model="config.webhookUrl"
              type="text"
              :placeholder="webhookDefault"
              class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors font-mono"
            />
            <p class="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Vazio = usa o default do servidor (<code class="bg-slate-100 px-1 rounded">{{ webhookDefault }}</code>).
              Em desenvolvimento aponte pra um túnel tipo <code class="bg-slate-100 px-1 rounded">ngrok</code> ou Cloudflare Tunnel.
            </p>
          </div>

          <!-- Editor de eventos -->
          <div>
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label class="block text-xs text-slate-500">
                Eventos disparados ({{ config.webhookEvents.length }} de {{ EVOLUTION_EVENTS.length }})
              </label>
              <div class="flex items-center gap-2 text-[11px]">
                <button @click="selectEssentialEvents" type="button" class="text-slate-600 hover:text-slate-900 underline">
                  Só essenciais
                </button>
                <span class="text-slate-300">·</span>
                <button @click="selectAllEvents" type="button" class="text-slate-600 hover:text-slate-900 underline">
                  Marcar todos
                </button>
                <span class="text-slate-300">·</span>
                <button @click="clearEvents" type="button" class="text-slate-600 hover:text-slate-900 underline">
                  Limpar
                </button>
              </div>
            </div>

            <div class="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
              <div v-for="g in EVENT_GROUPS" :key="g.key" class="px-3 py-2.5">
                <div class="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">{{ g.label }}</div>
                <div class="flex flex-wrap gap-1.5">
                  <label v-for="ev in eventsInGroup(g.key)" :key="ev.value"
                    class="inline-flex items-center gap-1.5 cursor-pointer select-none rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                    :class="config.webhookEvents.includes(ev.value)
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'">
                    <input type="checkbox" :checked="config.webhookEvents.includes(ev.value)"
                      @change="toggleEvent(ev.value)"
                      class="hidden" />
                    <span class="font-mono text-[10px]">{{ ev.value }}</span>
                    <span class="text-[10px] opacity-70">— {{ ev.label }}</span>
                  </label>
                </div>
              </div>
            </div>
            <p class="text-[11px] text-slate-400 mt-1.5">
              <strong>MESSAGES_UPSERT</strong> é o único que o nosso webhook processa hoje. Os outros são opcionais (auditoria/debug).
            </p>
          </div>

          <!-- Status atual no Evolution (do que está realmente lá) -->
          <div v-if="webhookStatus" class="text-[11px] rounded-lg p-3" :class="webhookStatus.configured ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'">
            <div class="flex items-start gap-2">
              <svg v-if="webhookStatus.configured" class="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              <svg v-else class="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.667 1.73-3L13.73 4c-.77-1.333-2.69-1.333-3.46 0L3.34 16c-.77 1.333.19 3 1.73 3z"/></svg>
              <div class="min-w-0 flex-1 space-y-0.5">
                <div v-if="webhookStatus.configured">
                  <strong>Configurado na Evolution:</strong>
                  <code class="ml-1 break-all">{{ webhookStatus.remoteUrl || '—' }}</code>
                  <span v-if="!webhookStatus.enabled" class="ml-1 text-amber-700">(desabilitado)</span>
                </div>
                <div v-else>
                  <strong>Não configurado na Evolution.</strong> Clique abaixo pra setar.
                </div>
                <div v-if="webhookMessage" class="mt-1">{{ webhookMessage }}</div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-if="perms.can.edit('ai')"
              @click="saveWebhook"
              :disabled="webhookSaving || !isConfigured"
              type="button"
              class="inline-flex items-center gap-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-4 py-2 transition-colors"
            >
              <svg v-if="webhookSaving" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 12l-4-4-4 4m4-4v12"/></svg>
              Salvar webhook na Evolution
            </button>
            <button
              @click="loadWebhookStatus"
              :disabled="webhookSaving || !isConfigured"
              type="button"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-full px-4 py-2 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Atualizar status
            </button>
          </div>
        </div>
      </section>
    </div>
    <!-- /tab whatsapp -->

    <!-- ════════════════════════════════════════════════════════════════ -->
    <!-- Save bar — sempre visível, em todas as tabs                       -->
    <!-- ════════════════════════════════════════════════════════════════ -->
    <div class="flex items-center justify-end pt-1">
      <button
        v-if="perms.can.edit('ai')"
        @click="saveConfig"
        :disabled="loading"
        class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors"
      >
        <svg v-if="loading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
        </svg>
        Salvar configurações
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { apiFetch } from '../utils/api'
import { useToast } from '@/composables/useToast'
import { usePermissionsStore } from '../stores/permissions'

const { showToast } = useToast()
const perms = usePermissionsStore()

const loading = ref(false)

// ── Tabs ─────────────────────────────────────────────────────────────────
// Mesma convenção das outras telas (ReportsView): icon = `d` do path SVG.
type TabValue = 'ia' | 'whatsapp' | 'prompts' | 'commands'
const activeTab = ref<TabValue>('ia')
const tabs: ReadonlyArray<{ value: TabValue; label: string; icon: string }> = [
  // Lâmpada (mesmo da seção "Inteligência artificial")
  { value: 'ia',       label: 'IA & Modelo',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  // Balão de chat
  { value: 'whatsapp', label: 'WhatsApp',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  // Documento com texto
  { value: 'prompts',  label: 'Prompts',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  // Raio
  { value: 'commands', label: 'Comandos rápidos',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
]

const config = ref({
  enabled: false,
  aiProvider: 'google' as 'google' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'ollama',
  geminiKey: '',
  geminiModel: 'gemini-2.0-flash',
  maxTokens: 1000,
  evolutionUrl: 'https://api.cslsoftwares.com.br',
  evolutionKey: '',
  evolutionInstance: 'gestorprint',
  webhookUrl: '',                        // URL pública do webhook (vazio = default API_URL)
  webhookEvents: ['MESSAGES_UPSERT'] as string[],   // eventos a disparar no webhook
  allowFileUploads: true,
  // Prompts editáveis (em vez de hardcode no service)
  agentPrompt: '',                       // WhatsApp (cliente final)
  erpAgentPrompt: '',                    // Chat ERP (operador)
  // Modo "prompt completo": quando ligado, o backend NÃO apenda
  // REGRAS CRÍTICAS / FERRAMENTAS RECOMENDADAS. Power user controla 100%.
  erpPromptStrict: false,
  whatsappPromptStrict: false,
  quickCommands: [] as Array<{ icon: string; text: string }>,
  // Voz da IA (TTS) — 4 providers possíveis
  ttsProvider: 'browser' as 'browser' | 'openai' | 'elevenlabs' | 'google',
  ttsVoice: 'nova',
  ttsModel: 'tts-1',
  openaiTtsKey: '',
  elevenlabsKey: '',
  googleTtsKey: '',
  // Restrições do agente — controla o que o WhatsApp pode oferecer
  allowedProductIds: [] as number[],
  allowedEstimateTypes: [] as string[],
})

// ── Providers de IA disponíveis (carregado do backend) ─────────────────────
interface ProviderInfo {
  value: 'google' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'ollama'
  label: string
  consoleUrl: string
  models: Array<{ value: string; label: string }>
}
const providers = ref<ProviderInfo[]>([])
const currentProvider = computed(() =>
  providers.value.find(p => p.value === config.value.aiProvider),
)
const currentModels = computed(() => currentProvider.value?.models || [])
// Hostname do console pra mostrar como link bonito ("aistudio.google.com" etc)
const currentProviderHost = computed(() => {
  const url = currentProvider.value?.consoleUrl
  if (!url) return ''
  try { return new URL(url).hostname } catch { return url }
})

// Modo "modelo customizado" — switch pra input livre (em vez do dropdown).
// Útil pro OpenRouter (400+ modelos), Ollama (qualquer modelo local), ou
// quando o provider lança um modelo novo antes da gente atualizar a lista.
const customModelMode = ref(false)

// Placeholder específico por provider — exemplo concreto de ID válido.
const customModelPlaceholder = computed(() => {
  switch (config.value.aiProvider) {
    case 'openrouter': return 'ex: anthropic/claude-3.5-sonnet'
    case 'ollama':     return 'ex: llama3.2 ou mistral:7b'
    case 'google':     return 'ex: gemini-2.0-flash'
    case 'openai':     return 'ex: gpt-4o-mini'
    case 'anthropic':  return 'ex: claude-3-5-sonnet-20241022'
    case 'groq':       return 'ex: llama-3.3-70b-versatile'
    case 'deepseek':   return 'ex: deepseek-chat'
    default:           return 'ID do modelo'
  }
})

async function fetchProviders() {
  try {
    const res = await apiFetch('/api/mcp/providers')
    if (res.ok) {
      const data = await res.json()
      providers.value = data.providers || []
      // Se o modelo salvo não bate com nenhum da lista do provider atual,
      // assume que é customizado e liga o toggle automaticamente.
      autoDetectCustomMode()
    }
  } catch { /* silently fall back to hardcoded if needed */ }
}

function autoDetectCustomMode() {
  const list = providers.value.find(p => p.value === config.value.aiProvider)?.models || []
  if (list.length && config.value.geminiModel &&
      !list.find(m => m.value === config.value.geminiModel)) {
    customModelMode.value = true
  }
}

/** Troca de provider — também ajusta o modelo padrão pra um do provider novo. */
type ProviderValue = 'google' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'ollama'

function selectProvider(value: ProviderValue) {
  if (config.value.aiProvider === value) return
  config.value.aiProvider = value
  // Em modo customizado o user controla o ID — não tocamos.
  if (customModelMode.value) return
  // Se o modelo atual não bate com o provider novo, escolhe o primeiro recomendado.
  // Sem isso o user troca pra OpenAI mas mantém "gemini-2.0-flash" → API devolve 404.
  const newModels = providers.value.find(p => p.value === value)?.models || []
  const firstModel = newModels[0]
  if (firstModel && !newModels.find(m => m.value === config.value.geminiModel)) {
    config.value.geminiModel = firstModel.value
  }
}

const ESTIMATE_TYPES = [
  { value: 'service',    label: 'Serviço',    icon: '🛠️' },
  { value: 'plotter',    label: 'Plotter',    icon: '🖨️' },
  { value: 'cutting',    label: 'Recorte',    icon: '✂️' },
  { value: 'embroidery', label: 'Estamparia', icon: '🧵' },
] as const

// Variáveis substituídas pelo backend no agentPrompt em runtime.
// Declaramos como strings literais no script (não no template) pra não
// confundir o compiler do Vue com as chaves duplas {{...}}.
const PROMPT_VARS = [
  '{{businessName}}',
  '{{address}}',
  '{{phone}}',
  '{{email}}',
  '{{businessHours}}',
  '{{paymentMethods}}',
  '{{deliveryDays}}',
] as const

// Produtos disponíveis pra escolher (carregados sob demanda)
interface ProductLite {
  id: number
  name: string
  unitPrice?: number
  unit?: string
  typeId?: number
  productType?: { id: number; name: string }
}
const availableProducts = ref<ProductLite[]>([])
const productsLoading = ref(false)
const productFilter = ref('')
const categoryFilter = ref<number | ''>('')

const availableCategories = computed(() => {
  const map = new Map<number, string>()
  for (const p of availableProducts.value) {
    if (p.productType?.id && p.productType?.name) {
      map.set(p.productType.id, p.productType.name)
    }
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }))
})

const filteredProducts = computed(() => {
  let list = availableProducts.value
  if (categoryFilter.value !== '') {
    list = list.filter(p => p.typeId === categoryFilter.value)
  }
  if (productFilter.value.trim()) {
    const q = productFilter.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q))
  }
  return list
})

function selectAllProducts() {
  // Une os filtrados aos já selecionados (sem duplicatas) — útil pra "todos da categoria X"
  const ids = new Set([...config.value.allowedProductIds, ...filteredProducts.value.map(p => p.id)])
  config.value.allowedProductIds = [...ids]
}

// ── Comandos rápidos do widget ──────────────────────────────────────────────
function addQuickCommand() {
  config.value.quickCommands.push({ icon: '✨', text: '' })
}
function removeQuickCommand(i: number) {
  config.value.quickCommands.splice(i, 1)
}

// ── Dados de negócio que alimentam {{vars}} dos prompts ────────────────────
// Esses campos vivem em Settings (não AiConfig) — mesmo onde estão CNPJ,
// SMTP, etc. Carregamos separadamente e salvamos via /api/settings.
const businessData = ref({
  paymentMethods: [] as string[],
  businessHours: '',
  defaultDeliveryDays: 5,
})
const newPaymentMethod = ref('')

async function fetchBusinessData() {
  try {
    const res = await apiFetch('/api/settings')
    if (!res.ok) return
    const data = await res.json()
    businessData.value.paymentMethods      = Array.isArray(data.paymentMethods) ? data.paymentMethods : []
    businessData.value.businessHours       = data.businessHours ?? ''
    businessData.value.defaultDeliveryDays = data.defaultDeliveryDays ?? 5
  } catch { /* ignore */ }
}

async function saveBusinessData() {
  // Salva junto com o saveConfig — é silencioso (toast só aparece se algo
  // falhar de forma visível)
  try {
    await apiFetch('/api/settings', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(businessData.value),
    })
  } catch { /* ignore */ }
}

function addPaymentMethod() {
  const v = newPaymentMethod.value.trim()
  if (!v) return
  if (!businessData.value.paymentMethods.includes(v)) {
    businessData.value.paymentMethods.push(v)
  }
  newPaymentMethod.value = ''
}
function removePaymentMethod(i: number) {
  businessData.value.paymentMethods.splice(i, 1)
}

// ── Voz da IA (TTS) ────────────────────────────────────────────────────────

// Defaults sensatos por provider — quando troca, atualiza voice/model.
const TTS_DEFAULTS: Record<string, { voice: string; model: string }> = {
  openai:     { voice: 'nova',                       model: 'tts-1' },
  elevenlabs: { voice: '21m00Tcm4TlvDq8ikWAM',       model: 'eleven_multilingual_v2' }, // Rachel
  google:     { voice: 'pt-BR-Neural2-A',            model: '' },
  browser:    { voice: '',                           model: '' },
}

function selectTtsProvider(p: 'browser' | 'openai' | 'elevenlabs' | 'google') {
  if (config.value.ttsProvider === p) return
  config.value.ttsProvider = p
  const d = TTS_DEFAULTS[p]
  if (!d) return
  config.value.ttsVoice = d.voice
  config.value.ttsModel = d.model
}

// Vozes pré-listadas por provider — só pra dropdown bonito.
const OPENAI_VOICES = [
  { v: 'nova',    label: 'Nova (♀ recomendada)' },
  { v: 'shimmer', label: 'Shimmer (♀ suave)' },
  { v: 'alloy',   label: 'Alloy (neutra)' },
  { v: 'echo',    label: 'Echo (♂)' },
  { v: 'fable',   label: 'Fable (♂ britânica)' },
  { v: 'onyx',    label: 'Onyx (♂ grave)' },
] as const
const ELEVENLABS_VOICES = [
  { v: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (♀ — calma)' },
  { v: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah (♀ — jovem)' },
  { v: 'pFZP5JQG7iQjIQuC4Bku', label: 'Lily (♀ — clara)' },
  { v: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte (♀ — britânica)' },
  { v: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh (♂)' },
  { v: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (♂ — grave)' },
] as const
const GOOGLE_VOICES = [
  { v: 'pt-BR-Neural2-A', label: 'Neural2-A (♀ pt-BR — recomendada)' },
  { v: 'pt-BR-Neural2-C', label: 'Neural2-C (♀ pt-BR)' },
  { v: 'pt-BR-Neural2-B', label: 'Neural2-B (♂ pt-BR)' },
  { v: 'pt-BR-Wavenet-A', label: 'Wavenet-A (♀ pt-BR)' },
  { v: 'pt-BR-Wavenet-C', label: 'Wavenet-C (♀ pt-BR)' },
  { v: 'pt-BR-Wavenet-B', label: 'Wavenet-B (♂ pt-BR)' },
  { v: 'pt-BR-Standard-A', label: 'Standard-A (♀ — mais barata)' },
] as const

const testingVoice = ref(false)
const testVoiceMessage = ref('')

async function testVoice() {
  // Salva config primeiro (key precisa estar encriptada no banco antes do TTS chamar)
  testingVoice.value = true
  testVoiceMessage.value = ''
  try {
    await apiFetch('/api/mcp/config', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ttsProvider:   config.value.ttsProvider,
        ttsVoice:      config.value.ttsVoice,
        ttsModel:      config.value.ttsModel,
        openaiTtsKey:  config.value.openaiTtsKey,
        elevenlabsKey: config.value.elevenlabsKey,
        googleTtsKey:  config.value.googleTtsKey,
      }),
    })

    const providerLabel = {
      openai:     'OpenAI',
      elevenlabs: 'ElevenLabs',
      google:     'Google Cloud',
      browser:    'navegador',
    }[config.value.ttsProvider]
    const sample = `Oi! Sou a assistente do ERP usando a voz ${providerLabel}. Bem mais natural, né?`

    const res = await apiFetch('/api/ai-chat/tts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: sample }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      testVoiceMessage.value = `❌ ${errBody.message || `HTTP ${res.status}`}`
      return
    }
    const blob = await res.blob()
    const audio = new Audio(URL.createObjectURL(blob))
    audio.onerror = () => { testVoiceMessage.value = '❌ Erro ao tocar áudio.' }
    await audio.play()
    testVoiceMessage.value = '✅ Funcionando!'
  } catch (e: any) {
    testVoiceMessage.value = `❌ ${e?.message || 'Falha desconhecida'}`
  } finally {
    testingVoice.value = false
  }
}

// ── Testar agente — preview de conversa ─────────────────────────────────────
const testInput    = ref('')
const testing      = ref(false)
const testMessages = ref<Array<{ role: 'user' | 'assistant'; text: string }>>([])
const TEST_SESSION = 'aiview-test'

async function runTest() {
  const text = testInput.value.trim()
  if (!text || testing.value) return
  testMessages.value.push({ role: 'user', text })
  testInput.value = ''
  testing.value = true

  try {
    // Preview agora é in-process no backend (não precisa mais de ai-agent rodando)
    const res = await apiFetch('/api/whatsapp/preview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId: TEST_SESSION, message: text }),
    })
    const data = await res.json()
    testMessages.value.push({
      role: 'assistant',
      text: data.response || '(sem resposta — verifique a configuração da IA)',
    })
  } catch (e: any) {
    testMessages.value.push({
      role: 'assistant',
      text: `❌ ${e.message || 'Falha de comunicação'}`,
    })
  } finally {
    testing.value = false
  }
}

async function resetTest() {
  try {
    await apiFetch('/api/whatsapp/preview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId: TEST_SESSION, reset: true }),
    })
  } catch { /* ignore */ }
  testMessages.value = []
}

async function fetchProducts() {
  productsLoading.value = true
  try {
    // PaginationDto usa `limit` (não `pageSize`) e ValidationPipe rejeita
    // qualquer outro nome com forbidNonWhitelisted. Max permitido = 500.
    const res = await apiFetch('/api/products?limit=500')
    if (res.ok) {
      const data = await res.json()
      availableProducts.value = Array.isArray(data) ? data : (data.data || [])
    }
  } finally {
    productsLoading.value = false
  }
}

// ── Estado da conexão Evolution ─────────────────────────────────────────────
const state = ref<string>('unknown')
const statusError = ref<string>('')
const qrBase64 = ref<string>('')
const statusLoading = ref(false)
const actionLoading = ref(false)
let pollTimer: number | null = null

const isConfigured = computed(() =>
  !!(config.value.evolutionUrl && config.value.evolutionKey && config.value.evolutionInstance),
)
const isConnected = computed(() => state.value === 'open' || state.value === 'connected')

const statusLabel = computed(() => {
  switch (state.value) {
    case 'open':
    case 'connected': return 'Conectado'
    case 'connecting': return 'Conectando…'
    case 'close': return 'Desconectado'
    case 'not_created': return 'Instância não criada'
    case 'unconfigured': return 'Não configurado'
    case 'error': return 'Erro'
    default: return 'Desconhecido'
  }
})

const statusColor = computed(() => {
  if (isConnected.value) return '#1D9E75'
  if (state.value === 'connecting') return '#BA7517'
  if (state.value === 'error') return '#A32D2D'
  return '#64748B'
})

const statusDot = computed(() => statusColor.value)

// ── API calls ──────────────────────────────────────────────────────────────
async function fetchConfig() {
  try {
    const res = await apiFetch('/api/mcp/config')
    if (res.ok) {
      const data = await res.json()
      config.value = {
        enabled:              data.enabled ?? false,
        aiProvider:           (data.aiProvider as any) ?? 'google',
        geminiKey:            data.geminiKey ?? '',
        geminiModel:          data.geminiModel ?? 'gemini-2.0-flash',
        maxTokens:            data.maxTokens ?? 1000,
        evolutionUrl:         data.evolutionUrl ?? 'https://api.cslsoftwares.com.br',
        evolutionKey:         data.evolutionKey ?? '',
        evolutionInstance:    data.evolutionInstance ?? 'gestorprint',
        webhookUrl:           data.webhookUrl ?? '',
        webhookEvents:        Array.isArray(data.webhookEvents) && data.webhookEvents.length
          ? data.webhookEvents
          : ['MESSAGES_UPSERT'],
        allowFileUploads:     data.allowFileUploads ?? true,
        agentPrompt:          data.agentPrompt ?? '',
        erpAgentPrompt:       data.erpAgentPrompt ?? '',
        erpPromptStrict:      !!data.erpPromptStrict,
        whatsappPromptStrict: !!data.whatsappPromptStrict,
        quickCommands:        Array.isArray(data.quickCommands) ? data.quickCommands : [],
        ttsProvider:          (data.ttsProvider as any) ?? 'browser',
        ttsVoice:             data.ttsVoice ?? 'nova',
        ttsModel:             data.ttsModel ?? 'tts-1',
        openaiTtsKey:         data.openaiTtsKey ?? '',
        elevenlabsKey:        data.elevenlabsKey ?? '',
        googleTtsKey:         data.googleTtsKey ?? '',
        allowedProductIds:    Array.isArray(data.allowedProductIds) ? data.allowedProductIds : [],
        allowedEstimateTypes: Array.isArray(data.allowedEstimateTypes) ? data.allowedEstimateTypes : [],
      }
    }
  } catch {}
}

async function saveConfig() {
  loading.value = true
  try {
    // Salva AiConfig + dados de negócio em paralelo (vão pra tabelas distintas)
    const [cfgRes] = await Promise.all([
      apiFetch('/api/mcp/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.value),
      }),
      saveBusinessData(),
    ])
    if (cfgRes.ok) {
      showToast('Configurações salvas com sucesso!', 'success')
      refreshStatus()
    } else {
      showToast('Erro ao salvar configurações.', 'error')
    }
  } finally {
    loading.value = false
  }
}

// ── Webhook do Evolution ───────────────────────────────────────────────────
// Default que o backend usa quando o admin não preenche webhookUrl.
// Refletido aqui só pra mostrar como placeholder/dica na UI.
const apiBase = (import.meta as any).env?.VITE_API_URL || window.location.origin
const webhookDefault = computed(() => {
  const base = String(apiBase).replace(/\/$/, '')
  return base.endsWith('/api') ? `${base}/whatsapp/webhook` : `${base}/api/whatsapp/webhook`
})

interface WebhookStatus {
  configured: boolean
  localUrl?:  string
  remoteUrl?: string | null
  enabled?:   boolean
  events?:    string[]
}
const webhookStatus  = ref<WebhookStatus | null>(null)
const webhookSaving  = ref(false)
const webhookMessage = ref('')

async function loadWebhookStatus() {
  if (!isConfigured.value) return
  try {
    const res = await apiFetch('/api/mcp/evolution/webhook')
    if (res.ok) webhookStatus.value = await res.json()
  } catch { /* ignore */ }
}

// Catálogo de eventos da Evolution API — agrupados pra UX.
// "essential" são os que o nosso handler realmente processa hoje.
const EVOLUTION_EVENTS: ReadonlyArray<{ value: string; label: string; group: 'essential' | 'connection' | 'messages' | 'contacts' | 'chats' | 'groups' | 'misc' }> = [
  { value: 'MESSAGES_UPSERT',           label: 'Mensagem recebida',          group: 'essential' },
  { value: 'CONNECTION_UPDATE',         label: 'Conexão atualizada',         group: 'essential' },
  { value: 'APPLICATION_STARTUP',       label: 'Startup da aplicação',       group: 'connection' },
  { value: 'QRCODE_UPDATED',            label: 'QR code atualizado',         group: 'connection' },
  { value: 'MESSAGES_SET',              label: 'Mensagens setadas (sync)',   group: 'messages' },
  { value: 'MESSAGES_UPDATE',           label: 'Mensagem editada',           group: 'messages' },
  { value: 'MESSAGES_DELETE',           label: 'Mensagem deletada',          group: 'messages' },
  { value: 'SEND_MESSAGE',              label: 'Mensagem enviada',           group: 'messages' },
  { value: 'CONTACTS_SET',              label: 'Contatos setados',           group: 'contacts' },
  { value: 'CONTACTS_UPSERT',           label: 'Contato criado/atualizado',  group: 'contacts' },
  { value: 'CONTACTS_UPDATE',           label: 'Contato editado',            group: 'contacts' },
  { value: 'PRESENCE_UPDATE',           label: 'Presença atualizada',        group: 'contacts' },
  { value: 'CHATS_SET',                 label: 'Chats setados',              group: 'chats' },
  { value: 'CHATS_UPSERT',              label: 'Chat criado',                group: 'chats' },
  { value: 'CHATS_UPDATE',              label: 'Chat atualizado',            group: 'chats' },
  { value: 'CHATS_DELETE',              label: 'Chat deletado',              group: 'chats' },
  { value: 'GROUPS_UPSERT',             label: 'Grupo criado',               group: 'groups' },
  { value: 'GROUP_UPDATE',              label: 'Grupo atualizado',           group: 'groups' },
  { value: 'GROUP_PARTICIPANTS_UPDATE', label: 'Participantes do grupo',     group: 'groups' },
  { value: 'LABELS_EDIT',               label: 'Etiqueta editada',           group: 'misc' },
  { value: 'LABELS_ASSOCIATION',        label: 'Etiqueta associada',         group: 'misc' },
  { value: 'CALL',                      label: 'Chamada',                    group: 'misc' },
  { value: 'TYPEBOT_START',             label: 'Typebot iniciado',           group: 'misc' },
  { value: 'TYPEBOT_CHANGE_STATUS',     label: 'Typebot mudou status',       group: 'misc' },
] as const

const EVENT_GROUPS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'essential',  label: 'Essenciais' },
  { key: 'connection', label: 'Conexão' },
  { key: 'messages',   label: 'Mensagens' },
  { key: 'contacts',   label: 'Contatos' },
  { key: 'chats',      label: 'Chats' },
  { key: 'groups',     label: 'Grupos' },
  { key: 'misc',       label: 'Outros' },
]

function eventsInGroup(group: string) {
  return EVOLUTION_EVENTS.filter(e => e.group === group)
}

function toggleEvent(value: string) {
  const arr = config.value.webhookEvents
  const i = arr.indexOf(value)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(value)
}

function selectEssentialEvents() {
  config.value.webhookEvents = EVOLUTION_EVENTS.filter(e => e.group === 'essential').map(e => e.value)
}
function selectAllEvents() {
  config.value.webhookEvents = EVOLUTION_EVENTS.map(e => e.value)
}
function clearEvents() {
  config.value.webhookEvents = []
}

async function saveWebhook() {
  webhookSaving.value = true
  webhookMessage.value = ''
  try {
    // Salva config primeiro pra persistir webhookUrl + events no AiConfig
    await apiFetch('/api/mcp/config', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        webhookUrl:    config.value.webhookUrl || null,
        webhookEvents: config.value.webhookEvents,
      }),
    })
    // Aplica no Evolution
    const res = await apiFetch('/api/mcp/evolution/webhook', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        url:    config.value.webhookUrl?.trim() || undefined,
        events: config.value.webhookEvents,
      }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      webhookMessage.value = `✅ ${data.message || 'Webhook configurado.'}`
      showToast('Webhook salvo na Evolution!', 'success')
      await loadWebhookStatus()
    } else {
      webhookMessage.value = `❌ ${data.error || `HTTP ${res.status}`}`
      showToast(data.error || 'Falha ao configurar webhook.', 'error')
    }
  } catch (e: any) {
    webhookMessage.value = `❌ ${e?.message || 'Erro inesperado'}`
  } finally {
    webhookSaving.value = false
  }
}

async function refreshStatus(silent = false) {
  if (!silent) statusLoading.value = true
  try {
    const res = await apiFetch('/api/mcp/evolution/status')
    if (res.ok) {
      const data = await res.json()
      state.value = data.state || 'unknown'
      statusError.value = data.error || ''
      if (isConnected.value) {
        if (qrBase64.value) {
          qrBase64.value = ''
          showToast('WhatsApp conectado com sucesso!', 'success')
        }
        stopPolling()
      }
    }
  } finally {
    if (!silent) statusLoading.value = false
  }
}

async function connect() {
  actionLoading.value = true
  statusError.value = ''
  try {
    const res = await apiFetch('/api/mcp/evolution/connect', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok !== false && data.base64) {
      qrBase64.value = data.base64
      state.value = 'connecting'
      startPolling()
    } else {
      statusError.value = data.error || data.message || 'Falha ao gerar QR code.'
      state.value = 'error'
      showToast(statusError.value, 'error')
    }
  } catch (e: any) {
    statusError.value = e.message || 'Falha de comunicação com o servidor.'
  } finally {
    actionLoading.value = false
  }
}

async function logout() {
  if (!confirm('Desconectar a instância do WhatsApp?')) return
  actionLoading.value = true
  try {
    const res = await apiFetch('/api/mcp/evolution/logout', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok !== false) {
      showToast('Instância desconectada.', 'success')
      state.value = 'close'
      qrBase64.value = ''
    } else {
      showToast(data.error || 'Falha ao desconectar.', 'error')
    }
  } finally {
    actionLoading.value = false
    refreshStatus(true)
  }
}

function cancelConnect() {
  qrBase64.value = ''
  stopPolling()
  refreshStatus()
}

function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(() => refreshStatus(true), 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  await Promise.all([fetchConfig(), fetchProducts(), fetchProviders(), fetchBusinessData()])
  refreshStatus()
  // Carrega webhook depois (precisa do isConfigured já populado)
  void loadWebhookStatus()
})

onBeforeUnmount(() => stopPolling())
</script>
