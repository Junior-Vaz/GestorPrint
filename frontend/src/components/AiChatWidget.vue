<!--
  AiChatWidget — chat IA do ERP, estilo Claude.

  Recursos:
   - Streaming via SSE (vê tokens aparecendo em tempo real)
   - Markdown rendering (listas, bold, code, links) + sanitização DOMPurify
   - Indicador de tool em execução ("🔍 Buscando produtos...")
   - Comandos rápidos no estado vazio
   - Auto-scroll inteligente (não pula se você rolou pra ler algo)
   - Copy button + feedback 👍/👎 ao passar mouse
   - Atalho global Ctrl+/ (ou Cmd+/) pra abrir/fechar
   - Múltiplas conversas (sidebar com lista de sessões)

  Backend: POST /api/ai-chat/{message,message/stream,reset,sessions,...}
-->
<template>
  <div
    ref="containerEl"
    class="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 select-none"
    :class="[
      'flex flex-col items-stretch gap-3',
      isOpen ? 'w-[720px] max-w-[calc(100vw-2rem)]' : (isHovered ? 'w-[520px]' : 'w-[420px]'),
      'transition-[width] duration-300 ease-out',
    ]"
    @mouseenter="onHover(true)"
    @mouseleave="onHover(false)"
    @keydown.esc="closeChat"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- Overlay de drag-and-drop (cobre o widget inteiro durante drag) -->
    <Transition name="fade">
      <div
        v-if="dragOver"
        class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm pointer-events-none flex items-center justify-center"
      >
        <div class="bg-white border-2 border-dashed border-slate-400 rounded-2xl px-8 py-6 text-center shadow-2xl">
          <svg class="w-10 h-10 mx-auto text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          <div class="text-sm font-medium text-slate-800">Solte aqui pra anexar</div>
          <div class="text-xs text-slate-500 mt-1">Imagem ou PDF · até 10 MB</div>
        </div>
      </div>
    </Transition>
    <!-- ═══════ Painel principal (visível apenas quando aberto) ═══════ -->
    <Transition name="slide-up">
      <div
        v-if="isOpen"
        class="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex max-h-[calc(100vh-160px)] min-h-[320px]"
      >
        <!-- ─── Sidebar de sessões (colapsável) ───────────────────────── -->
        <aside
          v-if="showSessions"
          class="w-52 shrink-0 border-r border-slate-100 flex flex-col bg-slate-50/60"
        >
          <div class="px-3 py-3 border-b border-slate-100 flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Conversas</span>
            <button
              @click="newSession"
              class="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200/60"
              title="Nova conversa"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto py-1">
            <div v-if="sessions.length === 0" class="px-3 py-4 text-[11px] text-slate-400 text-center">
              Nenhuma conversa ainda.
            </div>
            <div
              v-for="s in sessions" :key="s.id"
              @click="switchSession(s.id)"
              :class="s.id === sessionId ? 'bg-slate-200/70 text-slate-900' : 'text-slate-600 hover:bg-slate-100'"
              class="group px-3 py-2 text-xs cursor-pointer flex items-center gap-2"
            >
              <span class="flex-1 truncate" :title="s.title">{{ s.title }}</span>
              <button
                @click.stop="deleteSession(s.id)"
                class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
                title="Apagar conversa"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
              </button>
            </div>
          </div>
        </aside>

        <!-- ─── Coluna principal ──────────────────────────────────────── -->
        <div class="flex-1 flex flex-col min-w-0">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <button
                @click="showSessions = !showSessions"
                class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700 shrink-0"
                :title="showSessions ? 'Ocultar conversas' : 'Mostrar conversas'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <div class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
              <span class="text-sm font-medium text-slate-700 truncate">{{ currentSessionTitle }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                v-if="messages.length > 0"
                @click="exportConversation"
                class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700"
                title="Exportar conversa (markdown)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              </button>
              <button
                v-if="messages.length > 0"
                @click="resetChat"
                class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700"
                title="Limpar mensagens"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
              <button
                @click="closeChat"
                class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700"
                title="Minimizar (Esc)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
            </div>
          </div>

          <!-- Mensagens -->
          <div
            ref="messagesEl"
            class="flex-1 overflow-y-auto px-5 py-4 space-y-4"
            @scroll="onMessagesScroll"
          >
            <!-- Empty state com comandos rápidos -->
            <div v-if="messages.length === 0 && !streaming" class="py-6 text-center">
              <p class="text-base font-medium text-slate-800 mb-1">Como posso ajudar?</p>
              <p class="text-xs text-slate-500 mb-5">
                Posso buscar pedidos, criar orçamentos, gerar PIX, consultar status…
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                <button
                  v-for="s in quickCommands" :key="s.text"
                  @click="sendSuggestion(s.text)"
                  class="text-left text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 transition-colors group flex items-start gap-2"
                >
                  <span class="text-base shrink-0">{{ s.icon }}</span>
                  <span class="leading-snug">{{ s.text }}</span>
                </button>
              </div>
              <p class="text-[10px] text-slate-400 mt-5">
                Atalho: <kbd class="px-1.5 py-0.5 border border-slate-200 rounded bg-white font-mono">{{ shortcutLabel }}</kbd> abre/fecha
              </p>
            </div>

            <!-- Mensagens em sequência -->
            <div v-for="(m, i) in messages" :key="m.id ?? `tmp-${i}`">
              <!-- User: alinhado à direita, fundo escuro -->
              <div v-if="m.role === 'user'" class="flex justify-end group">
                <!-- Botão editar (aparece no hover, só na última msg do user) -->
                <div v-if="canEditMessage(i)" class="flex items-end pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    @click="startEdit(m, i)"
                    class="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                    title="Editar e reenviar"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                </div>
                <div class="max-w-[85%] bg-slate-900 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
                  {{ m.text }}
                </div>
              </div>

              <!-- Assistant: largura cheia, markdown renderizado, ações no hover -->
              <div v-else class="flex gap-3 group">
                <div class="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0 mt-0.5">
                  <span class="text-white text-[11px] font-semibold">AI</span>
                </div>
                <div class="flex-1 min-w-0 pt-0.5">
                  <!-- Chips de tools usadas (se houver) -->
                  <div v-if="m.tools && m.tools.length" class="flex flex-wrap gap-1.5 mb-2">
                    <span v-for="(t, ti) in m.tools" :key="ti"
                      class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border"
                      :class="t.ok === false
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'">
                      <span>{{ t.ok === false ? '⚠' : '✓' }}</span>
                      <span>{{ t.name }}</span>
                    </span>
                  </div>

                  <!-- Markdown sanitizado -->
                  <div
                    class="ai-md text-sm text-slate-800 break-words"
                    v-html="renderMarkdown(m.text)"
                  ></div>

                  <!-- Próximas ações sugeridas pela IA -->
                  <div v-if="m.suggestions && m.suggestions.length" class="flex flex-wrap gap-1.5 mt-2">
                    <button
                      v-for="(s, si) in m.suggestions" :key="si"
                      @click="useSuggestion(s)"
                      type="button"
                      class="text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-full px-3 py-1 transition-colors"
                    >
                      → {{ s }}
                    </button>
                  </div>

                  <!-- Ações: copiar + ler em voz + feedback (hover) -->
                  <div class="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      @click="copyMessage(m.text)"
                      class="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                      title="Copiar resposta"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                    </button>
                    <button
                      v-if="ttsSupported"
                      @click="toggleTts(m.text)"
                      :class="speakingText === m.text ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'"
                      class="p-1 rounded hover:bg-slate-100"
                      :title="speakingText === m.text ? 'Parar leitura' : 'Ler em voz alta'"
                    >
                      <svg v-if="speakingText !== m.text" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                      <svg v-else class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>
                    </button>
                    <button
                      v-if="m.id"
                      @click="setFeedback(m, 1)"
                      :class="m.feedback === 1 ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-600'"
                      class="p-1 rounded hover:bg-slate-100"
                      title="Resposta útil"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/></svg>
                    </button>
                    <button
                      v-if="m.id"
                      @click="setFeedback(m, -1)"
                      :class="m.feedback === -1 ? 'text-rose-600' : 'text-slate-400 hover:text-rose-600'"
                      class="p-1 rounded hover:bg-slate-100"
                      title="Resposta ruim"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Resposta em streaming (parcial — antes do "done") -->
            <div v-if="streaming" class="flex gap-3">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0 mt-0.5">
                <span class="text-white text-[11px] font-semibold">AI</span>
              </div>
              <div class="flex-1 min-w-0 pt-0.5">
                <!-- Chips de tools em execução -->
                <div v-if="liveTools.length" class="flex flex-wrap gap-1.5 mb-2">
                  <span v-for="(t, ti) in liveTools" :key="ti"
                    class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border"
                    :class="t.status === 'running'
                      ? 'bg-amber-50 border-amber-200 text-amber-800 animate-pulse'
                      : t.status === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'">
                    <svg v-if="t.status === 'running'" class="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    <span v-else>{{ t.status === 'error' ? '⚠' : '✓' }}</span>
                    <span>{{ t.name }}</span>
                  </span>
                </div>

                <!-- Texto parcial -->
                <div v-if="partialText"
                  class="ai-md text-sm text-slate-800 break-words"
                  v-html="renderMarkdown(partialText)"
                ></div>

                <!-- Dots enquanto não tem texto ainda -->
                <div v-else-if="liveTools.length === 0" class="flex gap-1 items-center pt-2">
                  <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                  <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                  <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Botão "voltar pro fim" (aparece se o user rolou pra cima) -->
          <button
            v-if="!isAtBottom"
            @click="scrollToBottom(true)"
            class="absolute bottom-20 right-6 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md text-slate-600 hover:bg-slate-50 flex items-center justify-center"
            title="Ir pro fim"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- ═══════ Modo voz contínuo (substitui o input quando ativo) ═══════ -->
    <Transition name="slide-up">
      <div
        v-if="voiceMode"
        class="bg-white border border-slate-200 rounded-3xl shadow-2xl px-6 py-5 flex flex-col items-center gap-3"
      >
        <!-- Orbe animada (cor muda por estado) -->
        <div class="relative w-24 h-24 flex items-center justify-center">
          <div
            :class="[
              'absolute inset-0 rounded-full transition-all duration-500',
              voiceState === 'listening'  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
              voiceState === 'processing' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
              voiceState === 'speaking'   ? 'bg-gradient-to-br from-blue-400 to-purple-500' :
                                            'bg-gradient-to-br from-slate-300 to-slate-400',
              voiceState !== 'idle' ? 'animate-orb-pulse' : '',
            ]"
          ></div>
          <div class="absolute inset-3 rounded-full bg-white/30 backdrop-blur-md"></div>
          <!-- Ícone central -->
          <svg
            v-if="voiceState === 'listening'"
            class="relative w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z"/>
          </svg>
          <svg
            v-else-if="voiceState === 'processing'"
            class="relative w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <svg
            v-else-if="voiceState === 'speaking'"
            class="relative w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
          </svg>
        </div>

        <!-- Status -->
        <div class="text-sm font-medium text-slate-800">{{ voiceStatusLabel }}</div>

        <!-- Transcrição em tempo real (enquanto escuta) -->
        <div
          v-if="voiceState === 'listening' && voiceTranscript"
          class="text-xs text-slate-500 italic max-w-md text-center px-4"
        >
          "{{ voiceTranscript }}"
        </div>

        <!-- Dica -->
        <p v-else class="text-[11px] text-slate-400 text-center max-w-xs">
          {{ voiceState === 'listening'
              ? 'Pode falar — paro automático no silêncio.'
              : voiceState === 'processing'
                ? 'Buscando informações no sistema…'
                : voiceState === 'speaking'
                  ? 'Vou ouvir você de novo quando terminar.'
                  : 'Iniciando…' }}
        </p>

        <button
          @click="exitVoiceMode" type="button"
          class="mt-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-1.5 transition-colors"
        >
          Sair do modo voz (Esc)
        </button>
      </div>
    </Transition>

    <!-- ═══════ Menu de slash commands (acima da pílula) ═══════ -->
    <Transition name="slide-up">
      <div
        v-if="showSlashMenu && !voiceMode"
        class="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto"
      >
        <div class="px-3 py-2 border-b border-slate-100 text-[10px] uppercase tracking-wide font-semibold text-slate-500">
          Comandos rápidos · ↑↓ pra navegar · Enter pra usar
        </div>
        <button
          v-for="(c, i) in filteredSlashCommands" :key="c.cmd"
          type="button"
          @click="applySlashCommand(c)"
          @mouseenter="slashIndex = i"
          :class="i === slashIndex ? 'bg-slate-100' : 'hover:bg-slate-50'"
          class="w-full px-3 py-2 text-left flex items-center gap-3 text-sm transition-colors"
        >
          <span class="font-mono text-xs text-slate-500 w-28 truncate">{{ c.cmd }}</span>
          <span class="flex-1 text-slate-700 truncate">{{ c.label }}</span>
        </button>
      </div>
    </Transition>

    <!-- ═══════ Pill de input (sempre visível quando NÃO está em voice mode) ═══════ -->
    <div v-show="!voiceMode" class="flex flex-col items-stretch gap-1.5">
      <!-- Chip de anexo selecionado (acima do input) -->
      <div v-if="attachment" class="self-start max-w-full ml-3 inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full pl-2.5 pr-1 py-1 text-xs text-slate-700">
        <svg class="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
        <span class="truncate max-w-[200px]">{{ attachment.filename }}</span>
        <span class="text-slate-400">{{ formatBytes(attachment.size) }}</span>
        <button
          @click="clearAttachment" type="button"
          class="text-slate-400 hover:text-rose-500 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-white"
          title="Remover anexo"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <form
        @submit.prevent="send"
        :class="[
          'bg-white border border-slate-200 shadow-lg flex items-end gap-2 pl-5 pr-2 py-2 transition-all duration-200',
          // textarea cresce: rounded-full quando 1 linha, rounded-3xl quando expande
          isMultiline ? 'rounded-3xl' : 'rounded-full',
          isOpen
            ? 'shadow-2xl ring-1 ring-slate-900/5'
            : (isHovered
              ? 'shadow-xl border-slate-300 ring-2 ring-slate-900/5'
              : 'shadow-md hover:shadow-lg'),
        ]"
        @click="openChat"
      >
        <!-- Ícone (alinha pelo bottom pra ficar bonito quando textarea cresce) -->
        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0 self-end mb-1">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
        </div>

        <textarea
          ref="inputEl"
          v-model="input"
          @focus="openChat"
          @keydown="onInputKeydown"
          @input="autoResizeInput"
          :disabled="streaming"
          rows="1"
          :placeholder="isOpen ? (recording ? 'Gravando…' : 'Digite sua mensagem… (Shift+Enter quebra linha)') : 'Pergunte ao assistente do ERP…'"
          class="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400 disabled:opacity-50 resize-none py-1 leading-relaxed max-h-32 overflow-y-auto"
        ></textarea>

        <span
          v-if="hasUnread && !isOpen"
          class="w-2 h-2 bg-emerald-500 rounded-full"
          title="Nova resposta"
        ></span>

        <!-- Botão anexar -->
        <button
          v-show="isOpen && !streaming"
          type="button" @click.stop="pickFile"
          class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center shrink-0 transition-colors"
          title="Anexar arquivo (imagem ou PDF)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
          </svg>
        </button>
        <input
          ref="fileInputEl" type="file" class="hidden"
          accept="image/*,application/pdf"
          @change="onFileSelected"
        />

        <!-- Botão microfone (single-shot — fala 1x e pra) -->
        <button
          v-show="isOpen && !streaming && speechSupported"
          type="button" @click.stop="toggleRecording"
          :class="recording
            ? 'bg-rose-100 text-rose-600 animate-pulse'
            : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'"
          class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
          :title="recording ? 'Parar gravação' : 'Ditar mensagem'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z"/>
          </svg>
        </button>

        <!-- Botão modo voz contínuo (hands-free, conversa por voz) -->
        <button
          v-show="isOpen && !streaming && speechSupported && ttsSupported"
          type="button" @click.stop="enterVoiceMode"
          class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center shrink-0 transition-colors"
          title="Modo voz contínuo (hands-free)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
        </button>

        <!-- Botão enviar / parar -->
        <button
          v-if="streaming"
          type="button"
          @click="abortStream"
          class="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 transition-all"
          title="Parar"
        >
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>
        </button>
        <button
          v-else
          type="submit"
          :disabled="!input.trim() && !attachment"
          class="self-end w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95"
          title="Enviar (Enter · Shift+Enter quebra linha)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
        </button>
      </form>

      <!-- Chip de uso (tokens da sessão) -->
      <div
        v-if="isOpen && totalTokens > 0"
        class="self-center text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5"
        :title="`${totalTokens} tokens consumidos nesta sessão`"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M8 12h8M8 9h8M8 15h6"/></svg>
        <span>{{ formatTokens(totalTokens) }} tokens</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { apiFetch } from '../utils/api'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface ToolUse {
  name: string
  status?: 'running' | 'done' | 'error'
  ok?: boolean
}
interface Message {
  id?: number
  role: 'user' | 'assistant'
  text: string
  feedback?: 1 | -1 | null
  tools?: ToolUse[]
  suggestions?: string[]   // próximas ações extraídas do <!--suggestions:[...]-->
}

