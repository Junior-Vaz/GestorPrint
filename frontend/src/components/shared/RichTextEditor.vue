<script setup lang="ts">
/**
 * Editor WYSIWYG baseado em TipTap (ProseMirror).
 *
 * Reutilizável: aceita v-model:html como string HTML. Designed pra editar
 * descrição rica de produto, posts de blog, conteúdo da página Sobre, etc.
 *
 * Saída sempre HTML limpo e estruturado — bem semântico, fácil de sanitizar
 * server-side ou client-side antes de renderizar pra cliente final.
 *
 * Configuração mínima — usa StarterKit (parágrafo, headings, bold, italic,
 * listas, blockquote, code, hr) + Image + Link + YouTube + Placeholder.
 */
import { onBeforeUnmount, watch, ref, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Minus, Link2, Image as ImageIcon, Youtube as YoutubeIcon, Undo2, Redo2,
  Code,
} from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  minHeight?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      // Heading: só níveis úteis pro contexto produto/blog
      heading: { levels: [2, 3] },
    }),
    Image.configure({
      HTMLAttributes: { class: 'rte-img' },
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { class: 'rte-link', rel: 'noopener noreferrer' },
    }),
    Youtube.configure({
      controls: true,
      nocookie: true,
      modestBranding: true,
      width: 640,
      height: 360,
      HTMLAttributes: { class: 'rte-youtube' },
    }),
    Placeholder.configure({
      placeholder: props.placeholder || 'Comece a escrever…',
    }),
  ],
  // Emit em cada mudança — Vue v-model reativo
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

// Sincroniza quando o pai muda o v-model externamente (ex: abrir modal de edit
// e preencher com produto existente). Evita loop comparando o HTML atual.
watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  if (val === editor.value.getHTML()) return
  // Tiptap setContent: 2º arg é boolean emitUpdate (false = não dispara onUpdate
  // do editor, evitando loop com o watch do v-model)
  editor.value.commands.setContent(val || '', false)
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

// ── Modal interno pra inserir link/imagem/vídeo ───────────────────────────
// Substitui window.prompt() por modal customizado (consistente com o resto do
// ERP, suporta Enter pra confirmar, Esc pra cancelar, e dois campos quando
// necessário — ex.: imagem precisa de URL + alt-text).
type DialogKind = 'link' | 'image' | 'youtube'
const dialog = ref<{
  kind: DialogKind
  url: string
  alt: string
  error: string
} | null>(null)

const urlInputEl = ref<HTMLInputElement | null>(null)

const dialogTitle = {
  link:    'Inserir link',
  image:   'Inserir imagem',
  youtube: 'Inserir vídeo do YouTube',
} as const

const dialogPlaceholder = {
  link:    'https://exemplo.com/pagina',
  image:   'https://exemplo.com/foto.jpg',
  youtube: 'https://youtube.com/watch?v=…',
} as const

function openDialog(kind: DialogKind, prefillUrl = '') {
  dialog.value = { kind, url: prefillUrl, alt: '', error: '' }
  // Foca o input de URL automaticamente
  nextTick(() => urlInputEl.value?.focus())
}

function closeDialog() {
  dialog.value = null
}

function confirmDialog() {
  if (!dialog.value || !editor.value) return
  const { kind, url, alt } = dialog.value
  const trimmed = url.trim()

  if (kind === 'link') {
    if (!trimmed) {
      // URL vazia + tinha link selecionado → remove
      editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
      closeDialog()
      return
    }
    editor.value.chain().focus().extendMarkRange('link')
      .setLink({ href: trimmed, target: '_blank' }).run()
    closeDialog()
    return
  }

  if (kind === 'image') {
    if (!trimmed) {
      dialog.value.error = 'Cole a URL da imagem'
      return
    }
    editor.value.chain().focus().setImage({ src: trimmed, alt: alt.trim() }).run()
    closeDialog()
    return
  }

  if (kind === 'youtube') {
    if (!trimmed) {
      dialog.value.error = 'Cole a URL do vídeo'
      return
    }
    // TipTap aceita várias formas de URL do YouTube — converte internamente.
    // Se não for um link reconhecido, ele simplesmente não insere; vamos
    // validar de forma simples antes pra dar feedback claro.
    if (!/youtu\.?be/i.test(trimmed)) {
      dialog.value.error = 'URL inválida — use um link do YouTube'
      return
    }
    editor.value.chain().focus().setYoutubeVideo({ src: trimmed }).run()
    closeDialog()
    return
  }
}

