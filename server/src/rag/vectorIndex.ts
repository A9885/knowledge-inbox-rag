import { dataVersion } from "../db/connection.js";
import { loadAllChunks, loadChunksOfItem, type StoredChunk } from "../db/chunks.repository.js";
import { log } from "../lib/logger.js";

type Meta = Omit<StoredChunk, "embedding">;
export type Hit = Meta & { score: number };

export interface VectorIndex {
  load(): void;
  upsert(itemId: string, chunks: StoredChunk[]): void;
  deleteItem(itemId: string): void;
  /** The k most similar chunks, best first. */
  search(vec: Float32Array, k: number): Hit[];
  /** Cosine similarity of the query to specific chunks (used to score keyword-only matches). */
  similarity(vec: Float32Array, chunkIds: Set<string>): Map<string, number>;
}

function normalize(v: ArrayLike<number>, out: Float32Array, at: number): void {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) out[at + i] = v[i] / n;
}

/**
 * All vectors live in one Float32Array, normalized when stored, so a search is one dot product per chunk.
 * Own writes call upsert/deleteItem; writes by another process (reindex) are noticed through SQLite's data_version.
 * ponytail: upsert copies the whole array (fine to tens of thousands of chunks); use ANN / sqlite-vec beyond that.
 */
export class InMemoryVectorIndex implements VectorIndex {
  private dim = 0;
  private data = new Float32Array(0);
  private meta: Meta[] = [];
  private version: number | null = null;

  load(): void {
    const t0 = Date.now();
    this.version = dataVersion();
    this.fill([], loadAllChunks());
    log.info({ chunks: this.meta.length, dim: this.dim, ms: Date.now() - t0 }, "vector_index.loaded");
  }

  upsert(itemId: string, chunks: StoredChunk[]): void {
    this.ensureFresh();
    this.fill(this.meta.map((m, i) => (m.itemId === itemId ? -1 : i)).filter((i) => i >= 0), chunks);
  }

  deleteItem(itemId: string): void {
    this.upsert(itemId, []);
  }

  search(vec: Float32Array, k: number): Hit[] {
    this.ensureFresh();
    const { dim, data, meta } = this;
    if (!meta.length || vec.length !== dim) return [];
    const q = new Float32Array(dim);
    normalize(vec, q, 0);
    const top: { i: number; score: number }[] = []; // k best so far, best first
    for (let i = 0; i < meta.length; i++) {
      let dot = 0;
      for (let d = 0, o = i * dim; d < dim; d++) dot += q[d] * data[o + d];
      if (top.length === k && dot <= top[k - 1].score) continue;
      let at = top.length;
      while (at > 0 && top[at - 1].score < dot) at--;
      top.splice(at, 0, { i, score: dot });
      if (top.length > k) top.pop();
    }
    return top.map(({ i, score }) => ({ ...meta[i], score }));
  }

  similarity(vec: Float32Array, chunkIds: Set<string>): Map<string, number> {
    this.ensureFresh();
    const { dim, data, meta } = this;
    const out = new Map<string, number>();
    if (!meta.length || vec.length !== dim) return out;
    const q = new Float32Array(dim);
    normalize(vec, q, 0);
    meta.forEach((m, i) => {
      if (!chunkIds.has(m.chunkId)) return;
      let dot = 0;
      for (let d = 0, o = i * dim; d < dim; d++) dot += q[d] * data[o + d];
      out.set(m.chunkId, dot);
    });
    return out;
  }

  private ensureFresh(): void {
    if (this.version === null || dataVersion() !== this.version) this.load();
  }

  /** Rebuilds the arrays from the kept rows of the current index plus the new chunks. */
  private fill(keep: number[], add: StoredChunk[]): void {
    const dim = this.meta.length && keep.length ? this.dim : (add[0]?.embedding.length ?? 0);
    const rows = add.filter((c) => c.embedding.length === dim);
    if (rows.length < add.length) log.warn({ skipped: add.length - rows.length, dim }, "vector_index.dim_mismatch");
    const data = new Float32Array((keep.length + rows.length) * dim);
    keep.forEach((from, to) => data.set(this.data.subarray(from * dim, (from + 1) * dim), to * dim));
    rows.forEach((c, j) => normalize(c.embedding, data, (keep.length + j) * dim));
    this.meta = [...keep.map((i) => this.meta[i]), ...rows.map(({ embedding, ...m }) => m)];
    this.data = data;
    this.dim = dim;
  }
}

export const vectorIndex = new InMemoryVectorIndex();

/** Re-reads one item's chunks from the database into the index (after ingest, edit or reindex). */
export const syncItem = (itemId: string): void => vectorIndex.upsert(itemId, loadChunksOfItem(itemId));