// Regex de extração — uso global pra remover do texto renderizado
const SUGGESTIONS_RE = /<!--\s*suggestions\s*:\s*(\[[\s\S]*?\])\s*-->/i

function extractSuggestions(text: string): { clean: string; suggestions?: string[] } {
  const m = text.match(SUGGESTIONS_RE)
  if (!m || !m[1]) return { clean: text }
  try {
    const arr = JSON.parse(m[1])
    if (!Array.isArray(arr)) return { clean: text }
    const sugs = arr.filter(s => typeof s === 'string' && s.trim()).slice(0, 4)
    return {
      clean:       text.replace(SUGGESTIONS_RE, '').trim(),
      suggestions: sugs.length ? sugs : undefined,
    }
  } catch {
    return { clean: text }
  }
}
interface Session {
  id: string
  title: string
  lastActivity?: string
}

// ── Configuração do marked ─────────────────────────────────────────────────
// breaks: \n vira <br> sem precisar de double-space
// gfm: tabelas, autolinks, strikethrough
marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text: string): string {
  const raw = marked.parse(text || '', { async: false }) as string
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'kbd', 'blockquote',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
  })
}

// ── Estado ─────────────────────────────────────────────────────────────────
const isOpen        = ref(false)
const isHovered     = ref(false)
const input         = ref('')
const messages      = ref<Message[]>([])
const streaming     = ref(false)
const partialText   = ref('')
const liveTools     = ref<ToolUse[]>([])
const hasUnread     = ref(false)
const sessions      = ref<Session[]>([])
const showSessions  = ref(false)
const sessionId     = ref<string>('erp-widget')
const isAtBottom    = ref(true)

