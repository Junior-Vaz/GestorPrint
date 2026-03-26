import { FlowNode, FlowEdge, FlowSession, AiConfig, CollectNodeData, CollectField, HandlerResult } from '../types/flow.js';
import { callGeminiWithFunctions } from '../agent/gemini.js';

export async function handleCollect(
  node: FlowNode,
  edges: FlowEdge[],
  session: FlowSession,
  text: string,
  cfg: AiConfig,
): Promise<HandlerResult> {
  // Use message preserved from a situational/choice silent advance if current text is empty
  const effectiveText = text.trim() || (session.collectedData._pendingMessage as string) || '';
  text = effectiveText;
  const data = node.data as CollectNodeData;
  const fields = data.fields || [];

  if (fields.length === 0) {
    const nextEdge = edges[0];
    return { responseText: '', nextNodeId: nextEdge?.target ?? null };
  }

  // Find which fields are still missing from collectedData
  const missing = fields.filter(f => session.collectedData[f.name] === undefined || session.collectedData[f.name] === null);

  // Build submit_data function schema from all fields
  const properties: Record<string, any> = {};
  for (const f of fields) {
    properties[f.name] = {
      type: f.type === 'number' ? 'number' : 'string',
      description: f.description,
    };
  }

  const systemPrompt = data.systemPrompt ||
    'Você é um assistente de coleta de dados. Extraia as informações solicitadas da mensagem do cliente de forma amigável.';

  const alreadyCollected = fields
    .filter(f => session.collectedData[f.name] !== undefined)
    .map(f => `${f.name}: ${session.collectedData[f.name]}`);

  // Include real inventory if available (saved by situational node)
  const inventory = session.collectedData._inventory;
  const inventoryContext = Array.isArray(inventory) && inventory.length > 0
    ? `\nServiços/produtos disponíveis no sistema (use exatamente estes nomes ao salvar o campo "produto" ou "serviço"):\n${inventory.map((p: any) => `- ${p.name}${p.price != null ? ` (R$ ${Number(p.price).toFixed(2)})` : ''}`).join('\n')}\n`
    : '';

  const context = `Você precisa coletar as seguintes informações:
${fields.map(f => `- ${f.name} (${f.type}): ${f.description}`).join('\n')}
${inventoryContext}
${alreadyCollected.length > 0 ? `Já coletado:\n${alreadyCollected.join('\n')}\n` : ''}
${missing.length > 0 ? `Ainda faltam: ${missing.map(f => f.name).join(', ')}` : 'Todos os dados coletados.'}

Analise a mensagem do cliente. Se conseguir extrair os dados faltantes, chame submit_data com os valores encontrados.
Se não conseguir extrair, faça uma pergunta amigável para obter o próximo dado faltante.`;

  const { text: responseText, functionCalls } = await callGeminiWithFunctions({
    apiKey: cfg.geminiKey,
    model: cfg.geminiModel || 'gemini-1.5-flash',
    maxTokens: cfg.maxTokens,
    systemPrompt,
    userMessage: `${context}\n\nMensagem do cliente: "${text}"`,
    functions: [
      {
        name: 'submit_data',
        description: 'Submete os dados coletados do cliente. Chame apenas quando tiver extraído ao menos um campo.',
        parameters: {
          type: 'object',
          properties,
          required: [],
        },
      },
    ],
  });

  const call = functionCalls.find(c => c.name === 'submit_data');
  if (call?.args) {
    // Filter out undefined/null values
    const newData: Record<string, any> = {};
    for (const [k, v] of Object.entries(call.args)) {
      if (v !== undefined && v !== null && v !== '') {
        newData[k] = v;
      }
    }

    const merged = { ...session.collectedData, ...newData };

    // Check if all required fields are now collected
    const stillMissing = fields.filter(f => merged[f.name] === undefined || merged[f.name] === null);

    if (stillMissing.length === 0) {
      const nextEdge = edges[0];
      return {
        responseText: responseText || '',
        nextNodeId: nextEdge?.target ?? null,
        updatedData: { ...newData, _pendingMessage: null },
      };
    }

    const askFor = stillMissing[0];
    const askText = responseText || `Por favor, informe ${askFor.description}.`;
    return {
      responseText: askText,
      nextNodeId: null,
      updatedData: { ...newData, _pendingMessage: null },
    };
  }

  // No function call — Gemini asked a question, stay on node
  return {
    responseText: responseText || `Por favor, informe ${missing[0]?.description || 'os dados solicitados'}.`,
    nextNodeId: null,
  };
}
