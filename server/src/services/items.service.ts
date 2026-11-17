import { inTransaction } from "../db/connection.js";
import { deleteChunksOfItem, insertChunks } from "../db/chunks.repository.js";
import { deleteItem, getItem, getItemContent, updateItem, type ItemDto } from "../db/items.repository.js";
import { AppError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { syncItem, vectorIndex } from "../rag/vectorIndex.js";
import { noteTitle, prepareChunks, toNewChunks } from "./prepare.js";

const notFound = () => new AppError("ITEM_NOT_FOUND", 404, "Item not found");

export function getFullItem(id: string): ItemDto & { content: string } {
  const item = getItem(id);
  if (!item) throw notFound();
  return { ...item, content: getItemContent(id) ?? "" };
}

/** Re-chunks and re-embeds an edited note. Embedding happens first, outside the transaction. */
export async function editItem(id: string, content: string): Promise<ItemDto> {
  const item = getItem(id);
  if (!item) throw notFound();
  if (item.type === "url") throw new AppError("NOT_EDITABLE", 409, "URLs can't be edited; re-add the URL instead");
  const prepared = await prepareChunks(content, noteTitle(content));
  inTransaction(() => {
    deleteChunksOfItem(id);
    insertChunks(toNewChunks(id, prepared));
    updateItem(id, noteTitle(content), content, new Date().toISOString());
  });
  syncItem(id);
  log.info({ itemId: id, chunkCount: prepared.pieces.length }, "item.updated");
  return getItem(id)!;
}

export function removeItem(id: string): void {
  if (!deleteItem(id)) throw notFound();
  vectorIndex.deleteItem(id);
  log.info({ itemId: id }, "item.deleted");
}