const containerEl  = ref<HTMLElement | null>(null)
const messagesEl   = ref<HTMLElement | null>(null)
const inputEl      = ref<HTMLTextAreaElement | null>(null)
const fileInputEl  = ref<HTMLInputElement | null>(null)

let abortController: AbortController | null = null

// ── Token / cost tracking ──────────────────────────────────────────────────
// Acumula uso (input+output tokens) por sessão. Backend manda no evento 'done'.
const totalTokens = ref(0)
function addUsage(usage: any) {
  if (!usage) return
  // AI SDK manda { promptTokens, completionTokens, totalTokens } — variações
  const t = usage.totalTokens ?? ((usage.promptTokens || 0) + (usage.completionTokens || 0))
  if (typeof t === 'number' && t > 0) totalTokens.value += t
}
function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(1)}k`
}

// ── Multiline input ────────────────────────────────────────────────────────
const isMultiline = computed(() => input.value.includes('\n') || input.value.length > 80)

function onInputKeydown(e: KeyboardEvent) {
  // Slash commands: ↑/↓/Enter/Tab navegam o menu antes de tudo
  if (showSlashMenu.value) {
    if (e.key === 'ArrowDown') { e.preventDefault(); slashIndex.value = (slashIndex.value + 1) % filteredSlashCommands.value.length; return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); slashIndex.value = (slashIndex.value - 1 + filteredSlashCommands.value.length) % filteredSlashCommands.value.length; return }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySlashCommand(filteredSlashCommands.value[slashIndex.value]); return }
    if (e.key === 'Escape')    { e.preventDefault(); slashSuppressed.value = true; return }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  } else if (e.key === 'Escape') {
    closeChat()
  } else if (e.key === 'ArrowUp' && !input.value && messages.value.length > 0) {
    // ↑ no input vazio → carrega última msg do user pra editar
    const lastUser = [...messages.value].reverse().find(m => m.role === 'user')
    if (lastUser) {
      const idx = messages.value.lastIndexOf(lastUser)
      if (canEditMessage(idx)) {
        e.preventDefault()
        startEdit(lastUser, idx)
      }
    }
  }
}

// ── Slash commands ─────────────────────────────────────────────────────────
// `/` no início do input abre menu; cada comando preenche um template,
// posicionando o cursor onde o user precisa completar.
interface SlashCommand {
  cmd:       string                       // "/pedidos"
  label:     string                       // "Pedidos pendentes"
  template:  string                       // texto que vai pro input
  cursorAt?: number                       // posição do cursor após inserir
}

const SLASH_COMMANDS: ReadonlyArray<SlashCommand> = [
  { cmd: '/dashboard',    label: 'Resumo do dia',                        template: 'Me dá um resumo do dia (dashboard)' },
  { cmd: '/pedidos',      label: 'Pedidos pendentes hoje',               template: 'Quais pedidos estão pendentes hoje?' },
  { cmd: '/agenda',       label: 'Pedidos pra entregar hoje',            template: 'O que tem pra entregar hoje?' },
  { cmd: '/financeiro',   label: 'Resumo financeiro 30 dias',            template: 'Resumo financeiro dos últimos 30 dias' },
  { cmd: '/cobrancas',    label: 'Cobranças vencidas',                   template: 'Quais cobranças estão vencidas?' },
  { cmd: '/clientes',     label: 'Top 10 clientes do mês',               template: 'Top 10 clientes do mês' },
  { cmd: '/estoque',      label: 'Produtos com estoque baixo',           template: 'Produtos com estoque baixo' },
  { cmd: '/produtos',     label: 'Listar produtos',                      template: 'Liste os produtos' },
  { cmd: '/fornecedores', label: 'Listar fornecedores',                  template: 'Liste os fornecedores' },
  { cmd: '/buscar',       label: 'Buscar cliente por nome',              template: 'Buscar cliente: ', cursorAt: 17 },
  { cmd: '/whatsapp',     label: 'Enviar WhatsApp',                      template: 'Manda WhatsApp pra ', cursorAt: 19 },
  { cmd: '/email',        label: 'Enviar email',                         template: 'Manda email pra ', cursorAt: 16 },
  { cmd: '/cobrar',       label: 'Lançar cobrança nova',                 template: 'Lança cobrança de R$ ', cursorAt: 21 },
  { cmd: '/despesa',      label: 'Lançar despesa',                       template: 'Lança despesa de R$ ', cursorAt: 19 },
  { cmd: '/cadastrar',    label: 'Cadastrar cliente novo',               template: 'Cadastra cliente novo: ', cursorAt: 24 },
  { cmd: '/produto-novo', label: 'Cadastrar produto',                    template: 'Cadastra produto: ', cursorAt: 17 },
] as const

const slashIndex = ref(0)
// Permite fechar o menu via Esc sem apagar o input. Reseta quando o input muda.
const slashSuppressed = ref(false)
const showSlashMenu = computed(() =>
  !slashSuppressed.value && isOpen.value && !streaming.value && /^\/\S*$/.test(input.value.trim()) && filteredSlashCommands.value.length > 0,
)
watch(input, () => { slashSuppressed.value = false })
const filteredSlashCommands = computed(() => {
  const q = input.value.trim().toLowerCase()
  if (!q.startsWith('/')) return []
  return SLASH_COMMANDS.filter(c =>
    c.cmd.toLowerCase().startsWith(q) || c.label.toLowerCase().includes(q.slice(1)),
  )
})

watch(filteredSlashCommands, () => { slashIndex.value = 0 })

function applySlashCommand(cmd: SlashCommand | undefined) {
  if (!cmd) return
  input.value = cmd.template
  nextTick(() => {
    const el = inputEl.value
    if (!el) return
    autoResizeInput()
    if (cmd.cursorAt != null) {
      el.setSelectionRange(cmd.cursorAt, cmd.cursorAt)
    } else {
      el.setSelectionRange(cmd.template.length, cmd.template.length)
    }
    el.focus()
  })
}

// ── Export da conversa ────────────────────────────────────────────────────
function exportConversation() {
  if (messages.value.length === 0) return
  const sessionTitle = currentSessionTitle.value
  const date = new Date().toLocaleString('pt-BR')
  const lines: string[] = [
    `# ${sessionTitle}`,
    ``,
    `**Exportado em:** ${date}`,
    `**Mensagens:** ${messages.value.length}`,
    ``,
    `---`,
    ``,
  ]
  for (const m of messages.value) {
    if (m.role === 'user') {
      lines.push(`### 👤 Você`)
      lines.push('')
      lines.push(m.text)
    } else {
      lines.push(`### 🤖 Assistente`)
      lines.push('')
      if (m.tools?.length) {
        const tnames = m.tools.map(t => `${t.ok === false ? '⚠' : '✓'} ${t.name}`).join(', ')
        lines.push(`*Tools usadas: ${tnames}*`)
        lines.push('')
      }
      lines.push(m.text)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }
  const md = lines.join('\n')
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safe = sessionTitle.replace(/[^a-z0-9-]+/gi, '-').slice(0, 50) || 'conversa'
  a.href = url
  a.download = `${safe}-${new Date().toISOString().slice(0, 10)}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function autoResizeInput() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`  // 128 = max-h-32
}