// Fecha modal com Esc, confirma com Enter (Shift+Enter no campo alt = nova linha)
function onDialogKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeDialog()
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    confirmDialog()
  }
}

// ── Helpers da toolbar ────────────────────────────────────────────────────
function setLink() {
  const previousUrl = editor.value?.getAttributes('link').href || ''
  openDialog('link', previousUrl)
}

function addImage() {
  openDialog('image')
}

function addYoutube() {
  openDialog('youtube')
}
</script>

<template>
  <div class="rte" :style="minHeight ? { '--rte-min-h': minHeight } : undefined">
    <!-- Toolbar -->
    <div v-if="editor" class="rte-toolbar">
      <button type="button" :class="{ active: editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()" title="Negrito (Ctrl+B)">
        <Bold class="w-3.5 h-3.5" />
      </button>
      <button type="button" :class="{ active: editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()" title="Itálico (Ctrl+I)">
        <Italic class="w-3.5 h-3.5" />
      </button>
      <button type="button" :class="{ active: editor.isActive('strike') }"
        @click="editor.chain().focus().toggleStrike().run()" title="Tachado">
        <Strikethrough class="w-3.5 h-3.5" />
      </button>
      <button type="button" :class="{ active: editor.isActive('code') }"
        @click="editor.chain().focus().toggleCode().run()" title="Código inline">
        <Code class="w-3.5 h-3.5" />
      </button>

      <span class="rte-divider"></span>

      <button type="button" :class="{ active: editor.isActive('heading', { level: 2 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" title="Título">
        <Heading2 class="w-3.5 h-3.5" />
      </button>
      <button type="button" :class="{ active: editor.isActive('heading', { level: 3 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" title="Subtítulo">
        <Heading3 class="w-3.5 h-3.5" />
      </button>

      <span class="rte-divider"></span>

      <button type="button" :class="{ active: editor.isActive('bulletList') }"
        @click="editor.chain().focus().toggleBulletList().run()" title="Lista">
        <List class="w-3.5 h-3.5" />
      </button>
      <button type="button" :class="{ active: editor.isActive('orderedList') }"
        @click="editor.chain().focus().toggleOrderedList().run()" title="Lista numerada">
        <ListOrdered class="w-3.5 h-3.5" />
      </button>
      <button type="button" :class="{ active: editor.isActive('blockquote') }"
        @click="editor.chain().focus().toggleBlockquote().run()" title="Citação">
        <Quote class="w-3.5 h-3.5" />
      </button>
      <button type="button"
        @click="editor.chain().focus().setHorizontalRule().run()" title="Linha horizontal">
        <Minus class="w-3.5 h-3.5" />
      </button>

      <span class="rte-divider"></span>

      <button type="button" :class="{ active: editor.isActive('link') }"
        @click="setLink" title="Link">
        <Link2 class="w-3.5 h-3.5" />
      </button>
      <button type="button" @click="addImage" title="Inserir imagem">
        <ImageIcon class="w-3.5 h-3.5" />
      </button>
      <button type="button" @click="addYoutube" title="Inserir vídeo do YouTube">
        <YoutubeIcon class="w-3.5 h-3.5" />
      </button>

      <span class="rte-divider"></span>

      <button type="button" :disabled="!editor.can().undo()"
        @click="editor.chain().focus().undo().run()" title="Desfazer (Ctrl+Z)">
        <Undo2 class="w-3.5 h-3.5" />
      </button>
      <button type="button" :disabled="!editor.can().redo()"
        @click="editor.chain().focus().redo().run()" title="Refazer (Ctrl+Shift+Z)">
        <Redo2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Área editável -->
    <EditorContent :editor="editor" class="rte-content" />

    <!-- Modal de inserção (link / imagem / vídeo) — substitui window.prompt -->
    <Teleport to="body">
      <div v-if="dialog" class="rte-dialog-backdrop" @click.self="closeDialog">
        <div class="rte-dialog" role="dialog" :aria-label="dialogTitle[dialog.kind]" @keydown="onDialogKeydown">
          <header class="rte-dialog-head">
            <h4>{{ dialogTitle[dialog.kind] }}</h4>
            <button type="button" class="rte-dialog-close" @click="closeDialog" aria-label="Fechar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </header>

          <div class="rte-dialog-body">
            <label class="rte-dialog-label">URL</label>
            <input
              ref="urlInputEl"
              v-model="dialog.url"
              type="url"
              :placeholder="dialogPlaceholder[dialog.kind]"
              class="rte-dialog-input"
              autocomplete="off"
              spellcheck="false"
            />

            <template v-if="dialog.kind === 'image'">
              <label class="rte-dialog-label" style="margin-top:12px">
                Texto alternativo (acessibilidade)
                <span class="rte-dialog-hint">opcional, mas recomendado</span>
              </label>
              <input
                v-model="dialog.alt"
                type="text"
                placeholder="Ex.: Foto detalhe do acabamento fosco"
                class="rte-dialog-input"
                autocomplete="off"
              />
            </template>

            <template v-else-if="dialog.kind === 'youtube'">
              <p class="rte-dialog-hint" style="margin-top:8px">
                Aceita URLs em qualquer formato: <code>youtube.com/watch?v=…</code> · <code>youtu.be/…</code> · <code>/embed/…</code>
              </p>
            </template>

            <template v-else-if="dialog.kind === 'link'">
              <p class="rte-dialog-hint" style="margin-top:8px">
                Deixe vazio e clique em "Confirmar" pra remover o link da seleção.
              </p>
            </template>

            <div v-if="dialog.error" class="rte-dialog-error">{{ dialog.error }}</div>
          </div>

          <footer class="rte-dialog-foot">
            <button type="button" class="rte-dialog-btn-cancel" @click="closeDialog">Cancelar</button>
            <button type="button" class="rte-dialog-btn-ok" @click="confirmDialog">Confirmar</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.rte {
  --rte-min-h: 240px;
  border: 1px solid rgb(226 232 240);
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.rte:focus-within {
  border-color: rgb(148 163 184);
}

.rte-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid rgb(226 232 240);
  background: rgb(248 250 252);
}
.rte-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: rgb(71 85 105);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color .15s, color .15s;
}
.rte-toolbar button:hover:not(:disabled) {
  background: white;
  color: rgb(15 23 42);
}
.rte-toolbar button.active {
  background: rgb(15 23 42);
  color: white;
}
.rte-toolbar button:disabled {
  opacity: .4;
  cursor: not-allowed;
}
.rte-divider {
  display: inline-block;
  width: 1px;
  height: 18px;
  background: rgb(226 232 240);
  margin: 0 4px;
}

