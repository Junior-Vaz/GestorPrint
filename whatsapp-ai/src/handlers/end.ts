import { FlowNode, EndNodeData, HandlerResult } from '../types/flow.js';

export async function handleEnd(node: FlowNode): Promise<HandlerResult> {
  const data = node.data as EndNodeData;
  return {
    responseText: data.message || 'Obrigado pelo contato! Até mais!',
    nextNodeId: null,
  };
}