watch(() => input.value, () => nextTick(autoResizeInput))

// ── Edit + resend última mensagem do user ──────────────────────────────────

/**
 * Permite editar somente a última mensagem do user (e só se não tem outra
 * msg do user depois — ou seja, a última do array todo é mesmo do user OU
 * tem só assistant depois). Match com padrão ChatGPT.
 */
function canEditMessage(index: number): boolean {
  if (streaming.value) return false
  const msg = messages.value[index]
  if (msg?.role !== 'user') return false
  // Última msg de user — não tem outra user depois
  for (let i = index + 1; i < messages.value.length; i++) {
    if (messages.value[i]?.role === 'user') return false
  }
  return true
}

async function startEdit(msg: Message, index: number) {
  // Carrega o texto no input pra reedit
  input.value = msg.text
  await nextTick(() => {
    inputEl.value?.focus()
    autoResizeInput()
  })

  // Marca pra que o próximo `send` apague essa msg + todas as posteriores
  // antes de mandar. Se o user desistir, pode digitar outra coisa — não
  // estraga.
  pendingEditFromMessageId.value = msg.id ?? null
  pendingEditFromIndex.value = index
}

const pendingEditFromMessageId = ref<number | null>(null)
const pendingEditFromIndex     = ref<number | null>(null)

