<template>
  <div class="w-64 shrink-0 flex flex-col gap-2 p-3 bg-slate-50/80 border-l border-slate-200 overflow-y-auto">
    <template v-if="!node">
      <p class="text-xs font-bold text-slate-400 text-center mt-10">Selecione um nó para editar</p>
    </template>

    <template v-else>
      <p class="text-[10px] font-black text-indigo-600 uppercase tracking-widest pb-1">{{ nodeTypeName }} — Inspector</p>

      <!-- Label (all nodes) -->
      <label class="lbl">Label</label>
      <input v-model="d.label" class="fi" placeholder="Nome do nó" @input="emit" />

      <!-- TRIAGE -->
      <template v-if="node.type === 'triage'">
        <label class="lbl">System Prompt</label>
        <textarea v-model="d.systemPrompt" class="fi" rows="3" placeholder="Instruções da IA..." @input="emit" />
        <label class="lbl">Instrução</label>
        <textarea v-model="d.instruction" class="fi" rows="2" placeholder="Contexto de triagem..." @input="emit" />
      </template>

      <!-- COLLECT -->
      <template v-if="node.type === 'collect'">
        <label class="lbl">System Prompt</label>
        <textarea v-model="d.systemPrompt" class="fi" rows="2" @input="emit" />
        <label class="lbl">Campos a coletar</label>
        <div v-for="(f, i) in (d.fields || [])" :key="i" class="flex items-center gap-1">
          <input v-model="f.name" class="fi w-20 shrink-0" placeholder="nome" @input="emit" />
          <select v-model="f.type" class="fi w-20 shrink-0" @change="emit">
            <option value="text">texto</option>
            <option value="number">número</option>
          </select>
          <input v-model="f.description" class="fi flex-1" placeholder="descrição" @input="emit" />
          <button class="shrink-0 px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100" @click="removeField(i)">✕</button>
        </div>
        <button class="w-full py-1.5 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-500 text-xs font-bold hover:bg-indigo-50" @click="addField">+ Campo</button>
      </template>

      <!-- SITUATIONAL -->
      <template v-if="node.type === 'situational'">
        <label class="lbl">Consulta ERP</label>
        <select v-model="d.erpQuery" class="fi" @change="emit">
          <option value="inventory">Catálogo de produtos</option>
          <option value="order_status">Status do pedido</option>
        </select>
        <label class="lbl">Instrução</label>
        <textarea v-model="d.instruction" class="fi" rows="2" placeholder="Como apresentar os dados..." @input="emit" />
        <label class="lbl">System Prompt</label>
        <textarea v-model="d.systemPrompt" class="fi" rows="2" @input="emit" />
      </template>

      <!-- CHOICE -->
      <template v-if="node.type === 'choice'">
        <label class="lbl">Pergunta</label>
        <input v-model="d.question" class="fi" placeholder="Ex: Qual tipo de material?" @input="emit" />
        <label class="lbl">Opções</label>
        <div v-for="(opt, i) in (d.options || [])" :key="opt.id" class="flex items-center gap-1">
          <span class="text-xs font-black text-slate-400 w-4 shrink-0">{{ i + 1 }}.</span>
          <input v-model="opt.text" class="fi flex-1" placeholder="Texto da opção" @input="emit" />
          <button class="shrink-0 px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100" @click="removeOption(i)">✕</button>
        </div>
        <button class="w-full py-1.5 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-500 text-xs font-bold hover:bg-indigo-50" @click="addOption">+ Opção</button>
      </template>

      <!-- VISION -->
      <template v-if="node.type === 'vision'">
        <label class="lbl">System Prompt</label>
        <textarea v-model="d.systemPrompt" class="fi" rows="2" @input="emit" />
        <label class="lbl">Instrução de análise</label>
        <textarea v-model="d.instruction" class="fi" rows="2" placeholder="Ex: Verifique se a resolução é ≥ 300dpi..." @input="emit" />
        <label class="lbl">Rotas de saída</label>
        <div v-for="(e, i) in (d.edges || [])" :key="e.id" class="flex items-center gap-1">
          <input v-model="e.label" class="fi flex-1" placeholder="Ex: aprovado" @input="emit" />
          <button class="shrink-0 px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100" @click="removeVisionEdge(i)">✕</button>
        </div>
        <button class="w-full py-1.5 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-500 text-xs font-bold hover:bg-indigo-50" @click="addVisionEdge">+ Rota</button>
      </template>

      <!-- ACTION -->
      <template v-if="node.type === 'action'">
        <label class="lbl">Ação</label>
        <select v-model="d.action" class="fi" @change="emit">
          <option value="create_estimate">Criar Orçamento</option>
          <option value="generate_pix">Gerar PIX</option>
          <option value="calculate_and_pix">Calcular + PIX</option>
          <option value="notify_operator">Notificar Operador</option>
        </select>
        <template v-if="d.action === 'calculate_and_pix'">
          <label class="lbl">Nome do Produto (ERP)</label>
          <input v-model="d.productRef" class="fi" placeholder="Ex: Impressão Colorida" @input="emit" />
          <label class="lbl">Campo de quantidade</label>
          <input v-model="d.quantityField" class="fi" placeholder="Ex: pages" @input="emit" />
        </template>
        <label class="lbl">Mensagem de confirmação</label>
        <textarea v-model="d.confirmMessage" class="fi" rows="3" placeholder="Use {total}, {orderId}, {pixCode}..." @input="emit" />
      </template>

      <!-- END -->
      <template v-if="node.type === 'end'">
        <label class="lbl">Mensagem de encerramento</label>
        <textarea v-model="d.message" class="fi" rows="3" placeholder="Obrigado pelo contato! Até mais!" @input="emit" />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { nanoid } from 'nanoid'
import type { FlowNodeDef, NodeData } from '../../types/flow'

const props = defineProps<{ node: FlowNodeDef | null }>()
const emits = defineEmits<{ (e: 'update', node: FlowNodeDef): void }>()

const d = reactive<NodeData>({ label: '' })

watch(() => props.node, (n) => {
  if (!n) return
  Object.assign(d, JSON.parse(JSON.stringify(n.data)))
}, { immediate: true, deep: true })

const nodeTypeName = computed(() => {
  const map: Record<string, string> = {
    start: 'Início', triage: 'Triagem', collect: 'Coleta',
    situational: 'Situacional', choice: 'Escolha', vision: 'Visão IA',
    action: 'Ação', end: 'Fim',
  }
  return props.node ? (map[props.node.type] || props.node.type) : ''
})

function emit() {
  if (!props.node) return
  emits('update', { ...props.node, data: { ...d } })
}

function addField() { if (!d.fields) d.fields = []; d.fields.push({ name: '', type: 'text', description: '' }); emit() }
function removeField(i: number) { d.fields?.splice(i, 1); emit() }
function addOption() { if (!d.options) d.options = []; d.options.push({ id: nanoid(6), text: '' }); emit() }
function removeOption(i: number) { d.options?.splice(i, 1); emit() }
function addVisionEdge() { if (!d.edges) d.edges = []; d.edges.push({ id: nanoid(6), label: '' }); emit() }
function removeVisionEdge(i: number) { d.edges?.splice(i, 1); emit() }
</script>

<style scoped>
@reference "tailwindcss";
.lbl { @apply text-[10px] font-black text-slate-400 uppercase tracking-widest; }
.fi  { @apply w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white outline-none focus:border-indigo-400 transition-all resize-none; }
</style>