.rte-content {
  flex: 1;
  min-height: var(--rte-min-h);
  max-height: 600px;
  overflow-y: auto;
}

/* Estilos da área editável (ProseMirror).
   :deep necessário porque o conteúdo é injetado dinamicamente e fica fora
   do escopo CSS do componente. */
.rte-content :deep(.ProseMirror) {
  padding: 14px 18px;
  outline: none;
  min-height: var(--rte-min-h);
  font-size: 14px;
  line-height: 1.65;
  color: rgb(15 23 42);
}
.rte-content :deep(.ProseMirror p) {
  margin: 0 0 12px;
}
.rte-content :deep(.ProseMirror p:last-child) {
  margin-bottom: 0;
}
.rte-content :deep(.ProseMirror h2) {
  font-size: 22px;
  font-weight: 600;
  margin: 20px 0 10px;
  color: rgb(15 23 42);
}
.rte-content :deep(.ProseMirror h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: rgb(15 23 42);
}
.rte-content :deep(.ProseMirror ul),
.rte-content :deep(.ProseMirror ol) {
  padding-left: 22px;
  margin: 0 0 12px;
}
.rte-content :deep(.ProseMirror li) {
  margin-bottom: 4px;
}
.rte-content :deep(.ProseMirror blockquote) {
  border-left: 3px solid rgb(148 163 184);
  padding-left: 14px;
  margin: 12px 0;
  color: rgb(71 85 105);
  font-style: italic;
}
.rte-content :deep(.ProseMirror code) {
  background: rgb(241 245 249);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
}
.rte-content :deep(.ProseMirror hr) {
  border: 0;
  border-top: 1px solid rgb(226 232 240);
  margin: 18px 0;
}
.rte-content :deep(.ProseMirror a) {
  color: rgb(29 158 117);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.rte-content :deep(.ProseMirror img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px auto;
  border-radius: 4px;
}
.rte-content :deep(.ProseMirror img.ProseMirror-selectednode) {
  outline: 2px solid rgb(29 158 117);
}
.rte-content :deep(.ProseMirror iframe) {
  display: block;
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16/9;
  height: auto;
  margin: 12px auto;
  border: 0;
  border-radius: 4px;
  background: black;
}
/* Placeholder pro editor vazio */
.rte-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: rgb(148 163 184);
  pointer-events: none;
  height: 0;
  float: left;
}