async function discardEditAfterFromIndex() {
  // Apaga local
  if (pendingEditFromIndex.value != null) {
    messages.value = messages.value.slice(0, pendingEditFromIndex.value)
  }
  // Apaga no backend (se temos id real)
  if (pendingEditFromMessageId.value != null) {
    try {
      await apiFetch(`/api/ai-chat/messages/from/${pendingEditFromMessageId.value}`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId: sessionId.value }),
      })
    } catch { /* não bloqueia o resend */ }
  }
  pendingEditFromMessageId.value = null
  pendingEditFromIndex.value = null
}

// ── Modo voz contínuo (hands-free) ────────────────────────────────────────
// Loop: ouve → transcreve → manda → IA responde → TTS lê → volta a ouvir.
//
// State machine:
//   idle       — não está em voice mode
//   listening  — mic aberto esperando o user falar
//   processing — texto enviado, esperando IA responder
//   speaking   — TTS lendo a resposta em voz alta
type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'
const voiceMode = ref(false)
const voiceState = ref<VoiceState>('idle')
const voiceTranscript = ref('')

const voiceStatusLabel = computed(() => {
  switch (voiceState.value) {
    case 'listening':  return 'Ouvindo…'
    case 'processing': return 'Pensando…'
    case 'speaking':   return 'Falando…'
    default:           return 'Iniciando'
  }
})

function enterVoiceMode() {
  if (!speechSupported || !ttsSupported) {
    alert('Seu navegador não suporta reconhecimento de voz e/ou síntese de voz. Use Chrome ou Edge.')
    return
  }
  voiceMode.value = true
  voiceState.value = 'listening'
  voiceTranscript.value = ''
  // Para qualquer single-shot recording que estava acontecendo
  if (recording.value) speechRecognition?.stop()
  recording.value = false
  // Inicia ciclo
  startVoiceListening()
}

function exitVoiceMode() {
  voiceMode.value = false
  voiceState.value = 'idle'
  voiceTranscript.value = ''
  // Limpa tudo que estava em curso
  speechRecognition?.stop?.()
  if (ttsSupported) window.speechSynthesis.cancel()
  speakingText.value = null
  // Aborta stream se houver
  if (streaming.value) abortController?.abort()
}

function startVoiceListening() {
  if (!voiceMode.value) return
  voiceState.value = 'listening'
  voiceTranscript.value = ''

  speechRecognition = new SpeechRecognitionCtor()
  speechRecognition.lang = 'pt-BR'
  speechRecognition.interimResults = true
  speechRecognition.continuous = false   // para sozinho no silêncio

  let finalTranscript = ''
  speechRecognition.onresult = (e: any) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) finalTranscript += r[0].transcript
      else interim += r[0].transcript
    }
    voiceTranscript.value = (finalTranscript + interim).trim()
  }
  speechRecognition.onerror = (e: any) => {
    if (!voiceMode.value) return
    if (e.error === 'no-speech') {
      // Silêncio — reinicia ouvindo (paciente, não sai do modo)
      setTimeout(() => startVoiceListening(), 400)
    } else if (e.error === 'aborted') {
      // user saiu do modo, ignora
    } else {
      console.warn('Voice mode erro:', e.error)
      exitVoiceMode()
    }
  }
  speechRecognition.onend = () => {
    if (!voiceMode.value) return
    const text = voiceTranscript.value.trim()
    if (!text) {
      // não falou nada útil — escuta de novo
      setTimeout(() => startVoiceListening(), 200)
      return
    }
    // Tem texto — manda pra IA
    voiceTranscript.value = ''
    voiceSendText(text)
  }

  try {
    speechRecognition.start()
  } catch (err) {
    console.warn('Falha ao iniciar voice mode:', err)
    setTimeout(() => { if (voiceMode.value) startVoiceListening() }, 500)
  }
}

async function voiceSendText(text: string) {
  voiceState.value = 'processing'
  // Adiciona msg do user no histórico
  messages.value.push({ role: 'user', text })
  await scrollToBottom(true)

  // Reusa flow do send normal mas curto-circuitando o input
  const savedInput = input.value
  input.value = text
  await send()
  input.value = savedInput
  // O ciclo continua dentro do handler 'done' (chama startVoiceTts)
}

async function startVoiceTts(text: string) {
  if (!voiceMode.value) return
  voiceState.value = 'speaking'
  stopAllTts()

  const onDone = () => {
    if (!voiceMode.value) return
    startVoiceListening()
  }

  // Tenta cloud TTS primeiro (voz natural OpenAI)
  const url = await cloudTts(text)
  if (!voiceMode.value) return  // user saiu enquanto baixava
  if (url) {
    const audio = new Audio(url)
    audio.onended = onDone
    audio.onerror = onDone
    currentAudio = audio
    try { await audio.play() } catch { onDone() }
    return
  }

  // Fallback: browser TTS
  if (!ttsSupported) return onDone()
  const u = makeUtterance(text)
  u.onend = onDone
  u.onerror = onDone
  currentUtterance = u
  window.speechSynthesis.speak(u)
}

// ── TTS (Read aloud) ───────────────────────────────────────────────────────
const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const speakingText = ref<string | null>(null)
let currentUtterance: SpeechSynthesisUtterance | null = null

/**
 * Seleciona a melhor voz disponível pra TTS em pt-BR.
 *
 * Estratégia (em ordem de preferência):
 *  1. Voz "Neural"/"Premium"/"Natural" feminina pt-BR (Edge tem várias —
 *     Francisca, Brenda, Letícia, Manuela, Yara). São as mais humanas hoje.
 *  2. Qualquer feminina pt-BR pelo nome (Maria, Luciana, Helena, Camila…)
 *  3. Qualquer voz neural pt-BR (mesmo masculina é melhor que voz robótica)
 *  4. Qualquer pt-BR
 *  5. Fallback: undefined (browser escolhe sozinho)
 */
const FEMALE_NAMES_PT = [
  'Francisca', 'Maria', 'Luciana', 'Helena', 'Camila',
  'Brenda', 'Letícia', 'Leticia', 'Manuela', 'Yara', 'Vitória', 'Vitoria',
  'Heloisa', 'Heloísa', 'Júlia', 'Julia', 'Fernanda', 'Marina',
  // Genéricas que aparecem em alguns browsers
  'Female', 'female',
]

