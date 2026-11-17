import { randomUUID } from "node:crypto";
import { inTransaction } from "../db/connection.js";
import { insertChunks } from "../db/chunks.repository.js";
import { getItem, insertItem, type ItemDto } from "../db/items.repository.js";
import { fetchPage } from "../lib/fetchUrl.js";
import { log } from "../lib/logger.js";
import { noteTitle, prepareChunks } from "./prepare.js";

export async function ingest(input: { type: "note" | "url"; content: string }): Promise<ItemDto> {
  const t0 = Date.now();
  const { type, content } = input;

  let title: string, text: string;
  if (type === "url") {
    ({ title, text } = await fetchPage(content));
  } else {
    title = noteTitle(content);
    text = content;
  }

  const { pieces, vectors, flags } = await prepareChunks(text);

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
