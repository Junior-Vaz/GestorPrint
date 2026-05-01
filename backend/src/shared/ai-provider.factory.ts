import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider';

// Note: alguns providers já retornam LanguageModelV2 (futuro do AI SDK v5),
// outros ainda V1. Como `ai@4` aceita ambos em runtime, deixamos o tipo de
// retorno solto pra não brigar com TS. Quando migrarmos pra `ai@5` isso
// pode virar `LanguageModelV2` estrito.
type AiSdkModel = any;

/**
 * Factory de provedores de IA — abstrai dezenas de LLMs atrás de uma API
 * comum (Vercel AI SDK).
 *
 * Adicionar um novo provider novo é literalmente:
 *   1. Adicionar caso no switch buildModel()
 *   2. Adicionar entrada em PROVIDER_MODELS
 *   3. Adicionar URL onde o cliente pega a chave em PROVIDER_INFO
 *
 * O resto do sistema (AiChatService, ai-agent) não muda — function calling,
 * streaming, system prompts: tudo padronizado pelo SDK.
 */
export type AiProvider =
  | 'google'      // Google Gemini
  | 'openai'      // OpenAI GPT
  | 'anthropic'   // Anthropic Claude
  | 'groq'        // Groq (inferência ultra-rápida, free tier)
  | 'deepseek'    // DeepSeek (qualidade GPT-4 com custo ~10x menor)
  | 'openrouter'  // OpenRouter (agregador — 400+ modelos numa key)
  | 'ollama';     // Ollama (local — 100% grátis, requer GPU/RAM)

const VALID_PROVIDERS: readonly AiProvider[] = [
  'google', 'openai', 'anthropic', 'groq', 'deepseek', 'openrouter', 'ollama',
];

export function isValidProvider(p: string | undefined): p is AiProvider {
  return !!p && (VALID_PROVIDERS as readonly string[]).includes(p);
}

/**
 * Constrói o LanguageModel do AI SDK pra o provider escolhido.
 *
 * Notas especiais:
 *   - Ollama não usa apiKey — tudo é local. A "key" no AiConfig é ignorada
 *     (ou pode ser usada como baseURL custom se você roda Ollama remoto).
 *   - OpenRouter: o modelName segue formato "vendor/model" (ex:
 *     "google/gemini-2.0-flash:free", "anthropic/claude-3.5-sonnet").
 */
export function buildModel(
  provider: AiProvider,
  modelName: string,
  apiKey: string,
): AiSdkModel {
  // Ollama é exceção — não exige apiKey
  if (provider !== 'ollama' && !apiKey) {
    throw new Error('API key vazia — configure em IA → Configurações.');
  }

  switch (provider) {
    case 'google': {
      const g = createGoogleGenerativeAI({ apiKey: apiKey.trim() });
      return g(modelName || 'gemini-2.0-flash');
    }
    case 'openai': {
      const o = createOpenAI({ apiKey: apiKey.trim() });
      return o(modelName || 'gpt-4o-mini');
    }
    case 'anthropic': {
      const a = createAnthropic({ apiKey: apiKey.trim() });
      return a(modelName || 'claude-3-5-sonnet-20241022');
    }
    case 'groq': {
      const g = createGroq({ apiKey: apiKey.trim() });
      return g(modelName || 'llama-3.3-70b-versatile');
    }
    case 'deepseek': {
      const d = createDeepSeek({ apiKey: apiKey.trim() });
      return d(modelName || 'deepseek-chat');
    }
    case 'openrouter': {
      const r = createOpenRouter({ apiKey: apiKey.trim() });
      // Default usa um modelo free estável; o admin escolhe o real no AiView.
      return r(modelName || 'meta-llama/llama-3.3-70b-instruct:free');
    }
    case 'ollama': {
      // Em Ollama, o campo apiKey é (re)usado como baseURL custom — útil pra
      // rodar Ollama em outro host. Vazio = localhost padrão.
      const baseURL = apiKey?.trim() || 'http://localhost:11434/api';
      const o = createOllama({ baseURL });
      return o(modelName || 'llama3.2');
    }
    default:
      throw new Error(`Provider "${provider}" não suportado.`);
  }
}

/**
 * Catálogo de modelos por provider — usado pelo frontend pra popular o
 * dropdown de Modelo dinamicamente conforme o admin troca o provider.
 *
 * Mantém só os modelos que suportam function-calling (necessário pras tools).
 */
