import { randomUUID } from "node:crypto";
import { inTransaction } from "../db/connection.js";
import { insertChunks } from "../db/chunks.repository.js";
import { getItem, insertItem, type ItemDto } from "../db/items.repository.js";
import { chunkText } from "../rag/chunker.js";
import { embedMany } from "../rag/embedder.js";
import { looksLikeInjection } from "../lib/injection.js";
import { fetchPage } from "../lib/fetchUrl.js";
import { AppError } from "../lib/errors.js";
import { log } from "../lib/logger.js";

export async function ingest(input: { type: "note" | "url"; content: string }): Promise<ItemDto> {
  const t0 = Date.now();
  const { type, content } = input;

  let title: string, text: string;
  if (type === "url") {
    ({ title, text } = await fetchPage(content));
  } else {
    title = content.replace(/\s+/g, " ").slice(0, 60);
    text = content;
  }

  const pieces = chunkText(text);
  if (!pieces.length) throw new AppError("NO_EXTRACTABLE_TEXT", 422, "No text to save");
  const vectors = await embedMany(pieces);

  const flags = pieces.map(looksLikeInjection);
  const id = randomUUID();
  inTransaction(() => {
    insertItem({
      id,
      type,
      sourceUrl: type === "url" ? content : null,
      title,
      rawContent: text,
      createdAt: new Date().toISOString(),
    });
    insertChunks(
      pieces.map((c, index) => ({ id: randomUUID(), itemId: id, index, content: c, embedding: vectors[index], flagged: flags[index] })),
    );
  });

  if (flags.some(Boolean)) log.warn({ itemId: id, flaggedChunks: flags.filter(Boolean).length }, "ingest.injection_flagged");
  log.info({ itemId: id, type, chunkCount: pieces.length, ms: Date.now() - t0 }, "ingest.completed");
  return getItem(id)!;
}
