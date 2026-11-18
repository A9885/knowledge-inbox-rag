// Which API serves embeddings and which serves chat, from the environment.
//   Default      : GEMINI_API_KEY only. Gemini embeds; chat uses NVIDIA when NVIDIA_API_KEY is set, else Gemini.
//   One API      : AI_BASE_URL + AI_API_KEY (any OpenAI-compatible service) for both jobs, plus EMBEDDING_MODEL and CHAT_MODEL.
//   Two APIs     : EMBEDDING_BASE_URL/_API_KEY/_MODEL for embeddings and CHAT_BASE_URL/_API_KEY/_MODEL for chat. Each one falls back to AI_*.
export const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const DEFAULT_BATCH = 100; // Gemini accepts at most 100 inputs per embedding request

export interface ProviderEnv {
  GEMINI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  EMBEDDING_BASE_URL?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_BATCH?: number;
  CHAT_BASE_URL?: string;
  CHAT_API_KEY?: string;
  CHAT_MODEL?: string;
}
export interface Endpoint {
  baseURL: string;
  apiKey: string;
  model: string;
}

const v = (s?: string) => s?.trim() || undefined; // an empty line in .env counts as not set

export function embeddingProvider(c: ProviderEnv): Endpoint & { batch: number } {
  const baseURL = v(c.EMBEDDING_BASE_URL) ?? v(c.AI_BASE_URL) ?? GEMINI_URL;
  const apiKey = v(c.EMBEDDING_API_KEY) ?? v(c.AI_API_KEY) ?? v(c.GEMINI_API_KEY) ?? "";
  return { baseURL, apiKey, model: v(c.EMBEDDING_MODEL) ?? DEFAULT_EMBEDDING_MODEL, batch: c.EMBEDDING_BATCH ?? DEFAULT_BATCH };
}

/** The chat API when one is configured explicitly; null means the built-in NVIDIA / Gemini choice. */
export function customChat(c: ProviderEnv): Endpoint | null {
  const baseURL = v(c.CHAT_BASE_URL) ?? v(c.AI_BASE_URL);
  if (!baseURL) return null;
  return { baseURL, apiKey: v(c.CHAT_API_KEY) ?? v(c.AI_API_KEY) ?? "", model: v(c.CHAT_MODEL) ?? "" };
}

/** What is wrong with the setup, in words a person can act on. Empty = fine. */
export function providerProblems(c: ProviderEnv): string[] {
  const out: string[] = [];
  const e = embeddingProvider(c);
  if (!e.apiKey) out.push("No embedding key. Set GEMINI_API_KEY, or AI_API_KEY, or EMBEDDING_API_KEY (copy .env.example to .env).");
  if (e.baseURL !== GEMINI_URL && !v(c.EMBEDDING_MODEL)) out.push("EMBEDDING_MODEL is required when embeddings do not use Gemini.");
  const chat = customChat(c);
  if (chat && !chat.apiKey) out.push("No chat key. Set AI_API_KEY or CHAT_API_KEY.");
  if (chat && !chat.model) out.push("CHAT_MODEL is required when AI_BASE_URL or CHAT_BASE_URL is set.");
  return out;
}