function isNeuralName(name: string): boolean {
  return /neural|premium|natural|enhanced|wavenet|online/i.test(name)
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported) return null
  const all = window.speechSynthesis.getVoices()
  if (!all.length) return null

  const ptBR = all.filter(v =>
    /^pt[-_]br$/i.test(v.lang) || /^pt[-_]?br/i.test(v.lang),
  )
  const candidates = ptBR.length ? ptBR : all.filter(v => /^pt/i.test(v.lang))
  if (!candidates.length) return all[0] || null

  // Pontuação:
  //   feminina + neural = 100
  //   feminina           = 70
  //   neural             = 50
  //   pt-BR genérica     = 30
  const scored = candidates.map(v => {
    const isFemale = FEMALE_NAMES_PT.some(n => v.name.includes(n))
    const isNeural = isNeuralName(v.name)
    let score = 30
    if (isFemale && isNeural) score = 100
    else if (isFemale) score = 70
    else if (isNeural) score = 50
    return { voice: v, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.voice ?? null
}

let selectedVoice: SpeechSynthesisVoice | null = null
function refreshSelectedVoice() {
  if (!ttsSupported) return
  selectedVoice = pickVoice()
  if (selectedVoice && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.info(`[AiChat] TTS voz selecionada: ${selectedVoice.name} (${selectedVoice.lang})`)
  }
}

if (ttsSupported) {
  refreshSelectedVoice()
  // Em alguns browsers (Chrome) as vozes vêm assíncronas
  window.speechSynthesis.onvoiceschanged = refreshSelectedVoice
}

/**
 * Configura uma SpeechSynthesisUtterance pra soar mais natural.
 * Centraliza pra reusar entre toggleTts (single-shot) e startVoiceTts (loop).
 */
function makeUtterance(text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(stripMarkdownForTts(text))
  if (selectedVoice) {
    u.voice = selectedVoice
    u.lang  = selectedVoice.lang
  } else {
    u.lang = 'pt-BR'
  }
  // Tempo levemente abaixo do normal soa mais conversacional / humano.
  // Pitch padrão (1.0) — alterar pitch costuma deixar a voz robótica.
  u.rate   = 0.95
  u.pitch  = 1.0
  u.volume = 1.0
  return u
}

/**
 * Tenta TTS via OpenAI (voz humana). Retorna URL do blob se sucesso, null
 * se falhar (caller cai no fallback browser).
 *
 * Cache em memória — mesma frase não regenera (economiza chamadas pagas).
 */
const ttsCache = new Map<string, string>()  // text → blob URL

async function cloudTts(text: string): Promise<string | null> {
  const cached = ttsCache.get(text)
  if (cached) return cached
  try {
    const res = await apiFetch('/api/ai-chat/tts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: stripMarkdownForTts(text) }),
    })
    if (!res.ok) return null
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    ttsCache.set(text, url)
    // Limita cache a 30 entradas (~30MB)
    if (ttsCache.size > 30) {
      const oldest = ttsCache.keys().next().value
      if (oldest) {
        const u = ttsCache.get(oldest)
        if (u) URL.revokeObjectURL(u)
        ttsCache.delete(oldest)
      }
    }
    return url
  } catch { return null }
}

let currentAudio: HTMLAudioElement | null = null

async function toggleTts(text: string) {
  if (!ttsSupported) return
  if (speakingText.value === text) {
    stopAllTts()
    return
  }
  stopAllTts()
  speakingText.value = text

  // 1ª tentativa: cloud TTS (humana)
  const url = await cloudTts(text)
  if (url) {
    const audio = new Audio(url)
    audio.onended = () => { speakingText.value = null }
    audio.onerror = () => { speakingText.value = null }
    currentAudio = audio
    audio.play().catch(() => { speakingText.value = null })
    return
  }

  // 2ª tentativa: browser TTS (robotizado mas funciona)
  const u = makeUtterance(text)
  u.onend = () => { speakingText.value = null }
  u.onerror = () => { speakingText.value = null }
  currentUtterance = u
  window.speechSynthesis.speak(u)
}

function stopAllTts() {
  if (ttsSupported) window.speechSynthesis.cancel()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
  speakingText.value = null
}

function stripMarkdownForTts(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, ' [bloco de código] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
}

// ── Drag-and-drop de arquivos ──────────────────────────────────────────────
const dragOver = ref(false)
let dragCounter = 0

function onDragEnter(e: DragEvent) {
  if (!isOpen.value) return
  if (!e.dataTransfer?.types?.includes('Files')) return
  dragCounter++
  dragOver.value = true
}
function onDragLeave() {
  dragCounter = Math.max(0, dragCounter - 1)
  if (dragCounter === 0) dragOver.value = false
}
async function onDrop(e: DragEvent) {
  dragCounter = 0
  dragOver.value = false
  if (!isOpen.value) return
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (file.size > MAX_ATTACHMENT_BYTES) {
    alert(`Arquivo muito grande. Máximo: ${formatBytes(MAX_ATTACHMENT_BYTES)}.`)
    return
  }
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    alert('Apenas imagens e PDFs são suportados.')
    return
  }
  const base64 = await fileToBase64(file)
  attachment.value = {
    base64,
    mimetype: file.type || 'application/octet-stream',
    filename: file.name,
    size:     file.size,
  }
}

// ── Anexos ─────────────────────────────────────────────────────────────────
interface Attachment { base64: string; mimetype: string; filename: string; size: number }
const attachment = ref<Attachment | null>(null)
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB

function pickFile() {
  fileInputEl.value?.click()
}

async function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > MAX_ATTACHMENT_BYTES) {
    alert(`Arquivo muito grande. Máximo: ${formatBytes(MAX_ATTACHMENT_BYTES)}.`)
    if (fileInputEl.value) fileInputEl.value.value = ''
    return
  }
  const base64 = await fileToBase64(file)
  attachment.value = {
    base64,
    mimetype: file.type || 'application/octet-stream',
    filename: file.name,
    size:     file.size,
  }
  if (fileInputEl.value) fileInputEl.value.value = ''
}

function clearAttachment() {
  attachment.value = null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result vem como "data:image/png;base64,XXX" — só queremos o XXX
      const i = result.indexOf(',')
      resolve(i >= 0 ? result.slice(i + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// ── Voz (Web Speech API) ───────────────────────────────────────────────────
// Disponível em Chrome/Edge/Safari. Firefox não tem (fallback: botão escondido).
const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
const speechSupported = !!SpeechRecognitionCtor
const recording = ref(false)
let speechRecognition: any = null

function toggleRecording() {
  if (!speechSupported) return
  if (recording.value) {
    speechRecognition?.stop()
    return
  }
  // Cria sob demanda — instâncias travam se ficam paradas no autoplay
  speechRecognition = new SpeechRecognitionCtor()
  speechRecognition.lang = 'pt-BR'
  speechRecognition.interimResults = true   // mostra texto parcial enquanto fala
  speechRecognition.continuous = false      // para automático no silêncio

  let baseInput = input.value
  if (baseInput && !baseInput.endsWith(' ')) baseInput += ' '

  speechRecognition.onresult = (e: any) => {
    let transcript = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript
    }
    input.value = baseInput + transcript
  }
  speechRecognition.onerror = (e: any) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      console.warn('Speech recognition erro:', e.error)
    }
    recording.value = false
  }
  speechRecognition.onend = () => {
    recording.value = false
    nextTick(() => inputEl.value?.focus())
  }

  try {
    speechRecognition.start()
    recording.value = true
  } catch (err) {
    console.warn('Falha ao iniciar speech:', err)
    recording.value = false
  }
}

const currentSessionTitle = computed(() => {
  const s = sessions.value.find(s => s.id === sessionId.value)
  return s?.title || 'Assistente do ERP'
})

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
const shortcutLabel = isMac ? '⌘ /' : 'Ctrl + /'

