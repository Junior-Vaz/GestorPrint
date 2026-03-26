import { FlowNode, FlowEdge, FlowSession, AiConfig, TriageNodeData, HandlerResult } from '../types/flow.js';
import { callGeminiWithFunctions } from '../agent/gemini.js';

export async function handleTriage(
  node: FlowNode,
  edges: FlowEdge[],
  session: FlowSession,
  text: string,
  cfg: AiConfig,
): Promise<HandlerResult> {
  const data = node.data as TriageNodeData;

  if (edges.length === 0) {
    return { responseText: 'Fluxo de triagem sem saídas configuradas.', nextNodeId: null };
  }

  // Build edge options context for Gemini
  const edgeOptions = edges.map(e => ({
    edgeId: e.id,
    target: e.target,
    label: e.label || e.id,
  }));

  const systemPrompt = data.systemPrompt ||
    'Você é um assistente de triagem. Analise a mensagem do cliente e escolha o caminho correto do fluxo.';

  const instruction = data.instruction || 'Identifique a intenção do cliente e escolha a rota adequada.';

  const context = `${instruction}

Rotas disponíveis:
${edgeOptions.map(e => `- ID "${e.edgeId}": ${e.label}`).join('\n')}

Use a função choose_route para selecionar a rota correta com base na mensagem do cliente.`;

  const { functionCalls } = await callGeminiWithFunctions({
    apiKey: cfg.geminiKey,
    model: cfg.geminiModel || 'gemini-1.5-flash',
    maxTokens: cfg.maxTokens,
    systemPrompt,
    userMessage: `${context}\n\nMensagem do cliente: "${text}"`,
    functions: [
      {
        name: 'choose_route',
        description: 'Seleciona a rota/edge correta do fluxo com base na intenção do cliente.',
        parameters: {
          type: 'object',
          properties: {
            edgeId: {
              type: 'string',
              description: 'O ID da edge a seguir.',
            },
          },
          required: ['edgeId'],
        },
      },
    ],
  });

  const call = functionCalls.find(c => c.name === 'choose_route');
  if (call?.args?.edgeId) {
    const chosen = edgeOptions.find(e => e.edgeId === call.args.edgeId);
    if (chosen) {
      return { responseText: '', nextNodeId: chosen.target };
    }
  }

  // Fallback: use first edge
  console.warn('[TRIAGE] choose_route not called or invalid edgeId, using first edge');
  return { responseText: '', nextNodeId: edges[0].target };
}
