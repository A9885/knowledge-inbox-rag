import type { StoredChunk } from "../db/chunks.repository.js";
import { config } from "../config.js";
import { vectorIndex } from "./vectorIndex.js";

export type ScoredChunk = Omit<StoredChunk, "embedding"> & { score: number };

// The search itself lives in vectorIndex.ts.
// Besides the absolute floor, drop chunks well below the best match: embedding scores cluster
// (relevant ~0.7, unrelated ~0.5), so "top 5" alone drags in unrelated items. A chunk that is
// clearly relevant on its own (>= RELEVANCE_HIGH_SCORE) stays even when a better one outscores it.

export type Candidate = { title: string; score: number; kept: boolean; reason: "window" | "high_score" | "below_window" | "top_k_cut";
  // Where this chunk ranked in each search and after fusion (1 = best, null = not in that list).
  vecRank?: number | null; kwRank?: number | null; finalRank?: number };

export function retrieveTopK(queryVec: Float32Array, k = 5, minScore = 0.25) {
  // The window rule only ever needs the best few: k hits plus the 10 debug candidates.
  const ranked: ScoredChunk[] = vectorIndex.search(queryVec, Math.max(k, 10)).filter((c) => c.score >= minScore);
  if (!ranked.length) return { hits: [], candidates: [] as Candidate[] };
  const { RELEVANCE_WINDOW, RELEVANCE_HIGH_SCORE } = config;
  const inWindow = ranked.filter((c) => c.score >= ranked[0].score - RELEVANCE_WINDOW || c.score >= RELEVANCE_HIGH_SCORE);
  const hits: ScoredChunk[] = inWindow.slice(0, k);
  const candidates: Candidate[] = ranked.slice(0, 10).map((c) => {
    const kept = hits.includes(c);
    const reason = kept ? (c.score >= ranked[0].score - RELEVANCE_WINDOW ? "window" : "high_score") : inWindow.includes(c) ? "top_k_cut" : "below_window";
    return { title: c.title, score: Math.round(c.score * 100) / 100, kept, reason, vecRank: ranked.indexOf(c) + 1, kwRank: null, finalRank: ranked.indexOf(c) + 1 };
  });
  return { hits, candidates };
}

/** Best chunk similarity for each vector. */
export const bestScores = (vecs: Float32Array[]): number[] => vecs.map((v) => vectorIndex.search(v, 1)[0]?.score ?? 0);
