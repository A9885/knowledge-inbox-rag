import OpenAI from "openai";
import { config } from "../config.js";

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
  config.CHAT_MODEL ?? (config.NVIDIA_API_KEY ? "poolside/laguna-xs-2.1" : "gemini-3.8-flash");

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

export async function chat(system: string, user: string): Promise<string> {
  const res = await chatApi().chat.completions.create({
    model: chatModel(),
    temperature: 0,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

/** Yields answer text as the model writes it (reasoning tokens, if any, are not included). */
export async function* chatStream(system: string, user: string): AsyncGenerator<string> {
  const stream = await chatApi().chat.completions.create({
    model: chatModel(),
    temperature: 0,
    max_tokens: MAX_TOKENS,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
