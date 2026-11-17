import { db } from "./connection.js";

export interface NewChunk {
  id: string;
  itemId: string;
  index: number;
  content: string;
  embedding: number[];
}

export interface StoredChunk {
  chunkId: string;
  itemId: string;
  title: string;
  type: "note" | "url";
  sourceUrl: string | null;
  content: string;
  embedding: Float32Array;
}

export function insertChunks(chunks: NewChunk[]): void {
  const stmt = db.prepare(
    "INSERT INTO chunks (id, item_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?)",
  );
  for (const c of chunks) {
    stmt.run(c.id, c.itemId, c.index, c.content, Buffer.from(new Float32Array(c.embedding).buffer));
  }
}

export function loadAllChunks(): StoredChunk[] {
  const rows = db
    .prepare(
      `SELECT c.id AS chunkId, c.item_id AS itemId, i.title, i.source_type AS type,
              i.source_url AS sourceUrl, c.content, c.embedding
       FROM chunks c JOIN items i ON i.id = c.item_id WHERE i.status = 'ready'`,
    )
    .all() as (Omit<StoredChunk, "embedding"> & { embedding: Buffer })[];
  // Copy the bytes: a Buffer's byteOffset may not be 4-byte aligned.
  return rows.map((r) => ({
    ...r,
    embedding: new Float32Array(r.embedding.buffer.slice(r.embedding.byteOffset, r.embedding.byteOffset + r.embedding.byteLength)),
  }));
}