// Comandos rápidos vêm do backend (configuráveis na AiView).
// Defaults ficam lá também — se a config estiver vazia, devolvemos defaults.
const quickCommands = ref<Array<{ icon: string; text: string }>>([])

async function loadQuickCommands() {
  try {
    const res = await apiFetch('/api/ai-chat/quick-commands')
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data.commands)) quickCommands.value = data.commands
  } catch { /* fallback: array vazio */ }
}

// ── Carregar sessões + histórico ───────────────────────────────────────────

async function loadSessions() {
  try {
    const res = await apiFetch('/api/ai-chat/sessions')
    if (!res.ok) return
    const data = await res.json()
    sessions.value = data.sessions || []
    // Se a session atual não existe mais (apagada externamente), pula pra primeira
    const first = sessions.value[0]
    if (first && !sessions.value.find(s => s.id === sessionId.value)) {
      sessionId.value = first.id
    }
  } catch { /* falha silenciosa */ }
}

async function loadHistory() {
  try {
    const res = await apiFetch(`/api/ai-chat/history?sessionId=${encodeURIComponent(sessionId.value)}&limit=50`)
    if (!res.ok) { messages.value = []; return }
    const data = await res.json()
    if (Array.isArray(data.messages)) {
      messages.value = data.messages.map((m: any): Message => ({
        id:       m.id,
        role:     m.role,
        text:     m.text,
        feedback: m.feedback ?? null,
      }))
    }
  } catch { messages.value = [] }
}

onMounted(async () => {
  await Promise.all([loadSessions(), loadQuickCommands()])
  // Se ainda usa sessionId default mas tem sessões, abre a mais recente
  const first = sessions.value[0]
  if (sessionId.value === 'erp-widget' && first) {
    sessionId.value = first.id
  }
  await loadHistory()
})

// ── Hover (mantém comportamento de pill expansível) ────────────────────────
let hoverTimer: number | null = null
function onHover(state: boolean) {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
  if (state) isHovered.value = true
  else hoverTimer = window.setTimeout(() => { isHovered.value = false }, 150)
}

// ── Abrir/fechar painel ────────────────────────────────────────────────────
function openChat() {
  if (isOpen.value) return
  isOpen.value = true
  hasUnread.value = false
  nextTick(() => {
    inputEl.value?.focus()
    scrollToBottom(true)
  })
}

function closeChat() {
  isOpen.value = false
  inputEl.value?.blur()
}

function toggleChat() {
  if (isOpen.value) closeChat()
  else openChat()
}

// Click fora fecha
function onClickOutside(e: MouseEvent) {
  if (!isOpen.value) return
  if (containerEl.value && !containerEl.value.contains(e.target as Node)) {
    closeChat()
  }
}

// Atalho global Ctrl+/ (ou Cmd+/) + Esc sai de voice mode
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault()
    toggleChat()
    if (isOpen.value) inputEl.value?.focus()
    return
  }
  if (e.key === 'Escape' && voiceMode.value) {
    e.preventDefault()
    exitVoiceMode()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('keydown', onGlobalKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('keydown', onGlobalKeydown)
  if (hoverTimer) clearTimeout(hoverTimer)
  abortController?.abort()
  speechRecognition?.stop()
  if (ttsSupported) window.speechSynthesis.cancel()
  void currentUtterance // silence lint
})

watch(isOpen, (v) => { if (v) hasUnread.value = false })

// ── Scroll inteligente ─────────────────────────────────────────────────────

function onMessagesScroll() {
  if (!messagesEl.value) return
  const el = messagesEl.value
  // tolerância de 40px — se está perto do fim, considera "no fim"
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
}

async function scrollToBottom(force = false) {
  await nextTick()
  if (!messagesEl.value) return
  if (!force && !isAtBottom.value) return
  messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  isAtBottom.value = true
}

// ── Envio (modo streaming via SSE) ─────────────────────────────────────────

function sendSuggestion(text: string) {
  input.value = text
  send()
}

async function send() {
  const text = input.value.trim()
  // Permite enviar com só anexo (sem texto) ou só texto, mas precisa de algum
  if (!text && !attachment.value) return
  if (streaming.value) return
  // Para gravação de voz se estiver ativa
  if (recording.value) speechRecognition?.stop()

  if (!isOpen.value) openChat()

  // Edit + resend: se o user editou uma msg antiga, apaga ela + posteriores
  // antes de mandar a versão nova. Senão isso é noop.
  if (pendingEditFromIndex.value != null) {
    await discardEditAfterFromIndex()
  }

  // Garante que existe sessionId ativo
  if (sessionId.value === 'erp-widget' && sessions.value.length === 0) {
    await ensureSession(text || attachment.value?.filename || 'Anexo')
  }

  // Snapshot do anexo (vai junto da mensagem do user no array)
  const mediaSnapshot = attachment.value
  const userText = text || (mediaSnapshot ? `[anexo: ${mediaSnapshot.filename}]` : '')

  messages.value.push({ role: 'user', text: userText })
  input.value = ''
  await nextTick(autoResizeInput)
  partialText.value = ''
  liveTools.value = []
  streaming.value = true
  await scrollToBottom(true)

  // Aborta qualquer stream anterior
  abortController?.abort()
  abortController = new AbortController()

  const token = localStorage.getItem('gp_token')
  try {
    const res = await fetch('/api/ai-chat/message/stream', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:   JSON.stringify({
        message:   text,
        sessionId: sessionId.value,
        mediaData: mediaSnapshot
          ? { base64: mediaSnapshot.base64, mimetype: mediaSnapshot.mimetype, filename: mediaSnapshot.filename }
          : undefined,
      }),
      signal: abortController.signal,
    })

    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({}))
      finalizeAssistant(`❌ ${errBody.message || `Erro HTTP ${res.status}`}`, [])
      return
    }

    await consumeSseStream(res.body)
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      // User clicou parar — preserva o que tinha até agora
      finalizeAssistant(partialText.value || '(interrompido)', collectToolsFromLive())
    } else {
      finalizeAssistant(`❌ Falha de conexão: ${e.message || 'desconhecida'}`, [])
    }
  } finally {
    streaming.value = false
    partialText.value = ''
    liveTools.value = []
    attachment.value = null         // limpa anexo após envio (sucesso ou falha)
    abortController = null
    inputEl.value?.focus()
    // Recarrega sessões pra atualizar lastActivity/título
    void loadSessions()
  }
}

/** Consome stream SSE (text/event-stream). Cada evento é uma linha "data: {...}\n\n". */
async function consumeSseStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Processa eventos completos (separados por \n\n)
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const line = chunk.split('\n').find(l => l.startsWith('data: '))
      if (!line) continue
      const json = line.slice(6).trim()
      if (!json) continue
      try {
        handleSseEvent(JSON.parse(json))
      } catch { /* malformed event — ignora */ }
    }
  }
}

