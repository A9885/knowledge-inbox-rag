import { chunkText } from "../rag/chunker.js";
import { embedMany } from "../rag/embedder.js";
import { looksLikeInjection } from "../lib/injection.js";
import { AppError } from "../lib/errors.js";

export const noteTitle = (text: string) => text.replace(/\s+/g, " ").slice(0, 60);

/** Chunks, embeds (a network call: never run inside a transaction) and injection-flags a text. */
export async function prepareChunks(text: string) {
  const pieces = chunkText(text);
  if (!pieces.length) throw new AppError("NO_EXTRACTABLE_TEXT", 422, "No text to save");
  const vectors = await embedMany(pieces);
  return { pieces, vectors, flags: pieces.map(looksLikeInjection) };
}
