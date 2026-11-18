import { randomUUID } from "node:crypto";
import { inTransaction } from "../db/connection.js";
import { insertChunks } from "../db/chunks.repository.js";
import { isUserMessageOf } from "../db/conversations.repository.js";
import { findDuplicate, getItem, insertItem, messageAlreadySaved, type ItemDto } from "../db/items.repository.js";
import { AppError } from "../lib/errors.js";
import { syncItem } from "../rag/vectorIndex.js";
import { fetchPage } from "../lib/fetchUrl.js";
import { looksBlocked } from "../lib/pageCheck.js";
import { log } from "../lib/logger.js";
import { noteTitle, prepareChunks, toNewChunks } from "./prepare.js";

type Input =
  | { type: "note" | "url"; content: string }
  | { type: "chat"; content: string; conversationId: string; messageId: string };

const alreadySaved = () => new AppError("ALREADY_SAVED", 409, "This message is already saved");

/** Only a user's own message may become knowledge, never an AI answer. */
function checkPin(conversationId: string, messageId: string): void {
  if (!isUserMessageOf(conversationId, messageId)) throw new AppError("NOT_FOUND", 404, "Message not found");
  if (messageAlreadySaved(messageId)) throw alreadySaved();
}

export async function ingest(input: Input): Promise<ItemDto> {
  const t0 = Date.now();
  const { type, content } = input;

  const pin = input.type === "chat" ? { conversationId: input.conversationId, messageId: input.messageId } : undefined;
  if (pin) checkPin(pin.conversationId, pin.messageId);

  if (type !== "chat") {
    const dup = findDuplicate(type, content); // never overwrites or deletes: the caller is told where the existing one is
    if (dup) throw new AppError("ALREADY_SAVED", 409, `Already in your inbox: ${dup.title}`, undefined, { itemId: dup.id, title: dup.title });
  }

  let title: string, text: string;
  if (type === "url") {
    ({ title, text } = await fetchPage(content));
    if (looksBlocked(title, text)) throw new AppError("PAGE_BLOCKED", 422, "This page blocked automatic reading. Paste the text as a note instead.");
  } else {
    title = noteTitle(content);
    text = content;
  }

  const prepared = await prepareChunks(text, title);
  const { pieces, flags } = prepared;

  const id = randomUUID();
  try {
    inTransaction(() => {
      insertItem({
        id,
        type,
        sourceUrl: type === "url" ? content : null,
        title,
        rawContent: text,
        createdAt: new Date().toISOString(),
        ...pin,
      });
      insertChunks(toNewChunks(id, prepared));
    });
  } catch (e) {
    if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") throw alreadySaved(); // two pins raced past checkPin
    throw e;
  }

  syncItem(id);
  if (flags.some(Boolean)) log.warn({ itemId: id, flaggedChunks: flags.filter(Boolean).length }, "ingest.injection_flagged");
  log.info({ itemId: id, type, chunkCount: pieces.length, ms: Date.now() - t0 }, "ingest.completed");
  return getItem(id)!;
}
