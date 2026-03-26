export type NodeType =
  | 'start'
  | 'triage'
  | 'collect'
  | 'situational'
  | 'choice'
  | 'vision'
  | 'action'
  | 'end'

export interface CollectField {
  name: string
  type: 'text' | 'number'
  description: string
}

export interface ChoiceOption {
  id: string
  text: string
}

export interface VisionEdgeOption {
  id: string
  label: string
}

export type ErpQuery = 'inventory' | 'order_status'

export type ActionType =
  | 'create_estimate'
  | 'generate_pix'
  | 'calculate_and_pix'
  | 'notify_operator'

export interface NodeData {
  label: string
  // triage
  systemPrompt?: string
  instruction?: string
  // collect
  fields?: CollectField[]
  // situational
  erpQuery?: ErpQuery
  // choice
  question?: string
  options?: ChoiceOption[]
  // vision
  edges?: VisionEdgeOption[]
  // action
  action?: ActionType
  confirmMessage?: string
  productRef?: string
  quantityField?: string
  // end
  message?: string
}

export interface FlowNodeDef {
  id: string
  type: NodeType
  data: NodeData
  position: { x: number; y: number }
}

export interface FlowEdgeDef {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  label?: string
}
