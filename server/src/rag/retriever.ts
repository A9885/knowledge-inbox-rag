import { loadAllChunks, type StoredChunk } from "../db/chunks.repository.js";
import { cosineSimilarity } from "./similarity.js";

export type ScoredChunk = Omit<StoredChunk, "embedding"> & { score: number };

// ponytail: brute force O(n) over all chunks; swap for an ANN index beyond ~50k chunks.
// Besides the absolute floor, drop chunks well below the best match: embedding scores cluster
// (relevant ~0.7, unrelated ~0.5), so "top 5" alone drags in unrelated items.
const WINDOW = 0.12;

export function retrieveTopK(queryVec: Float32Array, k = 5, minScore = 0.25): ScoredChunk[] {
  const ranked = loadAllChunks()
    .map(({ embedding, ...rest }) => ({ ...rest, score: cosineSimilarity(queryVec, embedding) }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return ranked.filter((c) => c.score >= ranked[0].score - WINDOW).slice(0, k);
}
