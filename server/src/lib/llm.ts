import OpenAI from "openai";
import { config } from "../config.js";
import { log } from "./logger.js";

// The only file that talks to the LLM provider (Gemini, via its OpenAI-compatible API).
// Embeddings always use Gemini; chat uses NVIDIA NIM when NVIDIA_API_KEY is set.
let gemini: OpenAI | undefined;
let nvidia: OpenAI | undefined;
const api = () =>
  (gemini ??= new OpenAI({
    apiKey: config.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  }));
const chatApi = () =>
  config.NVIDIA_API_KEY
    ? (nvidia ??= new OpenAI({ apiKey: config.NVIDIA_API_KEY, baseURL: "https://integrate.api.nvidia.com/v1" }))
    : api();
const chatModel = () =>
  config.CHAT_MODEL ?? (config.NVIDIA_API_KEY ? "poolside/laguna-xs-2.1" : "gemini-3.1-flash-lite");

const MAX_TOKENS = 700;
const BATCH = 100; // Gemini embeddings accept at most 100 inputs per request

export async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const res = await api().embeddings.create({ model: config.EMBEDDING_MODEL, input: texts.slice(i, i + BATCH) });
    out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return out;
}

const FALLBACK_MODEL = "gemini-3.1-flash-lite"; // used when the NVIDIA model has been retired

type Target = { client: OpenAI; model: string };
const primary = (): Target => ({ client: chatApi(), model: chatModel() });
const fallback = (): Target | null => (config.NVIDIA_API_KEY ? { client: api(), model: FALLBACK_MODEL } : null);

/** 404/410 from the provider means the model no longer exists. */
const modelGone = (e: unknown) => [404, 410].includes((e as { status?: number })?.status ?? 0);
const switching = (from: Target, e: unknown) =>
  log.warn({ model: from.model, status: (e as { status?: number }).status, fallback: FALLBACK_MODEL }, "llm.model_unavailable");

const messages = (system: string, user: string) => [
  { role: "system" as const, content: system },
  { role: "user" as const, content: user },
];

async function complete(t: Target, system: string, user: string): Promise<string> {
  const res = await t.client.chat.completions.create({ model: t.model, temperature: 0, max_tokens: MAX_TOKENS, messages: messages(system, user) });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

async function* streamFrom(t: Target, system: string, user: string): AsyncGenerator<string> {
  const stream = await t.client.chat.completions.create({
    model: t.model,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    stream: true,
    messages: messages(system, user),
  });
  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export async function chat(system: string, user: string): Promise<string> {
  try {
    return await complete(primary(), system, user);
  } catch (e) {
    const fb = fallback();
    if (!fb || !modelGone(e)) throw e;
    switching(primary(), e);
    return complete(fb, system, user);
  }
}

/** Yields answer text as the model writes it (reasoning tokens, if any, are not included).
 *  A "model gone" error before the first token switches to the fallback; after it, the error propagates. */
export async function* chatStream(system: string, user: string): AsyncGenerator<string> {
  let started = false;
  try {
    for await (const t of streamFrom(primary(), system, user)) {
      started = true;
      yield t;
    }
  } catch (e) {
    const fb = fallback();
    if (started || !fb || !modelGone(e)) throw e;
    switching(primary(), e);
    yield* streamFrom(fb, system, user);
  }
}
