import { GoogleGenAI, Type } from '@google/genai';

export interface GeminiFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, any>;
}

// Map alias/old model names → current working model IDs
const MODEL_ALIASES: Record<string, string> = {
  'gemini-2.0-flash':            'gemini-3-flash-preview',
  'gemini-2.0-flash-001':        'gemini-3-flash-preview',
  'gemini-2.0-flash-lite':       'gemini-3-flash-preview',
  'gemini-2.0-flash-lite-001':   'gemini-3-flash-preview',
  'gemini-1.5-flash':            'gemini-3-flash-preview',
  'gemini-1.5-flash-002':        'gemini-3-flash-preview',
  'gemini-1.5-flash-latest':     'gemini-3-flash-preview',
  'gemini-1.5-flash-8b':         'gemini-3-flash-preview',
  'gemini-1.5-pro':              'gemini-3-flash-preview',
  'gemini-pro':                  'gemini-3-flash-preview',
};

export async function callGeminiWithFunctions(opts: {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  systemPrompt: string;
  userMessage: string;
  functions: GeminiFunction[];
  mediaBase64?: string;
  mediaMime?: string;
}): Promise<{ text: string; functionCalls: GeminiFunctionCall[] }> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey.trim() });

  const rawModel = opts.model || 'gemini-3-flash-preview';
  const model = MODEL_ALIASES[rawModel] ?? rawModel;

  const tools = opts.functions.length > 0
    ? [{ functionDeclarations: opts.functions.map(f => ({
        name: f.name,
        description: f.description,
        parameters: {
          type: Type.OBJECT,
          properties: f.parameters.properties ?? {},
          required: f.parameters.required ?? [],
        },
      })) }]
    : undefined;

  const parts: any[] = [{ text: opts.userMessage }];
  if (opts.mediaBase64 && opts.mediaMime) {
    parts.push({ inlineData: { data: opts.mediaBase64, mimeType: opts.mediaMime } });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: opts.systemPrompt,
      tools,
      maxOutputTokens: opts.maxTokens || 800,
      temperature: 1.0,
    },
  });

  const functionCalls: GeminiFunctionCall[] = [];
  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        functionCalls.push({
          name: part.functionCall.name ?? '',
          args: (part.functionCall.args as Record<string, any>) ?? {},
        });
      }
    }
  }

  // Only read response.text when there are no function calls — avoids SDK warning
  let text = '';
  if (functionCalls.length === 0) {
    try {
      text = response.text ?? '';
    } catch {
      text = '';
    }
  }

  return { text, functionCalls };
}
