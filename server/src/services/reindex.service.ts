import { inTransaction } from "../db/connection.js";
import { deleteChunksOfItem, insertChunks } from "../db/chunks.repository.js";
import { listItemTexts } from "../db/items.repository.js";
import { log } from "../lib/logger.js";
import { prepareChunks, toNewChunks } from "./prepare.js";

/**
 * Re-chunks and re-embeds every item from its saved text. Each item is embedded first (outside any
 * transaction) and then swapped in its own transaction, so a failure leaves that item's old chunks
 * intact and the whole run is safe to repeat.
 */
export async function reindexAll(): Promise<{ items: number; failed: number }> {
  const t0 = Date.now();
  const items = listItemTexts();
  let failed = 0;
  for (const it of items) {
    const t = Date.now();
    try {
      const prepared = await prepareChunks(it.rawContent, it.title);
      inTransaction(() => {
        deleteChunksOfItem(it.id);
        insertChunks(toNewChunks(it.id, prepared));
      });
      log.info({ itemId: it.id, chunkCount: prepared.pieces.length, ms: Date.now() - t }, "reindex.item_done");
    } catch (e) {
      failed++;
      log.error({ itemId: it.id, err: (e as Error).message }, "reindex.item_failed");
    }
  }
  log.info({ items: items.length, failed, ms: Date.now() - t0 }, "reindex.done");
  return { items: items.length, failed };
}
