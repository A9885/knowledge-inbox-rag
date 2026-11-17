import { config } from "../config.js";
import { embedMany } from "../rag/embedder.js";
import { bestScores } from "../rag/retriever.js";
import { log } from "../lib/logger.js";

const MARGIN = 0.1; // suggestions may score a little below a "clearly relevant" answer chunk

/** Keeps only suggestions the saved content can answer. Any failure → no suggestions; the answer is never affected. */
export async function relevantSuggestions(suggestions: string[]): Promise<string[]> {
  if (!suggestions.length) return [];
  try {
    const scores = bestScores((await embedMany(suggestions)).map((v) => Float32Array.from(v)));
    const kept = suggestions.filter((_, i) => scores[i] >= config.RELEVANCE_HIGH_SCORE - MARGIN);
    log.info({ proposed: suggestions.length, kept: kept.length }, "suggestions.filtered");
    return kept;
  } catch (e) {
    log.warn({ err: (e as Error).message }, "suggestions.filter_failed");
    return [];
  }
}
