import { loadAllChunks, type StoredChunk } from "../db/chunks.repository.js";
import { cosineSimilarity } from "./similarity.js";

export type ScoredChunk = Omit<StoredChunk, "embedding"> & { score: number };

// ponytail: brute force O(n) over all chunks; swap for an ANN index beyond ~50k chunks.
// Besides the absolute floor, drop chunks well below the best match: embedding scores cluster
// (relevant ~0.7, unrelated ~0.5), so "top 5" alone drags in unrelated items.
const WINDOW = 0.12;

export type Candidate = { title: string; score: number; kept: boolean; reason: "window" | "below_window" | "top_k_cut" };

export function retrieveTopK(queryVec: Float32Array, k = 5, minScore = 0.25) {
  const ranked = loadAllChunks()
    .map(({ embedding, ...rest }) => ({ ...rest, score: cosineSimilarity(queryVec, embedding) }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score);
  const inWindow = ranked.filter((c) => c.score >= ranked[0].score - WINDOW);
  const hits: ScoredChunk[] = inWindow.slice(0, k);
  const candidates: Candidate[] = ranked.slice(0, 10).map((c) => {
    const kept = hits.includes(c);
    const reason = kept ? "window" : inWindow.includes(c) ? "top_k_cut" : "below_window";
    return { title: c.title, score: Math.round(c.score * 100) / 100, kept, reason };
  });
  return { hits, candidates };
}
