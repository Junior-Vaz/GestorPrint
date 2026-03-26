<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('close')" />

      <div class="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div>
            <h2 class="text-lg font-extrabold text-slate-800 tracking-tight">Templates de Fluxo</h2>
            <p class="text-xs font-medium text-slate-400 mt-0.5">Escolha um ponto de partida e personalize no canvas</p>
          </div>
          <button @click="$emit('close')" class="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Templates grid -->
        <div class="overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="tpl in templates" :key="tpl.id"
            class="group flex flex-col gap-4 p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50 bg-white transition-all cursor-pointer"
            @click="select(tpl)"
          >
            <!-- Card header -->
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" :class="tpl.iconBg">{{ tpl.icon }}</div>
              <div class="flex-1 min-w-0">
                <h3 class="font-extrabold text-slate-800 text-sm">{{ tpl.name }}</h3>
                <p class="text-xs text-slate-400 font-medium mt-0.5">{{ tpl.description }}</p>
              </div>
              <span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest" :class="tpl.badgeCls">{{ tpl.badge }}</span>
            </div>

            <!-- Flow preview (node pills) -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <template v-for="(step, i) in tpl.steps" :key="i">
                <span class="px-2.5 py-1 rounded-lg text-[11px] font-bold" :class="step.cls">{{ step.icon }} {{ step.label }}</span>
                <svg v-if="i < tpl.steps.length - 1" class="w-3 h-3 text-slate-300 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
              </template>
            </div>

            <!-- Use button -->
            <button class="w-full py-2 rounded-xl bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white text-slate-500 text-xs font-black transition-all border border-slate-100 group-hover:border-indigo-600">
              Usar este template →
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nanoid } from 'nanoid'
import type { FlowNodeDef, FlowEdgeDef } from '../../types/flow'

const emit = defineEmits<{ (e: 'close'): void; (e: 'apply', nodes: FlowNodeDef[], edges: FlowEdgeDef[]): void }>()

interface Template {
  id: string
  name: string
  description: string
  icon: string
  iconBg: string
  badge: string
  badgeCls: string
  steps: { label: string; icon: string; cls: string }[]
  build: () => { nodes: FlowNodeDef[]; edges: FlowEdgeDef[] }
}

