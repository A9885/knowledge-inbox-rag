import { searchKeywords } from "../db/chunks.repository.js";
import { config } from "../config.js";
import { embedQueries } from "./embedder.js";
import { fuse, ftsQuery, newestOfDuplicates, RECENCY_BOOST, splitTopics, type RankedList } from "./hybrid.js";
import { retrieveTopK, type Candidate, type ScoredChunk } from "./retriever.js";
import { vectorIndex } from "./vectorIndex.js";

const POOL = 20; // top 20 from each search, as in the plan
const MIN_SCORE = 0.25;

type Result = { hits: ScoredChunk[]; candidates: Candidate[]; embedMs: number; searchMs: number };

/** Embeds the question (and its sub-topics in the same call), then searches by vector only or by vector + keyword. */
export async function retrieve(question: string, topK: number): Promise<Result> {
  const hybrid = config.RETRIEVAL_MODE === "hybrid";
  const texts = [question, ...(hybrid ? splitTopics(question) : [])];
  const t0 = Date.now();
  const vecs = (await embedQueries(texts)).map((v) => Float32Array.from(v));
  const t1 = Date.now();
  const found = hybrid ? hybridSearch(texts, vecs, topK) : retrieveTopK(vecs[0], topK);
  return { ...found, embedMs: t1 - t0, searchMs: Date.now() - t1 };
}

function hybridSearch(texts: string[], vecs: Float32Array[], topK: number) {
  const lists: RankedList[] = [];
  const meta = new Map<string, Omit<ScoredChunk, "score">>();
  const vecRank = new Map<string, number>();
  const kwRank = new Map<string, number>();
  const note = (m: Map<string, number>, ids: string[]) => ids.forEach((id, r) => m.set(id, Math.min(m.get(id) ?? Infinity, r + 1)));

  texts.forEach((text, i) => {
    const v = vectorIndex.search(vecs[i], POOL);
    const k = searchKeywords(ftsQuery(text), POOL);
    for (const h of [...v, ...k]) meta.set(h.chunkId, h);
    lists.push({ kind: "vec", ids: v.map((h) => h.chunkId), scores: v.map((h) => h.score) });
    lists.push({ kind: "kw", ids: k.map((h) => h.chunkId), scores: k.map((h) => h.bm25) }); // bm25: higher = better
    note(vecRank, lists[lists.length - 2].ids);
    note(kwRank, lists[lists.length - 1].ids);
  });

  // The relevance filter works on cosine similarity (best over the question and its parts), never on the fused score.
  const ids = new Set(meta.keys());
  const cos = new Map<string, number>();
  for (const vec of vecs) for (const [id, s] of vectorIndex.similarity(vec, ids)) cos.set(id, Math.max(cos.get(id) ?? -1, s));

  const fused = fuse(lists, config.HYBRID_FUSION);
  const boosted = newestOfDuplicates([...ids].map((id) => ({ id, content: meta.get(id)!.content, updatedAt: meta.get(id)!.updatedAt })));
  const order = [...ids]
    .filter((id) => (cos.get(id) ?? 0) >= MIN_SCORE)
    .map((id) => ({ id, final: (fused.get(id) ?? 0) + (boosted.has(id) ? RECENCY_BOOST : 0) }))
    .sort((a, b) => b.final - a.final)
    .map((x) => x.id);
  if (!order.length) return { hits: [] as ScoredChunk[], candidates: [] as Candidate[] };

  const { RELEVANCE_WINDOW, RELEVANCE_HIGH_SCORE } = config;
  const best = Math.max(...order.map((id) => cos.get(id)!));
  const inWindow = order.filter((id) => cos.get(id)! >= best - RELEVANCE_WINDOW || cos.get(id)! >= RELEVANCE_HIGH_SCORE);
  const keptIds = new Set(inWindow.slice(0, topK));
  const hits = [...keptIds].map((id) => ({ ...meta.get(id)!, score: cos.get(id)! }));
  const candidates: Candidate[] = order.slice(0, 10).map((id, r) => ({
    title: meta.get(id)!.title,
    score: Math.round(cos.get(id)! * 100) / 100,
    kept: keptIds.has(id),
    reason: keptIds.has(id) ? (cos.get(id)! >= best - RELEVANCE_WINDOW ? "window" : "high_score") : inWindow.includes(id) ? "top_k_cut" : "below_window",
    vecRank: vecRank.get(id) ?? null,
    kwRank: kwRank.get(id) ?? null,
    finalRank: r + 1,
  }));
  return { hits, candidates };
}
