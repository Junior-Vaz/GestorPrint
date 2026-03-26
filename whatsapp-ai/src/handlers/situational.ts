import axios from 'axios';
import { FlowNode, FlowEdge, FlowSession, AiConfig, SituationalNodeData, HandlerResult } from '../types/flow.js';
import { callGeminiWithFunctions } from '../agent/gemini.js';


export async function handleSituational(
  node: FlowNode,
  edges: FlowEdge[],
  session: FlowSession,
  text: string,
  cfg: AiConfig,
  erpUrl: string,
): Promise<HandlerResult> {
  const data = node.data as SituationalNodeData;
  const tenantId = cfg.tenantId;

  // If already presented info (pendingSituational = this node's id), advance on next message
  if (session.pendingSituational === node.id) {
    const nextEdge = edges[0];
    return {
      responseText: '',
      nextNodeId: nextEdge?.target ?? null,
      clearPendingSituational: true,
      // Preserve the client's message so the next node (collect/choice) can use it
      updatedData: { _pendingMessage: text },
    };
  }

  // Fetch ERP data
  let erpData: any = {};
  try {
    if (data.erpQuery === 'inventory') {
      const rpcRes = await axios.post(`${erpUrl}/mcp/rpc`, {
        method: 'tools/call',
        params: { name: 'get_inventory', arguments: {} },
        tenantId,
      });
      const rpcData = rpcRes.data as any;
      erpData = rpcData?.content?.[0]?.text;
      if (erpData) erpData = JSON.parse(erpData);
    } else if (data.erpQuery === 'order_status') {
      const orderId = session.collectedData?.orderId;
      if (orderId) {
        const rpcRes = await axios.post(`${erpUrl}/mcp/rpc`, {
          method: 'tools/call',
          params: { name: 'get_order_status', arguments: { orderId: Number(orderId) } },
          tenantId,
        });
        const rpcData2 = rpcRes.data as any;
        erpData = rpcData2?.content?.[0]?.text;
        if (erpData) erpData = JSON.parse(erpData);
      }
    }
  } catch (e: any) {
    console.error('[SITUATIONAL] Failed to fetch ERP data:', e.message);
    erpData = {};
  }

  const systemPrompt = data.systemPrompt ||
    'Você é um assistente que apresenta informações do sistema de forma amigável ao cliente.';

  const instruction = data.instruction || 'Apresente as informações disponíveis ao cliente de forma clara e amigável.';

  const erpContext = erpData
    ? `Dados do sistema:\n${JSON.stringify(erpData, null, 2)}`
    : 'Nenhum dado disponível no momento.';

  const { text: responseText } = await callGeminiWithFunctions({
    apiKey: cfg.geminiKey,
    model: cfg.geminiModel || 'gemini-1.5-flash',
    maxTokens: cfg.maxTokens,
    systemPrompt,
    userMessage: `${instruction}\n\n${erpContext}\n\nMensagem do cliente: "${text}"`,
    functions: [],
  });

  // Save inventory to session so collect/choice nodes can reference real products
  const updatedData: Record<string, any> = {};
  if (data.erpQuery === 'inventory' && Array.isArray(erpData)) {
    updatedData._inventory = erpData;
  }

  return {
    responseText: responseText || 'Aqui estão as informações disponíveis no momento.',
    nextNodeId: null,
    setPendingSituational: node.id,
    updatedData,
  };
}