function handleSseEvent(evt: any) {
  switch (evt.type) {
    case 'delta':
      partialText.value += evt.text || ''
      void scrollToBottom()
      break
    case 'tool-call':
      liveTools.value.push({ name: evt.name, status: 'running' })
      void scrollToBottom()
      break
    case 'tool-result': {
      // Marca a última tool com esse nome em "running" como done/error
      const t = [...liveTools.value].reverse().find(t => t.name === evt.name && t.status === 'running')
      if (t) t.status = evt.ok === false ? 'error' : 'done'
      break
    }
    case 'done': {
      addUsage(evt.usage)
      const finalText = evt.text || partialText.value || '(sem resposta)'
      finalizeAssistant(finalText, collectToolsFromLive(), evt.messageId)
      // Voice mode: lê em voz alta, depois reabre o mic
      if (voiceMode.value) startVoiceTts(finalText)
      break
    }
    case 'error':
      finalizeAssistant(
        `❌ ${evt.message || 'Erro no stream.'}`,
        collectToolsFromLive(),
        undefined,
      )
      // Em voice mode, em vez de travar no erro, fala "tive um problema" e
      // volta a ouvir
      if (voiceMode.value) startVoiceTts('Tive um problema técnico. Pode repetir?')
      break
  }
}

function collectToolsFromLive(): ToolUse[] {
  return liveTools.value.map(t => ({
    name: t.name,
    ok:   t.status !== 'error',
  }))
}

function finalizeAssistant(text: string, tools: ToolUse[], id?: number) {
  // Extrai bloco <!--suggestions:[...]--> do texto antes de renderizar.
  // O backend pediu pra IA emitir esse marker no fim — aqui pulamos pro array.
  const { clean, suggestions } = extractSuggestions(text)
  messages.value.push({
    id,
    role: 'assistant',
    text: clean,
    tools,
    feedback: null,
    suggestions,
  })
  if (!isOpen.value) hasUnread.value = true
}

/** Click num chip de sugestão — popula input e dispara send. */
function useSuggestion(s: string) {
  input.value = s
  void send()
}

function abortStream() {
  abortController?.abort()
}

// ── Reset, sessões, copy, feedback ─────────────────────────────────────────

async function resetChat() {
  try {
    await apiFetch('/api/ai-chat/reset', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId: sessionId.value }),
    })
  } catch { /* ignore */ }
  messages.value = []
  totalTokens.value = 0
}

/** Garante uma sessão criada antes de enviar a primeira msg do widget. */
async function ensureSession(firstMessage: string) {
  try {
    const res = await apiFetch('/api/ai-chat/sessions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: firstMessage.slice(0, 60) }),
    })
    if (res.ok) {
      const data = await res.json()
      sessionId.value = data.session.id
      sessions.value.unshift(data.session)
    }
  } catch { /* fallback pra erp-widget */ }
}

async function newSession() {
  try {
    const res = await apiFetch('/api/ai-chat/sessions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    })
    if (res.ok) {
      const data = await res.json()
      sessions.value.unshift(data.session)
      sessionId.value = data.session.id
      messages.value = []
    }
  } catch { /* ignore */ }
}

async function switchSession(id: string) {
  if (id === sessionId.value) return
  sessionId.value = id
  totalTokens.value = 0  // contador é por sessão
  await loadHistory()
  await scrollToBottom(true)
}

async function deleteSession(id: string) {
  if (!confirm('Apagar esta conversa?')) return
  try {
    await apiFetch(`/api/ai-chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    sessions.value = sessions.value.filter(s => s.id !== id)
    if (id === sessionId.value) {
      sessionId.value = sessions.value[0]?.id || 'erp-widget'
      await loadHistory()
    }
  } catch { /* ignore */ }
}

async function copyMessage(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch { /* ignore */ }
}

async function setFeedback(m: Message, value: 1 | -1) {
  if (!m.id) return
  // Toggle: se já tinha esse feedback, remove
  const newValue = m.feedback === value ? null : value
  m.feedback = newValue
  try {
    await apiFetch(`/api/ai-chat/messages/${m.id}/feedback`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ feedback: newValue }),
    })
  } catch { /* erro silencioso — toggle local fica */ }
}
</script>

<style scoped>
/* Orbe respirando — usado no modo voz pra dar vida visual ao estado */
@keyframes orb-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50%      { transform: scale(1.06); box-shadow: 0 0 0 16px rgba(99, 102, 241, 0); }
}
.animate-orb-pulse { animation: orb-pulse 1.6s ease-in-out infinite; }

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Fade simples — overlay drag-drop */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

/* ── Estilos do markdown renderizado ──────────────────────────────────── */
.ai-md :deep(p) { margin: 0 0 .5em; line-height: 1.5; }
.ai-md :deep(p:last-child) { margin-bottom: 0; }
.ai-md :deep(strong) { font-weight: 600; color: rgb(15 23 42); }
.ai-md :deep(em) { font-style: italic; }
.ai-md :deep(ul), .ai-md :deep(ol) { margin: .25em 0 .75em; padding-left: 1.25rem; }
.ai-md :deep(ul) { list-style-type: disc; }
.ai-md :deep(ol) { list-style-type: decimal; }
.ai-md :deep(li) { margin: .15em 0; line-height: 1.45; }
.ai-md :deep(li > ul), .ai-md :deep(li > ol) { margin: .15em 0; }
.ai-md :deep(a) { color: rgb(37 99 235); text-decoration: underline; }
.ai-md :deep(a:hover) { color: rgb(29 78 216); }
.ai-md :deep(code) {
  background: rgb(241 245 249);
  border: 1px solid rgb(226 232 240);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  color: rgb(15 23 42);
}
.ai-md :deep(pre) {
  background: rgb(15 23 42);
  color: rgb(226 232 240);
  border-radius: 8px;
  padding: 0.75rem 0.875rem;
  margin: 0.5em 0;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
}
.ai-md :deep(pre code) {
  background: transparent;
  border: 0;
  padding: 0;
  color: inherit;
  font-size: inherit;
}
.ai-md :deep(blockquote) {
  border-left: 3px solid rgb(203 213 225);
  padding-left: 0.75rem;
  margin: 0.5em 0;
  color: rgb(71 85 105);
  font-style: italic;
}
.ai-md :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 12px;
}
.ai-md :deep(th), .ai-md :deep(td) {
  border: 1px solid rgb(226 232 240);
  padding: 4px 8px;
  text-align: left;
}
.ai-md :deep(th) {
  background: rgb(248 250 252);
  font-weight: 600;
}
.ai-md :deep(h1), .ai-md :deep(h2), .ai-md :deep(h3), .ai-md :deep(h4) {
  font-weight: 600;
  margin: 0.6em 0 0.25em;
  color: rgb(15 23 42);
}
.ai-md :deep(h1) { font-size: 1.1em; }
.ai-md :deep(h2) { font-size: 1.05em; }
.ai-md :deep(h3) { font-size: 1em; }
.ai-md :deep(hr) { border: 0; border-top: 1px solid rgb(226 232 240); margin: 0.75em 0; }
</style>
