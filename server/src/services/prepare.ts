import { randomUUID } from "node:crypto";
import { chunkText } from "../rag/chunker.js";
import { embedMany } from "../rag/embedder.js";
import { looksLikeInjection } from "../lib/injection.js";
import { AppError } from "../lib/errors.js";

export const noteTitle = (text: string) => text.replace(/\s+/g, " ").slice(0, 60);

/**
 * Chunks, embeds (a network call: never run inside a transaction) and injection-flags a text.
 * The item title is embedded with each chunk for context, but only the chunk itself is stored.
 */
export async function prepareChunks(text: string, title: string) {
  const pieces = chunkText(text);
  if (!pieces.length) throw new AppError("NO_EXTRACTABLE_TEXT", 422, "No text to save");
  const vectors = await embedMany(pieces.map((c) => `${title} — ${c}`));
  return { pieces, vectors, flags: pieces.map(looksLikeInjection) };
}

type Prepared = Awaited<ReturnType<typeof prepareChunks>>;

export const toNewChunks = (itemId: string, p: Prepared) =>
  p.pieces.map((content, index) => ({ id: randomUUID(), itemId, index, content, embedding: p.vectors[index], flagged: p.flags[index] }));
