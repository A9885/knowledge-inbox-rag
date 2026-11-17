import { embedOne } from "../rag/embedder.js";
import { retrieveTopK, type ScoredChunk } from "../rag/retriever.js";
import {
  buildRewriteMessage,
  buildUserMessage,
  FALLBACK,
  needsRewrite,
  REWRITE_PROMPT,
  SYSTEM_PROMPT,
  splitSuggestions,
  visibleEnd,
} from "../rag/prompt.js";
import { chat, chatStream } from "../lib/llm.js";
import { AppError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import type { Turn } from "./conversation.service.js";

const SNIPPET_CHARS = 300;

const toSource = (c: ScoredChunk, ref: number, cited: boolean) => ({
  ref,
  itemId: c.itemId,
  chunkId: c.chunkId,
  title: c.title,
  type: c.type,
  sourceUrl: c.sourceUrl,
  snippet: c.content.slice(0, SNIPPET_CHARS),
  score: Math.round(c.score * 100) / 100,
  cited,
});

type Result = { answer: string; sources: ReturnType<typeof toSource>[]; suggestions: string[] };

/** Turns raw model output into the answer, its cited sources and follow-up suggestions. */
function finalize(raw: string, hits: ScoredChunk[]): Result {
  const { answer, suggestions } = splitSuggestions(raw);
  if (answer.includes(FALLBACK)) return { answer, sources: [], suggestions: [] };

  // Cited passage numbers, deduped, in order of first appearance.
  const refs = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].filter(
    (n) => n >= 1 && n <= hits.length,
  );
  // Show what the answer cited. If it cited nothing, show only the single closest match, not every hit.
  const sources = refs.length ? refs.map((n) => toSource(hits[n - 1], n, true)) : [toSource(hits[0], 1, false)];
  return { answer, sources, suggestions };
}

/** Follow-ups ("and the hotel?") only make sense with the chat's memory: turn them into a standalone question. */
async function standalone(question: string, history: Turn[]): Promise<string> {
  if (!history.length || !needsRewrite(question)) return question; // no memory needed: skip the extra model call
  try {
    const out = (await chat(REWRITE_PROMPT, buildRewriteMessage(question, history))).trim().replace(/^["']|["']$/g, "");
    return out && out.length < 500 ? out : question;
  } catch (e) {
    log.warn({ err: (e as Error).message }, "rewrite.failed");
    return question;
  }
}

async function retrieve(question: string, topK: number) {
  return retrieveTopK(Float32Array.from(await embedOne(question)), topK);
}

const llmFailed = (e: unknown) => {
  log.error({ err: (e as Error).message }, "llm.failed");
  return new AppError("LLM_FAILED", 502, "Language model provider failed", e);
};

const logDone = (question: string, hits: ScoredChunk[], t0: number, streamed: boolean) =>
  log.info(
    { questionLength: question.length, retrieved: hits.length, topScore: hits[0]?.score, ms: Date.now() - t0, streamed },
    "query.completed",
  );

export async function answerQuestion(question: string, topK: number, history: Turn[] = []): Promise<Result> {
  const t0 = Date.now();
  question = await standalone(question, history);
  const hits = await retrieve(question, topK);
  let result: Result = { answer: FALLBACK, sources: [], suggestions: [] };
  if (hits.length) {
    try {
      result = finalize(await chat(SYSTEM_PROMPT, buildUserMessage(question, hits)), hits);
    } catch (e) {
      throw llmFailed(e);
    }
  }
  logDone(question, hits, t0, false);
  return result;
}

/** Same as answerQuestion, but calls onToken with answer text as it is generated. */
export async function streamAnswer(
  question: string,
  topK: number,
  onToken: (t: string) => void,
  history: Turn[] = [],
): Promise<Result> {
  const t0 = Date.now();
  question = await standalone(question, history);
  const hits = await retrieve(question, topK);
  if (!hits.length) {
    logDone(question, hits, t0, true);
    return { answer: FALLBACK, sources: [], suggestions: [] };
  }

  let raw = "";
  let sent = 0;
  try {
    for await (const token of chatStream(SYSTEM_PROMPT, buildUserMessage(question, hits))) {
      raw += token;
      const end = visibleEnd(raw);
      if (end > sent) onToken(raw.slice(sent, end)), (sent = end);
    }
  } catch (e) {
    throw llmFailed(e);
  }
  const shown = raw.search(/\n\s*\**suggestions/i);
  const end = shown >= 0 ? shown : raw.length;
  if (end > sent) onToken(raw.slice(sent, end)); // flush the held-back tail
  logDone(question, hits, t0, true);
  return finalize(raw, hits);
}