/* ── Modal interno (link / imagem / vídeo) ────────────────────────────── */
/* Teleport pro <body>, então não usa scoped no contêiner — uso classes
   prefixadas pra evitar colisões. Como Teleport quebra o scoped, declaro
   sem scoped via :global() do Vue. */
</style>

<style>
.rte-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgb(15 23 42 / 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: rte-fade-in 0.12s ease-out;
}
.rte-dialog {
  background: white;
  border: 1px solid rgb(226 232 240);
  border-radius: 12px;
  box-shadow: 0 20px 50px rgb(15 23 42 / 0.25);
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: rte-pop-in 0.14s ease-out;
}
.rte-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgb(226 232 240);
}
.rte-dialog-head h4 {
  font-size: 14px;
  font-weight: 600;
  color: rgb(15 23 42);
  margin: 0;
}
.rte-dialog-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgb(100 116 139);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rte-dialog-close:hover {
  background: rgb(241 245 249);
  color: rgb(15 23 42);
}
.rte-dialog-body {
  padding: 18px;
}
.rte-dialog-label {
  display: block;
  font-size: 11px;
  color: rgb(100 116 139);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}
.rte-dialog-label .rte-dialog-hint {
  text-transform: none;
  letter-spacing: 0;
  margin-left: 6px;
  font-weight: 400;
  color: rgb(148 163 184);
}
.rte-dialog-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  font-size: 14px;
  color: rgb(15 23 42);
  outline: none;
  background: white;
  transition: border-color 0.15s;
}
.rte-dialog-input:focus {
  border-color: rgb(15 23 42);
}
.rte-dialog-hint {
  font-size: 12px;
  color: rgb(100 116 139);
  line-height: 1.5;
}
.rte-dialog-hint code {
  background: rgb(241 245 249);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.rte-dialog-error {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgb(254 242 242);
  border: 1px solid rgb(254 202 202);
  border-radius: 6px;
  color: rgb(153 27 27);
  font-size: 13px;
}
.rte-dialog-foot {
  padding: 12px 18px;
  border-top: 1px solid rgb(226 232 240);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  background: rgb(248 250 252);
}
.rte-dialog-btn-cancel {
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: rgb(71 85 105);
  font-size: 13px;
  border-radius: 999px;
  cursor: pointer;
}
.rte-dialog-btn-cancel:hover {
  color: rgb(15 23 42);
  background: rgb(241 245 249);
}
.rte-dialog-btn-ok {
  padding: 8px 18px;
  border: none;
  background: rgb(15 23 42);
  color: white;
  font-size: 13px;
  font-weight: 500;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s;
}
.rte-dialog-btn-ok:hover {
  background: rgb(30 41 59);
}

@keyframes rte-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes rte-pop-in {
  from { opacity: 0; transform: scale(0.96) translateY(4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
