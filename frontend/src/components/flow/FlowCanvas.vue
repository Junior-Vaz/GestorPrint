<template>
  <div class="w-full h-full" @drop="onDrop" @dragover.prevent>
    <VueFlow
      id="gestorprint-flow"
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      fit-view-on-init
      @connect="onConnect"
      @node-click="onNodeClick"
      @pane-click="$emit('deselect')"
    >
      <Background pattern-color="#e2e8f0" :gap="20" />
      <Controls />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { nanoid } from 'nanoid'
import type { FlowNodeDef, FlowEdgeDef, NodeType } from '../../types/flow'

import StartNode       from './nodes/StartNode.vue'
import TriageNode      from './nodes/TriageNode.vue'
import CollectNode     from './nodes/CollectNode.vue'
import SituationalNode from './nodes/SituationalNode.vue'
import ChoiceNode      from './nodes/ChoiceNode.vue'
import VisionNode      from './nodes/VisionNode.vue'
import ActionNode      from './nodes/ActionNode.vue'
import EndNode         from './nodes/EndNode.vue'

const nodeTypes = {
  start:       markRaw(StartNode),
  triage:      markRaw(TriageNode),
  collect:     markRaw(CollectNode),
  situational: markRaw(SituationalNode),
  choice:      markRaw(ChoiceNode),
  vision:      markRaw(VisionNode),
  action:      markRaw(ActionNode),
  end:         markRaw(EndNode),
}

const props = defineProps<{
  initialNodes: FlowNodeDef[]
  initialEdges: FlowEdgeDef[]
}>()

const emits = defineEmits<{
  (e: 'node-select', node: FlowNodeDef): void
  (e: 'deselect'): void
}>()

// useVueFlow com mesmo id do <VueFlow> para garantir mesma instância
const { screenToFlowCoordinate } = useVueFlow('gestorprint-flow')

// nodes e edges são a fonte de verdade — não usar getNodes/getEdges
const nodes = ref<any[]>(props.initialNodes)
const edges = ref<any[]>(props.initialEdges)

function onDrop(event: DragEvent) {
  const type = event.dataTransfer?.getData('application/vueflow') as NodeType
  if (!type) return

  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  const id = `${type}-${nanoid(6)}`
  const defaultData: Record<string, any> = { label: type.charAt(0).toUpperCase() + type.slice(1) }

  if (type === 'collect')     defaultData.fields  = []
  if (type === 'choice')      defaultData.options = []
  if (type === 'vision')      defaultData.edges   = []
  if (type === 'action')      defaultData.action  = 'create_estimate'
  if (type === 'situational') defaultData.erpQuery = 'inventory'

  nodes.value = [...nodes.value, { id, type, data: defaultData, position }]
}

function onConnect(params: any) {
  edges.value = [...edges.value, {
    id: `e-${nanoid(6)}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? null,
    targetHandle: params.targetHandle ?? null,
    label: '',
  }]
}

function onNodeClick({ node }: { node: any }) {
  emits('node-select', node as FlowNodeDef)
}

function updateNodeData(updated: FlowNodeDef) {
  const idx = nodes.value.findIndex(n => n.id === updated.id)
  if (idx >= 0) {
    nodes.value[idx] = { ...nodes.value[idx], data: { ...updated.data } }
  }
}

defineExpose({
  updateNodeData,
  getFlowData: () => ({
    nodes: nodes.value.map((n: any) => ({
      id: n.id,
      type: n.type,
      data: n.data,
      position: n.position,
    })),
    edges: edges.value.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      label: e.label ?? '',
    })),
  }),
})
</script>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
</style>
