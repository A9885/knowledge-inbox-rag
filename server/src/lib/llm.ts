import OpenAI from "openai";
import { config } from "../config.js";
import { log } from "./logger.js";
import { customChat, embeddingProvider } from "./providers.js";

// The only file that talks to the LLM provider (Gemini, via its OpenAI-compatible API).
// Embeddings always use Gemini; chat uses NVIDIA NIM when NVIDIA_API_KEY is set.
let gemini: OpenAI | undefined;
let nvidia: OpenAI | undefined;
const api = () =>
  (gemini ??= new OpenAI({
    apiKey: config.GEMINI_API_KEY ?? "",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    maxRetries: 0, // retries would only stretch the wait; the other provider is the retry
  }));
const nvidiaApi = () =>
  (nvidia ??= new OpenAI({ apiKey: config.NVIDIA_API_KEY, baseURL: "https://integrate.api.nvidia.com/v1", maxRetries: 0 }));

const MAX_TOKENS = 700;
const clients = new Map<string, OpenAI>(); // one client per distinct endpoint
const clientFor = (baseURL: string, apiKey: string) => {
  const k = `${baseURL}|${apiKey}`;
  if (!clients.has(k)) clients.set(k, new OpenAI({ apiKey, baseURL, maxRetries: 0 }));
  return clients.get(k)!;
};

/** Embeddings go to the configured embedding API (Gemini unless AI_* / EMBEDDING_* say otherwise). */
export async function embed(texts: string[]): Promise<number[][]> {
  const { baseURL, apiKey, model, batch } = embeddingProvider(config);
  const client = clientFor(baseURL, apiKey);
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batch) {
    const res = await client.embeddings.create({ model, input: texts.slice(i, i + batch) }, { maxRetries: 1 });
    out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return out;
}

const NVIDIA_MODEL = "poolside/laguna-xs-2.1";
const GEMINI_MODEL = "gemini-3.1-flash-lite"; // zero-setup answer model, and the fallback when NVIDIA fails

type Target = { client: OpenAI; model: string; provider: "nvidia" | "gemini" | "custom" };
const nvidiaTarget = (): Target => ({ client: nvidiaApi(), model: NVIDIA_MODEL, provider: "nvidia" });
const geminiTarget = (model = GEMINI_MODEL): Target => ({ client: api(), model, provider: "gemini" });

/** Primary: CHAT_MODEL if set (a "gemini*" name goes to Gemini, anything else to NVIDIA), else NVIDIA with a key, else Gemini. */
function primary(): Target {
  const own = customChat(config); // AI_BASE_URL / CHAT_BASE_URL: the user's own chat API, used as is
  if (own) return { client: clientFor(own.baseURL, own.apiKey), model: own.model, provider: "custom" };
  if (config.CHAT_MODEL) {
    return config.CHAT_MODEL.startsWith("gemini") || !config.NVIDIA_API_KEY
      ? geminiTarget(config.CHAT_MODEL)
      : { ...nvidiaTarget(), model: config.CHAT_MODEL };
  }
  return config.NVIDIA_API_KEY ? nvidiaTarget() : geminiTarget();
}
/** The other provider, if there is one. Used at most once per request. */
const fallback = (from: Target): Target | null =>
  from.provider === "custom" ? null : from.provider === "nvidia" ? geminiTarget() : config.NVIDIA_API_KEY ? nvidiaTarget() : null;

class LlmTimeoutError extends Error {
  constructor(ms: number) {
    super(`no response from the model within ${ms} ms`);
    this.name = "LlmTimeoutError";
  }
}

type Reason = "model_unavailable" | "timeout" | "server_error" | "connection";
/** Why this error justifies trying the other provider (null = it does not: bad request, auth, quota, ...). */
function fallbackReason(e: unknown): Reason | null {
  const { status, name, code, message } = e as { status?: number; name?: string; code?: string; message?: string };
  if (status === 404 || status === 410) return "model_unavailable";
  if (typeof status === "number") return status >= 500 ? "server_error" : null;
  if (name === "LlmTimeoutError" || name === "APIConnectionTimeoutError") return "timeout";
  return /Connection|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EPIPE/i.test(`${name} ${code} ${message}`) ? "connection" : null;
}

function switching(from: Target, to: Target, reason: Reason, e: unknown) {
  const status = (e as { status?: number }).status;
  if (reason === "model_unavailable") log.warn({ model: from.model, status, fallback: to.model }, "llm.model_unavailable");
  log.warn({ from: from.provider, to: to.provider, model: from.model, fallbackModel: to.model, reason, status }, "llm.fallback");
}

const messages = (system: string, user: string) => [
  { role: "system" as const, content: system },
  { role: "user" as const, content: user },
];

async function complete(t: Target, system: string, user: string): Promise<string> {
  const ms = config.LLM_REQUEST_TIMEOUT_MS;
  const signal = AbortSignal.timeout(ms);
  try {
    const res = await t.client.chat.completions.create(
      { model: t.model, temperature: 0, max_tokens: MAX_TOKENS, messages: messages(system, user) },
      { signal },
    );
    return res.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    throw signal.aborted ? new LlmTimeoutError(ms) : e;
  }
}

/** Streams one provider. If no token arrives within LLM_FIRST_TOKEN_TIMEOUT_MS the request is aborted with a timeout error. */
async function* streamFrom(t: Target, system: string, user: string): AsyncGenerator<string> {
  const ac = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, config.LLM_FIRST_TOKEN_TIMEOUT_MS);
  try {
    const stream = await t.client.chat.completions.create(
      { model: t.model, temperature: 0, max_tokens: MAX_TOKENS, stream: true, messages: messages(system, user) },
      { signal: ac.signal },
    );
    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content;
      if (!delta) continue;
      clearTimeout(timer);
      timer = undefined;
      yield delta;
    }
  } catch (e) {
    throw timedOut ? new LlmTimeoutError(config.LLM_FIRST_TOKEN_TIMEOUT_MS) : e;
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(system: string, user: string): Promise<string> {
  const first = primary();
  try {
    return await complete(first, system, user);
  } catch (e) {
    const reason = fallbackReason(e);
    const fb = reason && fallback(first);
    if (!fb || !reason) throw e;
    switching(first, fb, reason, e);
    return complete(fb, system, user); // one attempt only; its error propagates
  }
}

/** Yields answer text as the model writes it (reasoning tokens, if any, are not included).
 *  A failure before the first token (timeout, 5xx, connection, model gone) switches once to the other provider;
 *  after the first token the error propagates and is not retried. */
export async function* chatStream(system: string, user: string): AsyncGenerator<string> {
  const first = primary();
  let started = false;
  try {
    for await (const t of streamFrom(first, system, user)) {
      started = true;
      yield t;
    }
  } catch (e) {
    const reason = fallbackReason(e);
    const fb = reason && fallback(first);
    if (started || !fb || !reason) throw e;
    switching(first, fb, reason, e);
    yield* streamFrom(fb, system, user);
  }
}
