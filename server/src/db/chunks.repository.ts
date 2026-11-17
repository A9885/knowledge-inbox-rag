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

export function loadAllChunks(): StoredChunk[] {
  const rows = db
    .prepare(
      `SELECT c.id AS chunkId, c.item_id AS itemId, i.title, i.source_type AS type,
              i.source_url AS sourceUrl, c.content, c.embedding, c.flagged, COALESCE(i.updated_at, i.created_at) AS updatedAt
       FROM chunks c JOIN items i ON i.id = c.item_id WHERE i.status = 'ready'`,
    )
    .all() as (Omit<StoredChunk, "embedding" | "flagged"> & { embedding: Buffer; flagged: number })[];
  // Copy the bytes: a Buffer's byteOffset may not be 4-byte aligned.
  return rows.map((r) => ({
    ...r,
    flagged: r.flagged === 1,
    embedding: new Float32Array(r.embedding.buffer.slice(r.embedding.byteOffset, r.embedding.byteOffset + r.embedding.byteLength)),
  }));
}

export const deleteChunksOfItem = (itemId: string): void =>
  void db.prepare("DELETE FROM chunks WHERE item_id = ?").run(itemId);
