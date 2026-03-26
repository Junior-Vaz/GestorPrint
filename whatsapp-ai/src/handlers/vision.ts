import { FlowNode, FlowEdge, FlowSession, AiConfig, VisionNodeData, HandlerResult } from '../types/flow.js';
import { callGeminiWithFunctions } from '../agent/gemini.js';

export async function handleVision(
  node: FlowNode,
  edges: FlowEdge[],
  session: FlowSession,
  text: string,
  cfg: AiConfig,
  mediaBase64?: string,
  mediaMime?: string,
): Promise<HandlerResult> {
  const data = node.data as VisionNodeData;

  if (!mediaBase64 || !mediaMime) {
    // No media received — ask the client to send the file
    return {
      responseText: 'Por favor, envie o arquivo ou imagem para que possamos analisá-lo.',
      nextNodeId: null,
    };
  }

  const edgeOptions = (data.edges || []).map(e => {
    const flowEdge = edges.find(fe => fe.sourceHandle === e.id);
    return {
      edgeId: e.id,
      target: flowEdge?.target,
      label: e.label,
    };
  }).filter(e => e.target);

  // If no named edges configured, fall back to single output edge
  if (edgeOptions.length === 0 && edges.length > 0) {
    edgeOptions.push({ edgeId: edges[0].id, target: edges[0].target, label: 'próximo' });
  }

  const systemPrompt = data.systemPrompt ||
    'Você é um especialista em análise de arquivos gráficos e documentos.';

  const instruction = data.instruction ||
    'Analise o arquivo enviado e extraia as informações relevantes.';

  const edgesContext = edgeOptions.length > 1
    ? `\nRotas disponíveis após análise:\n${edgeOptions.map(e => `- ID "${e.edgeId}": ${e.label}`).join('\n')}\n\nUse route_by_quality para escolher a rota adequada.`
    : '';

  const functions: any[] = [
    {
      name: 'extract_file_metadata',
      description: 'Extrai metadados do arquivo analisado (dimensões, cores, páginas, resolução, etc.).',
      parameters: {
        type: 'object',
        properties: {
          pages: { type: 'number', description: 'Número de páginas (para documentos).' },
          colorMode: { type: 'string', description: 'Modo de cor: "color", "grayscale" ou "blackwhite".' },
          width: { type: 'number', description: 'Largura em pixels ou cm.' },
          height: { type: 'number', description: 'Altura em pixels ou cm.' },
          dpi: { type: 'number', description: 'Resolução em DPI.' },
          notes: { type: 'string', description: 'Observações importantes sobre o arquivo.' },
        },
        required: [],
      },
    },
  ];

  if (edgeOptions.length > 1) {
    functions.push({
      name: 'route_by_quality',
      description: 'Escolhe a rota do fluxo com base na qualidade ou resultado da análise.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'ID da edge/rota a seguir.' },
          reason: { type: 'string', description: 'Motivo da escolha.' },
        },
        required: ['edgeId'],
      },
    });
  }

  const userMessage = `${instruction}${edgesContext}\n\nMensagem do cliente: "${text || 'arquivo enviado'}"
\nAnalise o arquivo e:
1. Chame extract_file_metadata com os dados extraídos.
${edgeOptions.length > 1 ? '2. Chame route_by_quality para escolher a rota.' : ''}
Depois, responda ao cliente com um resumo amigável da análise.`;

  const { text: responseText, functionCalls } = await callGeminiWithFunctions({
    apiKey: cfg.geminiKey,
    model: cfg.geminiModel || 'gemini-1.5-flash',
    maxTokens: cfg.maxTokens,
    systemPrompt,
    userMessage,
    functions,
    mediaBase64,
    mediaMime,
  });

  // Extract metadata
  const metaCall = functionCalls.find(c => c.name === 'extract_file_metadata');
  const metadata = metaCall?.args || {};

  // Extract route
  const routeCall = functionCalls.find(c => c.name === 'route_by_quality');
  let nextNodeId: string | null = null;

  if (routeCall?.args?.edgeId) {
    const chosen = edgeOptions.find(e => e.edgeId === routeCall.args.edgeId);
    if (chosen?.target) nextNodeId = chosen.target;
  }

  // Fallback to first edge if no routing was done
  if (!nextNodeId && edges.length > 0) {
    nextNodeId = edges[0].target;
  }

  return {
    responseText: responseText || 'Arquivo analisado com sucesso!',
    nextNodeId,
    updatedData: { fileMetadata: metadata },
  };
}
