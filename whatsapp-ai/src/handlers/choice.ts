import { FlowNode, FlowEdge, FlowSession, AiConfig, ChoiceNodeData, HandlerResult } from '../types/flow.js';
import { callGeminiWithFunctions } from '../agent/gemini.js';

export async function handleChoice(
  node: FlowNode,
  edges: FlowEdge[],
  session: FlowSession,
  text: string,
  cfg: AiConfig,
): Promise<HandlerResult> {
  const data = node.data as ChoiceNodeData;
  const options = data.options || [];

  if (options.length === 0) {
    const nextEdge = edges[0];
    return { responseText: '', nextNodeId: nextEdge?.target ?? null };
  }

  // Build numbered list
  const listText = options.map((o, i) => `${i + 1}. ${o.text}`).join('\n');

  // Step 1: If we haven't sent the list yet, send it
  if (session.pendingChoice !== node.id) {
    const questionText = data.question
      ? `${data.question}\n\n${listText}`
      : `Escolha uma opção:\n\n${listText}`;

    return {
      responseText: questionText,
      nextNodeId: null,
      setPendingChoice: node.id,
    };
  }

  // Step 2: List was already sent — map client response to an option via Gemini
  const optionsContext = options.map((o, i) => `${i + 1}. ID "${o.id}": ${o.text}`).join('\n');

  const { functionCalls } = await callGeminiWithFunctions({
    apiKey: cfg.geminiKey,
    model: cfg.geminiModel || 'gemini-1.5-flash',
    maxTokens: 200,
    systemPrompt: 'Você é um assistente que identifica qual opção de uma lista o cliente escolheu.',
    userMessage: `O cliente recebeu esta lista de opções:\n${optionsContext}\n\nO cliente respondeu: "${text}"\n\nUse select_option para indicar qual opção foi escolhida pelo ID.`,
    functions: [
      {
        name: 'select_option',
        description: 'Seleciona a opção que o cliente escolheu.',
        parameters: {
          type: 'object',
          properties: {
            optionId: {
              type: 'string',
              description: 'O ID da opção selecionada.',
            },
          },
          required: ['optionId'],
        },
      },
    ],
  });

  const call = functionCalls.find(c => c.name === 'select_option');
  if (call?.args?.optionId) {
    const optionId = call.args.optionId;

    // Find edge with sourceHandle matching this option id
    const chosenEdge = edges.find(e => e.sourceHandle === optionId);
    if (chosenEdge) {
      return {
        responseText: '',
        nextNodeId: chosenEdge.target,
        clearPendingChoice: true,
        updatedData: { _lastChoice: optionId },
      };
    }

    // Fallback: find the option index and use positional edge
    const optionIndex = options.findIndex(o => o.id === optionId);
    if (optionIndex >= 0 && edges[optionIndex]) {
      return {
        responseText: '',
        nextNodeId: edges[optionIndex].target,
        clearPendingChoice: true,
        updatedData: { _lastChoice: optionId },
      };
    }
  }

  // Didn't understand — show list again
  const listAgain = options.map((o, i) => `${i + 1}. ${o.text}`).join('\n');
  return {
    responseText: `Não entendi sua resposta. Por favor, escolha digitando o número:\n\n${listAgain}`,
    nextNodeId: null,
    // Keep pendingChoice set
  };
}
