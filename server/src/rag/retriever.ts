import { loadAllChunks, type StoredChunk } from "../db/chunks.repository.js";
import { config } from "../config.js";
import { cosineSimilarity } from "./similarity.js";

export type ScoredChunk = Omit<StoredChunk, "embedding"> & { score: number };

// ponytail: brute force O(n) over all chunks; swap for an ANN index beyond ~50k chunks.
// Besides the absolute floor, drop chunks well below the best match: embedding scores cluster
// (relevant ~0.7, unrelated ~0.5), so "top 5" alone drags in unrelated items. A chunk that is
// clearly relevant on its own (>= RELEVANCE_HIGH_SCORE) stays even when a better one outscores it.

export type Candidate = { title: string; score: number; kept: boolean; reason: "window" | "high_score" | "below_window" | "top_k_cut" };

export function retrieveTopK(queryVec: Float32Array, k = 5, minScore = 0.25) {
  const ranked = loadAllChunks()
    .map(({ embedding, ...rest }) => ({ ...rest, score: cosineSimilarity(queryVec, embedding) }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score);
  const { RELEVANCE_WINDOW, RELEVANCE_HIGH_SCORE } = config;
  const inWindow = ranked.filter((c) => c.score >= ranked[0].score - RELEVANCE_WINDOW || c.score >= RELEVANCE_HIGH_SCORE);
  const hits: ScoredChunk[] = inWindow.slice(0, k);
  const candidates: Candidate[] = ranked.slice(0, 10).map((c) => {
    const kept = hits.includes(c);
    const reason = kept ? (c.score >= ranked[0].score - RELEVANCE_WINDOW ? "window" : "high_score") : inWindow.includes(c) ? "top_k_cut" : "below_window";
    return { title: c.title, score: Math.round(c.score * 100) / 100, kept, reason };
  });
  return { hits, candidates };
}

/** Best chunk similarity for each vector (one pass over the stored chunks). */
export function bestScores(vecs: Float32Array[]): number[] {
  const chunks = loadAllChunks();
  return vecs.map((v) => Math.max(0, ...chunks.map((c) => cosineSimilarity(v, c.embedding))));
}
