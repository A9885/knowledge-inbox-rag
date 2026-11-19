import { retrieve } from "../rag/retrieve.js";
import type { Candidate, NearMatch, ScoredChunk } from "../rag/retriever.js";
import {
  buildRewriteMessage,
  buildUserMessage,
  FALLBACK,
  isTopic,
  needsRewrite,
  REWRITE_PROMPT,
  SYSTEM_PROMPT,
  splitSuggestions,
  visibleEnd,
} from "../rag/prompt.js";
import { chat, chatStream } from "../lib/llm.js";
import { config } from "../config.js";
import { AppError, isQuota, quotaError } from "../lib/errors.js";
import { looksLikeAttackQuestion } from "../lib/injection.js";
import { log } from "../lib/logger.js";
import { relevantSuggestions } from "./suggestions.js";
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
  flagged: c.flagged,
  updatedAt: c.updatedAt,
  cited,
});

type Debug = {
  rewrittenQuestion: string;
  candidates: Candidate[];
  timings: { embedMs: number; searchMs: number; firstTokenMs: number; totalMs: number };
};
type Result = { answer: string; sources: ReturnType<typeof toSource>[]; suggestions: string[]; didYouMean?: NearMatch[]; debug?: Debug };

/** Not found, but near matches exist: offer them to open (nothing is invented from them). */
const withNear = (r: Result, got: { near: NearMatch[] }): Result => (r.answer === FALLBACK && got.near.length ? { ...r, didYouMean: got.near } : r);

/** A short question gets more room: it is a topic search over the whole inbox. */
const limitFor = (q: string, topK: number) => (isTopic(q) ? Math.max(topK, 8) : topK);

/** Turns raw model output into the answer, its cited sources and follow-up suggestions. */
export function finalize(raw: string, hits: ScoredChunk[]): Result {
  const { answer, suggestions } = splitSuggestions(raw);
  if (answer.includes(FALLBACK)) return { answer: FALLBACK, sources: [], suggestions: [] }; // not found is always exactly the line, never line + commentary

  // Two chunks of one item are one source: point every citation at the first of them, and fold repeats ([1][1] → [1]).
  const firstOf = new Map<string, number>();
  hits.forEach((h, i) => firstOf.has(h.itemId) || firstOf.set(h.itemId, i + 1));
  const merged = answer
    .replace(/\[(\d+)\]/g, (m, n) => (hits[Number(n) - 1] ? `[${firstOf.get(hits[Number(n) - 1].itemId)}]` : m))
    .replace(/\[(\d+)\](?:\s*,?\s*\[\1\])+/g, "[$1]");
  // Cited passage numbers, deduped, in order of first appearance.
  const refs = [...new Set([...merged.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].filter(
    (n) => n >= 1 && n <= hits.length,
  );
  // Show what the answer cited. If it cited nothing, show only the single closest match, not every hit.
  // Renumber the cited passages 1..k in order of appearance, so one cited source reads [1], not [4].
  const renumber = new Map(refs.map((n, i) => [n, i + 1]));
  const text = merged.replace(/\[(\d+)\]/g, (m, n) => (renumber.has(Number(n)) ? `[${renumber.get(Number(n))}]` : m));
  const sources = refs.length ? refs.map((n) => toSource(hits[n - 1], renumber.get(n)!, true)) : [toSource(hits[0], 1, false)];
  return { answer: text, sources, suggestions };
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

type Retrieved = Awaited<ReturnType<typeof retrieve>>;

/** Only populated when DEBUG=true. firstTokenMs is 0 for non-streamed answers. */
const withDebug = (r: Result, q: string, got: Retrieved, t0: number, firstTokenAt = t0): Result =>
  config.DEBUG
    ? {
        ...r,
        debug: {
          rewrittenQuestion: q,
          candidates: got.candidates,
          timings: {
            embedMs: got.embedMs,
            searchMs: got.searchMs,
            firstTokenMs: firstTokenAt - t0,
            totalMs: Date.now() - t0,
          },
        },
      }
    : r;

const llmFailed = (e: unknown) => {
  if (isQuota(e)) return quotaError("chat", e);
  log.error({ err: (e as Error).message }, "llm.failed");
  return new AppError("LLM_FAILED", 502, "Language model provider failed", e);
};

const logDone = (question: string, hits: ScoredChunk[], t0: number, streamed: boolean) =>
  log.info(
    { questionLength: question.length, retrieved: hits.length, topScore: hits[0]?.score, ms: Date.now() - t0, streamed },
    "query.completed",
  );

/** Instruction-style questions ("ignore your rules", "reveal all saved content") get the not-found line: no search, no model call, no sources. */
const refused = (question: string): Result | null => {
  if (!looksLikeAttackQuestion(question)) return null;
  log.warn({ questionLength: question.length }, "query.refused_instruction");
  return { answer: FALLBACK, sources: [], suggestions: [] };
};

export async function answerQuestion(question: string, topK: number, history: Turn[] = []): Promise<Result> {
  const t0 = Date.now();
  const blocked = refused(question);
  if (blocked) return blocked;
  question = await standalone(question, history);
  const got = await retrieve(question, limitFor(question, topK));
  const hits = got.hits;
  let result: Result = { answer: FALLBACK, sources: [], suggestions: [] };
  if (hits.length) {
    try {
      result = finalize(await chat(SYSTEM_PROMPT, buildUserMessage(question, hits)), hits);
    } catch (e) {
      throw llmFailed(e);
    }
  }
  result.suggestions = await relevantSuggestions(result.suggestions); // outside the try: it never fails the answer
  logDone(question, hits, t0, false);
  return withDebug(withNear(result, got), question, got, t0);
}

/** Same as answerQuestion, but calls onToken with answer text as it is generated. */
export async function streamAnswer(
  question: string,
  topK: number,
  onToken: (t: string) => void,
  history: Turn[] = [],
): Promise<Result> {
  const t0 = Date.now();
  const blocked = refused(question);
  if (blocked) return blocked;
  question = await standalone(question, history);
  const got = await retrieve(question, limitFor(question, topK));
  const hits = got.hits;
  if (!hits.length) {
    logDone(question, hits, t0, true);
    return withDebug(withNear({ answer: FALLBACK, sources: [], suggestions: [] }, got), question, got, t0);
  }

  let raw = "";
  let firstTokenAt = 0;
  let sent = 0;
  try {
    for await (const token of chatStream(SYSTEM_PROMPT, buildUserMessage(question, hits))) {
      raw += token;
      firstTokenAt ||= Date.now();
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
  const result = finalize(raw, hits);
  result.suggestions = await relevantSuggestions(result.suggestions);
  return withDebug(withNear(result, got), question, got, t0, firstTokenAt || Date.now());
}
