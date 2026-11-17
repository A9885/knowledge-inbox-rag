import { db } from "./connection.js";
import type { ItemType } from "./items.repository.js";

export interface NewChunk {
  id: string;
  itemId: string;
  index: number;
  content: string;
  embedding: number[];
  flagged?: boolean;
}

export interface StoredChunk {
  chunkId: string;
  itemId: string;
  title: string;
  type: ItemType;
  sourceUrl: string | null;
  content: string;
  flagged: boolean;
  updatedAt: string;
  embedding: Float32Array;
}

export function insertChunks(chunks: NewChunk[]): void {
  const stmt = db.prepare(
    "INSERT INTO chunks (id, item_id, chunk_index, content, embedding, flagged) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const c of chunks) {
    stmt.run(c.id, c.itemId, c.index, c.content, Buffer.from(new Float32Array(c.embedding).buffer), c.flagged ? 1 : 0);
  }
}

const META_COLS = `c.id AS chunkId, c.item_id AS itemId, i.title, i.source_type AS type,
              i.source_url AS sourceUrl, c.content, c.flagged, COALESCE(i.updated_at, i.created_at) AS updatedAt`;

function load(where: string, ...params: string[]): StoredChunk[] {
  const rows = db
    .prepare(
      `SELECT ${META_COLS}, c.embedding
       FROM chunks c JOIN items i ON i.id = c.item_id WHERE i.status = 'ready' ${where} ORDER BY c.item_id, c.chunk_index`,
    )
    .all(...params) as (Omit<StoredChunk, "embedding" | "flagged"> & { embedding: Buffer; flagged: number })[];
  // Copy the bytes: a Buffer's byteOffset may not be 4-byte aligned.
  return rows.map((r) => ({
    ...r,
    flagged: r.flagged === 1,
    embedding: new Float32Array(r.embedding.buffer.slice(r.embedding.byteOffset, r.embedding.byteOffset + r.embedding.byteLength)),
  }));
}

export const loadAllChunks = (): StoredChunk[] => load("");
export const loadChunksOfItem = (itemId: string): StoredChunk[] => load("AND c.item_id = ?", itemId);

export const deleteChunksOfItem = (itemId: string): void =>
  void db.prepare("DELETE FROM chunks WHERE item_id = ?").run(itemId);

/** Keyword (FTS5 bm25) matches, best first. `match` must already be a safe FTS5 expression (see rag/hybrid.ts). */
export function searchKeywords(match: string, limit: number): (Omit<StoredChunk, "embedding"> & { bm25: number })[] {
  if (!match) return [];
  const rows = db
    .prepare(
      `SELECT ${META_COLS}, -f.rank AS bm25 FROM chunks_fts f JOIN chunks c ON c.id = f.chunk_id JOIN items i ON i.id = c.item_id
       WHERE chunks_fts MATCH ? AND i.status = 'ready' ORDER BY f.rank LIMIT ?`,
    )
    .all(match, limit) as (Omit<StoredChunk, "embedding" | "flagged"> & { flagged: number; bm25: number })[];
  return rows.map((r) => ({ ...r, flagged: r.flagged === 1 }));
}