export const PROVIDER_MODELS: Record<AiProvider, ReadonlyArray<{ value: string; label: string }>> = {
  google: [
    { value: 'gemini-2.0-flash',     label: 'Gemini 2.0 Flash (rápido + barato — recomendado)' },
    { value: 'gemini-2.0-flash-001', label: 'Gemini 2.0 Flash 001' },
    { value: 'gemini-1.5-flash',     label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro',       label: 'Gemini 1.5 Pro (mais inteligente)' },
  ],
  openai: [
    { value: 'gpt-4o-mini',  label: 'GPT-4o mini (rápido + barato — recomendado)' },
    { value: 'gpt-4o',       label: 'GPT-4o (mais inteligente)' },
    { value: 'gpt-4-turbo',  label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku (rápido + barato)' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (recomendado)' },
    { value: 'claude-3-opus-20240229',     label: 'Claude 3 Opus (mais preciso, caro)' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile',  label: 'Llama 3.3 70B (recomendado — equilibrado)' },
    { value: 'llama-3.1-8b-instant',     label: 'Llama 3.1 8B (mais rápido, menos preciso)' },
    { value: 'mixtral-8x7b-32768',       label: 'Mixtral 8x7B (32k contexto)' },
    { value: 'qwen-2.5-32b',              label: 'Qwen 2.5 32B' },
    { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B (reasoning)' },
  ],
  deepseek: [
    { value: 'deepseek-chat',     label: 'DeepSeek V3 Chat (qualidade GPT-4-tier)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek R1 Reasoner (raciocínio profundo)' },
  ],
  openrouter: [
    // OpenRouter tem 400+ modelos. Os IDs free mudam com frequência —
    // se algum 404, vá em openrouter.ai/models e cole o ID exato no Prisma
    // ou amplie a lista aqui. Os pagos abaixo são estáveis.
    { value: 'deepseek/deepseek-r1-distill-llama-70b:free', label: 'DeepSeek R1 Distill 70B (FREE)' },
    { value: 'meta-llama/llama-3.3-70b-instruct:free',      label: 'Llama 3.3 70B (FREE)' },
    { value: 'qwen/qwen-2.5-72b-instruct:free',             label: 'Qwen 2.5 72B (FREE)' },
    // Paid — sempre disponíveis, custos competitivos
    { value: 'anthropic/claude-3.5-sonnet',                 label: 'Claude 3.5 Sonnet (paid)' },
    { value: 'openai/gpt-4o-mini',                          label: 'GPT-4o mini (paid)' },
    { value: 'openai/gpt-4o',                               label: 'GPT-4o (paid)' },
    { value: 'google/gemini-2.0-flash-001',                 label: 'Gemini 2.0 Flash (paid)' },
  ],
  ollama: [
    { value: 'llama3.2',     label: 'Llama 3.2 (3B — leve, ~4GB RAM)' },
    { value: 'llama3.3',     label: 'Llama 3.3 70B (~40GB RAM)' },
    { value: 'qwen2.5',      label: 'Qwen 2.5 7B (~6GB RAM)' },
    { value: 'mistral',      label: 'Mistral 7B (~5GB RAM)' },
    { value: 'deepseek-r1',  label: 'DeepSeek R1 (reasoning, ~5GB RAM)' },
  ],
} as const;

/** Info pra UI: nome bonito + URL de console pra cliente pegar a chave. */
export const PROVIDER_INFO: Record<AiProvider, { label: string; consoleUrl: string }> = {
  google:     { label: 'Google Gemini',     consoleUrl: 'https://aistudio.google.com/apikey' },
  openai:     { label: 'OpenAI (GPT)',      consoleUrl: 'https://platform.openai.com/api-keys' },
  anthropic:  { label: 'Anthropic Claude',  consoleUrl: 'https://console.anthropic.com/settings/keys' },
  groq:       { label: 'Groq (rápido)',     consoleUrl: 'https://console.groq.com/keys' },
  deepseek:   { label: 'DeepSeek (barato)', consoleUrl: 'https://platform.deepseek.com/api_keys' },
  openrouter: { label: 'OpenRouter (400+)', consoleUrl: 'https://openrouter.ai/keys' },
  ollama:     { label: 'Ollama (local)',    consoleUrl: 'https://ollama.com/download' },
};
