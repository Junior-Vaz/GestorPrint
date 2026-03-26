export type NodeType =
  | 'start'
  | 'triage'
  | 'collect'
  | 'situational'
  | 'choice'
  | 'vision'
  | 'action'
  | 'end';

export interface FlowNode {
  id: string;
  type: NodeType;
  data: NodeData;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null; // used by choice + triage nodes
  label?: string;
}

// ── Per-node data shapes ──────────────────────────────────────────────────────

export interface StartNodeData {
  label: string;
}

export interface TriageNodeData {
  label: string;
  systemPrompt: string;
  instruction: string;
}

export interface CollectField {
  name: string;
  type: 'text' | 'number';
  description: string;
}

export interface CollectNodeData {
  label: string;
  systemPrompt: string;
  fields: CollectField[];
}

export type ErpQuery = 'inventory' | 'order_status';

export interface SituationalNodeData {
  label: string;
  erpQuery: ErpQuery;
  instruction: string;
  systemPrompt: string;
}

export interface ChoiceOption {
  id: string;
  text: string;
}

export interface ChoiceNodeData {
  label: string;
  question: string;
  options: ChoiceOption[];
}

export interface VisionEdgeOption {
  id: string;  // matches sourceHandle
  label: string;
}

export interface VisionNodeData {
  label: string;
  instruction: string;
  systemPrompt: string;
  edges: VisionEdgeOption[]; // named edges configured in inspector
}

export type ActionType =
  | 'create_estimate'
  | 'generate_pix'
  | 'calculate_and_pix'
  | 'notify_operator';

export interface ActionNodeData {
  label: string;
  action: ActionType;
  confirmMessage: string;
  // Only for calculate_and_pix:
  productRef?: string;    // product name in ERP
  quantityField?: string; // key in collectedData that holds quantity
}

export interface EndNodeData {
  label: string;
  message: string;
}

export type NodeData =
  | StartNodeData
  | TriageNodeData
  | CollectNodeData
  | SituationalNodeData
  | ChoiceNodeData
  | VisionNodeData
  | ActionNodeData
  | EndNodeData;

// ── Flow config loaded from ERP ───────────────────────────────────────────────

export interface FlowConfig {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ── Session persisted in ERP DB ───────────────────────────────────────────────

export interface FlowSession {
  currentNodeId: string;
  collectedData: Record<string, any>;
  pendingChoice?: string | null; // nodeId of choice awaiting response
  pendingSituational?: string | null; // nodeId of situational that already responded
}

// ── AI config from ERP ────────────────────────────────────────────────────────

export interface AiConfig {
  enabled: boolean;
  geminiKey: string;
  geminiModel: string;
  maxTokens: number;
  evolutionUrl: string;
  evolutionKey: string;
  evolutionInstance: string;
  agentPrompt: string;
  allowFileUploads: boolean;
  tenantId: number;
}

// ── Handler result ────────────────────────────────────────────────────────────

export interface HandlerResult {
  responseText: string;
  nextNodeId: string | null; // null = stay on current node
  updatedData?: Record<string, any>; // merged into session.collectedData
  clearPendingChoice?: boolean;
  setPendingChoice?: string;
  clearPendingSituational?: boolean;
  setPendingSituational?: string;
}