const templates: Template[] = [
  // ── 1. Atendimento Geral ────────────────────────────────────────────────────
  {
    id: 'general',
    name: 'Atendimento Geral',
    description: 'Mostra catálogo real do ERP, coleta dados e cria um orçamento.',
    icon: '🤖', iconBg: 'bg-indigo-50',
    badge: 'Básico', badgeCls: 'bg-slate-100 text-slate-600',
    steps: [
      { label: 'Início',    icon: '▶',  cls: 'bg-emerald-100 text-emerald-800' },
      { label: 'Triagem',   icon: '🔀', cls: 'bg-violet-100 text-violet-800' },
      { label: 'Catálogo',  icon: '🔍', cls: 'bg-amber-100 text-amber-800' },
      { label: 'Coleta',    icon: '📋', cls: 'bg-blue-100 text-blue-800' },
      { label: 'Orçamento', icon: '⚡', cls: 'bg-red-100 text-red-800' },
      { label: 'Fim',       icon: '🏁', cls: 'bg-slate-100 text-slate-600' },
    ],
    build: () => {
      const ids = { start: n('start'), triage: n('triage'), sit: n('sit'), collect: n('collect'), action: n('action'), end: n('end') }
      return {
        nodes: [
          { id: ids.start,  type: 'start',   position: { x: 300, y: 0 },   data: { label: 'Início' } },
          { id: ids.triage, type: 'triage',  position: { x: 300, y: 120 }, data: {
            label: 'Triagem',
            systemPrompt: 'Você é um atendente de gráfica. Identifique o que o cliente deseja.',
            instruction: 'Classifique: o cliente quer um orçamento ou outra coisa?',
          }},
          { id: ids.sit, type: 'situational', position: { x: 300, y: 260 }, data: {
            label: 'Catálogo de Serviços',
            erpQuery: 'inventory',
            instruction: 'Apresente os serviços disponíveis ao cliente de forma resumida e convidativa. Liste os produtos com preço.',
            systemPrompt: 'Você é um atendente de gráfica experiente. Apresente o catálogo de forma atraente e pergunte qual serviço o cliente deseja.',
          }},
          { id: ids.collect, type: 'collect', position: { x: 300, y: 440 }, data: {
            label: 'Coletar Dados',
            systemPrompt: 'Colete os dados necessários para o orçamento. Use os produtos do catálogo para validar a escolha do produto. Seja amigável e objetivo.',
            fields: [
              { name: 'nome',       type: 'text',   description: 'nome do cliente' },
              { name: 'produto',    type: 'text',   description: 'produto ou serviço escolhido (use o nome exato do catálogo)' },
              { name: 'quantidade', type: 'number', description: 'quantidade desejada' },
              { name: 'largura',    type: 'number', description: 'largura em cm (se aplicável, caso contrário pule)' },
              { name: 'altura',     type: 'number', description: 'altura em cm (se aplicável, caso contrário pule)' },
            ],
          }},
          { id: ids.action, type: 'action', position: { x: 300, y: 660 }, data: {
            label: 'Criar Orçamento',
            action: 'create_estimate',
            confirmMessage: '✅ Orçamento{id} criado com sucesso!\n\n📦 Produto: {produto}\n🔢 Quantidade: {quantidade}\n💰 Total: R$ {total}\n\n⏱️ Prazo estimado: *2 a 3 dias úteis* após confirmação.\n\nNossa equipe entrará em contato em breve para confirmar os detalhes. 😊',
          }},
          { id: ids.end, type: 'end', position: { x: 300, y: 760 }, data: {
            label: 'Fim',
            message: 'Obrigado pelo contato! Até mais! 👋',
          }},
        ],
        edges: [
          edge(ids.start, ids.triage),
          edge(ids.triage, ids.sit),
          edge(ids.sit, ids.collect),
          edge(ids.collect, ids.action),
          edge(ids.action, ids.end),
        ],
      }
    },
  },

  // ── 2. Orçamento Rápido com PIX ─────────────────────────────────────────────
  {
    id: 'quick-pix',
    name: 'Orçamento Rápido com PIX',
    description: 'Mostra catálogo real do ERP, coleta quantidade e gera PIX automaticamente.',
    icon: '⚡', iconBg: 'bg-amber-50',
    badge: 'Popular', badgeCls: 'bg-amber-100 text-amber-700',
    steps: [
      { label: 'Início',   icon: '▶',  cls: 'bg-emerald-100 text-emerald-800' },
      { label: 'Catálogo', icon: '🔍', cls: 'bg-amber-100 text-amber-800' },
      { label: 'Coleta',   icon: '📋', cls: 'bg-blue-100 text-blue-800' },
      { label: 'Calc+PIX', icon: '⚡', cls: 'bg-red-100 text-red-800' },
      { label: 'Fim',      icon: '🏁', cls: 'bg-slate-100 text-slate-600' },
    ],
    build: () => {
      const ids = { start: n('start'), sit: n('sit'), collect: n('collect'), action: n('action'), end: n('end') }
      return {
        nodes: [
          { id: ids.start, type: 'start', position: { x: 300, y: 0 }, data: { label: 'Início' } },
          { id: ids.sit, type: 'situational', position: { x: 300, y: 120 }, data: {
            label: 'Catálogo de Serviços',
            erpQuery: 'inventory',
            instruction: 'Apresente os serviços disponíveis com preço. Pergunte qual o cliente deseja.',
            systemPrompt: 'Você é um vendedor de gráfica. Mostre os serviços disponíveis de forma clara e convidativa.',
          }},
          { id: ids.collect, type: 'collect', position: { x: 300, y: 300 }, data: {
            label: 'Coletar Pedido',
            systemPrompt: 'Colete as informações para calcular o preço. Valide o produto escolhido contra o catálogo.',
            fields: [
              { name: 'produto',    type: 'text',   description: 'nome do serviço escolhido (exatamente como no catálogo)' },
              { name: 'quantidade', type: 'number', description: 'quantidade desejada' },
            ],
          }},
          { id: ids.action, type: 'action', position: { x: 300, y: 460 }, data: {
            label: 'Calcular + PIX',
            action: 'calculate_and_pix',
            productRef: 'produto',
            quantityField: 'quantidade',
            confirmMessage: '✅ Pedido gerado!\n\n💰 Total: R$ {total}\n\n🔑 PIX Copia e Cola:\n{pixCode}\n\nApós o pagamento, sua produção entra na fila automaticamente!',
          }},
          { id: ids.end, type: 'end', position: { x: 300, y: 620 }, data: {
            label: 'Fim',
            message: 'Obrigado pela preferência! Aguarde a confirmação do pagamento. 🙏',
          }},
        ],
        edges: [
          edge(ids.start, ids.sit),
          edge(ids.sit, ids.collect),
          edge(ids.collect, ids.action),
          edge(ids.action, ids.end),
        ],
      }
    },
  },

  // ── 3. Consulta de Pedido ────────────────────────────────────────────────────
  {
    id: 'order-status',
    name: 'Consulta de Status de Pedido',
    description: 'Cliente informa o número do pedido e recebe o status de produção em tempo real.',
    icon: '🔍', iconBg: 'bg-blue-50',
    badge: 'Simples', badgeCls: 'bg-blue-100 text-blue-700',
    steps: [
      { label: 'Início',      icon: '▶',  cls: 'bg-emerald-100 text-emerald-800' },
      { label: 'Coleta',      icon: '📋', cls: 'bg-blue-100 text-blue-800' },
      { label: 'Situacional', icon: '🔍', cls: 'bg-amber-100 text-amber-800' },
      { label: 'Fim',         icon: '🏁', cls: 'bg-slate-100 text-slate-600' },
    ],
    build: () => {
      const ids = { start: n('start'), collect: n('collect'), situational: n('sit'), end: n('end') }
      return {
        nodes: [
          { id: ids.start, type: 'start', position: { x: 300, y: 0 }, data: { label: 'Início' } },
          { id: ids.collect, type: 'collect', position: { x: 300, y: 120 }, data: {
            label: 'Número do Pedido',
            systemPrompt: 'Peça o número do pedido ao cliente.',
            fields: [{ name: 'orderId', type: 'number', description: 'número do pedido (ex: 123)' }],
          }},
          { id: ids.situational, type: 'situational', position: { x: 300, y: 280 }, data: {
            label: 'Status do Pedido',
            erpQuery: 'order_status',
            instruction: 'Informe o status atual do pedido ao cliente de forma clara e amigável.',
            systemPrompt: 'Você é um atendente prestativo. Explique o status do pedido de forma simples.',
          }},
          { id: ids.end, type: 'end', position: { x: 300, y: 440 }, data: {
            label: 'Fim',
            message: 'Qualquer dúvida, estamos à disposição! Até logo! 😊',
          }},
        ],
        edges: [
          edge(ids.start, ids.collect),
          edge(ids.collect, ids.situational),
          edge(ids.situational, ids.end),
        ],
      }
    },
  },

  // ── 4. Arte + Análise + PIX ──────────────────────────────────────────────────
  {
    id: 'artwork-pix',
    name: 'Recebimento de Arte + PIX',
    description: 'Analisa a arte enviada pelo cliente com IA Vision, coleta quantidade e gera PIX.',
    icon: '👁', iconBg: 'bg-indigo-50',
    badge: 'Avançado', badgeCls: 'bg-indigo-100 text-indigo-700',
    steps: [
      { label: 'Início',   icon: '▶',  cls: 'bg-emerald-100 text-emerald-800' },
      { label: 'Coleta',   icon: '📋', cls: 'bg-blue-100 text-blue-800' },
      { label: 'Visão IA', icon: '👁',  cls: 'bg-indigo-100 text-indigo-800' },
      { label: 'Coleta',   icon: '📋', cls: 'bg-blue-100 text-blue-800' },
      { label: 'PIX',      icon: '⚡', cls: 'bg-red-100 text-red-800' },
      { label: 'Fim',      icon: '🏁', cls: 'bg-slate-100 text-slate-600' },
    ],
    build: () => {
      const edgeAprovado = n('edge'), edgeReprovado = n('edge')
      const ids = { start: n('start'), collect1: n('col'), vision: n('vision'), collect2: n('col'), action: n('action'), end: n('end'), endReprov: n('end') }
      return {
        nodes: [
          { id: ids.start, type: 'start', position: { x: 300, y: 0 }, data: { label: 'Início' } },
          { id: ids.collect1, type: 'collect', position: { x: 300, y: 120 }, data: {
            label: 'Dados do Serviço',
            systemPrompt: 'Colete informações básicas do serviço.',
            fields: [
              { name: 'produto',    type: 'text',   description: 'produto desejado (ex: adesivo, banner)' },
              { name: 'quantidade', type: 'number', description: 'quantidade de peças' },
            ],
          }},
          { id: ids.vision, type: 'vision', position: { x: 300, y: 280 }, data: {
            label: 'Analisar Arte',
            systemPrompt: 'Você é um especialista em pré-impressão gráfica.',
            instruction: 'Analise a arte enviada. Verifique se a resolução é adequada para impressão (mínimo 150dpi). Extraia dimensões e modo de cor.',
            edges: [
              { id: edgeAprovado, label: 'aprovado' },
              { id: edgeReprovado, label: 'reprovado' },
            ],
          }},
          { id: ids.collect2, type: 'collect', position: { x: 150, y: 460 }, data: {
            label: 'Confirmar Dados',
            systemPrompt: 'Confirme os dados coletados antes de gerar o PIX.',
            fields: [{ name: 'confirmado', type: 'text', description: 'confirmação do cliente (ok / sim)' }],
          }},
          { id: ids.action, type: 'action', position: { x: 150, y: 600 }, data: {
            label: 'Calcular + PIX',
            action: 'calculate_and_pix',
            productRef: 'Impressão',
            quantityField: 'quantidade',
            confirmMessage: '✅ Arte aprovada!\n\n💰 Total: R$ {total}\n\n🔑 PIX:\n{pixCode}',
          }},
          { id: ids.end, type: 'end', position: { x: 150, y: 740 }, data: {
            label: 'Fim',
            message: 'Pagamento recebido! Sua arte entra em produção. Obrigado! 🎉',
          }},
          { id: ids.endReprov, type: 'end', position: { x: 480, y: 460 }, data: {
            label: 'Arte Reprovada',
            message: 'Sua arte não atende os requisitos mínimos de impressão. Por favor, envie um arquivo com maior resolução (mínimo 150dpi). 🙏',
          }},
        ],
        edges: [
          edge(ids.start, ids.collect1),
          edge(ids.collect1, ids.vision),
          edge(ids.vision, ids.collect2, edgeAprovado),
          edge(ids.vision, ids.endReprov, edgeReprovado),
          edge(ids.collect2, ids.action),
          edge(ids.action, ids.end),
        ],
      }
    },
  },

  // ── 5. Catálogo + Escolha de Material ───────────────────────────────────────
  {
    id: 'catalog-choice',
    name: 'Catálogo + Escolha de Material',
    description: 'Apresenta o catálogo do ERP, o cliente escolhe o material e fecha o pedido com PIX.',
    icon: '📦', iconBg: 'bg-emerald-50',
    badge: 'Completo', badgeCls: 'bg-emerald-100 text-emerald-700',
    steps: [
      { label: 'Início',      icon: '▶',  cls: 'bg-emerald-100 text-emerald-800' },
      { label: 'Situacional', icon: '🔍', cls: 'bg-amber-100 text-amber-800' },
      { label: 'Escolha',     icon: '🔢', cls: 'bg-orange-100 text-orange-800' },
      { label: 'Coleta',      icon: '📋', cls: 'bg-blue-100 text-blue-800' },
      { label: 'PIX',         icon: '⚡', cls: 'bg-red-100 text-red-800' },
      { label: 'Fim',         icon: '🏁', cls: 'bg-slate-100 text-slate-600' },
    ],
    build: () => {
      const opt1 = n('opt'), opt2 = n('opt'), opt3 = n('opt')
      const ids = { start: n('start'), sit: n('sit'), choice: n('choice'), collect: n('col'), action: n('action'), end: n('end') }
      return {
        nodes: [
          { id: ids.start, type: 'start', position: { x: 300, y: 0 }, data: { label: 'Início' } },
          { id: ids.sit, type: 'situational', position: { x: 300, y: 120 }, data: {
            label: 'Apresentar Catálogo',
            erpQuery: 'inventory',
            instruction: 'Apresente os serviços disponíveis ao cliente de forma resumida e convidativa.',
            systemPrompt: 'Você é um vendedor experiente de gráfica. Apresente o catálogo de forma atraente.',
          }},
          { id: ids.choice, type: 'choice', position: { x: 300, y: 300 }, data: {
            label: 'Escolher Serviço',
            question: 'Qual serviço te interessa?',
            options: [
              { id: opt1, text: 'Banner / Lona' },
              { id: opt2, text: 'Adesivo' },
              { id: opt3, text: 'Impressão Digital' },
            ],
          }},
          { id: ids.collect, type: 'collect', position: { x: 300, y: 480 }, data: {
            label: 'Coletar Dados',
            systemPrompt: 'Colete as informações para calcular o preço.',
            fields: [
              { name: 'quantidade', type: 'number', description: 'quantidade desejada' },
              { name: 'largura',    type: 'number', description: 'largura em metros' },
              { name: 'altura',     type: 'number', description: 'altura em metros' },
            ],
          }},
          { id: ids.action, type: 'action', position: { x: 300, y: 640 }, data: {
            label: 'Gerar PIX',
            action: 'calculate_and_pix',
            productRef: 'Banner',
            quantityField: 'quantidade',
            confirmMessage: '✅ Pedido criado!\n💰 Total: R$ {total}\n\n🔑 PIX:\n{pixCode}\n\nProdução inicia após confirmação do pagamento!',
          }},
          { id: ids.end, type: 'end', position: { x: 300, y: 800 }, data: {
            label: 'Fim',
            message: 'Muito obrigado! Acompanhe seu pedido pelo sistema. 🚀',
          }},
        ],
        edges: [
          edge(ids.start, ids.sit),
          edge(ids.sit, ids.choice),
          edge(ids.choice, ids.collect, opt1),
          edge(ids.choice, ids.collect, opt2),
          edge(ids.choice, ids.collect, opt3),
          edge(ids.collect, ids.action),
          edge(ids.action, ids.end),
        ],
      }
    },
  },

  // ── 6. Notificação para Operador ─────────────────────────────────────────────
  {
    id: 'notify',
    name: 'Captação + Notificar Operador',
    description: 'Coleta os dados do cliente e notifica a equipe interna para retorno personalizado.',
    icon: '📣', iconBg: 'bg-rose-50',
    badge: 'Simples', badgeCls: 'bg-rose-100 text-rose-700',
    steps: [
      { label: 'Início',   icon: '▶',  cls: 'bg-emerald-100 text-emerald-800' },
      { label: 'Triagem',  icon: '🔀', cls: 'bg-violet-100 text-violet-800' },
      { label: 'Coleta',   icon: '📋', cls: 'bg-blue-100 text-blue-800' },
      { label: 'Notifica', icon: '⚡', cls: 'bg-red-100 text-red-800' },
      { label: 'Fim',      icon: '🏁', cls: 'bg-slate-100 text-slate-600' },
    ],
    build: () => {
      const ids = { start: n('start'), triage: n('triage'), collect: n('col'), action: n('action'), end: n('end') }
      return {
        nodes: [
          { id: ids.start, type: 'start', position: { x: 300, y: 0 }, data: { label: 'Início' } },
          { id: ids.triage, type: 'triage', position: { x: 300, y: 120 }, data: {
            label: 'Triagem',
            systemPrompt: 'Você é um atendente de gráfica.',
            instruction: 'Identifique brevemente o que o cliente precisa e direcione para coleta de dados.',
          }},
          { id: ids.collect, type: 'collect', position: { x: 300, y: 280 }, data: {
            label: 'Dados de Contato',
            systemPrompt: 'Colete os dados para a equipe entrar em contato.',
            fields: [
              { name: 'nome',     type: 'text', description: 'nome completo' },
              { name: 'telefone', type: 'text', description: 'número de telefone ou WhatsApp' },
              { name: 'servico',  type: 'text', description: 'serviço que precisa' },
            ],
          }},
          { id: ids.action, type: 'action', position: { x: 300, y: 440 }, data: {
            label: 'Notificar Equipe',
            action: 'notify_operator',
            confirmMessage: 'Perfeito! Recebemos seu contato e nossa equipe especializada vai te chamar em breve. 😊',
          }},
          { id: ids.end, type: 'end', position: { x: 300, y: 580 }, data: {
            label: 'Fim',
            message: 'Obrigado! Em breve nossa equipe entrará em contato. Até logo! 👋',
          }},
        ],
        edges: [
          edge(ids.start, ids.triage),
          edge(ids.triage, ids.collect),
          edge(ids.collect, ids.action),
          edge(ids.action, ids.end),
        ],
      }
    },
  },
]

function n(prefix: string) { return `${prefix}-${nanoid(6)}` }

function edge(source: string, target: string, sourceHandle?: string): FlowEdgeDef {
  return { id: `e-${nanoid(6)}`, source, target, sourceHandle: sourceHandle ?? null, label: '' }
}

function select(tpl: Template) {
  const { nodes, edges } = tpl.build()
  emit('apply', nodes, edges)
  emit('close')
}
</script>
