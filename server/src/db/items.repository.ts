import { canonicalUrl } from "../lib/pageCheck.js";
import { db } from "./connection.js";

export type ItemType = "note" | "url" | "chat" | "memory";

export interface ItemDto {
  id: string;
  type: ItemType;
  title: string;
  sourceUrl: string | null;
  preview: string;
  chunkCount: number;
  status: "processing" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface NewItem {
  id: string;
  type: ItemType;
  sourceUrl: string | null;
  title: string;
  rawContent: string;
  createdAt: string;
  conversationId?: string;
  messageId?: string;
}

export function insertItem(i: NewItem): void {
  db.prepare(
    `INSERT INTO items (id, source_type, source_url, title, raw_content, status, created_at, updated_at, conversation_id, message_id)
     VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?)`,
  ).run(i.id, i.type, i.sourceUrl, i.title, i.rawContent, i.createdAt, i.createdAt, i.conversationId ?? null, i.messageId ?? null);
}

const SELECT = `
  SELECT i.id, i.source_type AS type, i.title, i.source_url AS sourceUrl,
         substr(i.raw_content, 1, 200) AS preview, i.status, i.created_at AS createdAt,
         COALESCE(i.updated_at, i.created_at) AS updatedAt,
         (SELECT count(*) FROM chunks c WHERE c.item_id = i.id) AS chunkCount
  FROM items i`;

export const listItems = (): ItemDto[] =>
  db.prepare(`${SELECT} ORDER BY i.created_at DESC`).all() as ItemDto[];

export const getItem = (id: string): ItemDto | undefined =>
  db.prepare(`${SELECT} WHERE i.id = ?`).get(id) as ItemDto | undefined;

export const getItemContent = (id: string): string | undefined =>
  (db.prepare("SELECT raw_content AS c FROM items WHERE id = ?").get(id) as { c: string } | undefined)?.c;

export const updateItem = (id: string, title: string, rawContent: string, updatedAt: string): void =>
  void db.prepare("UPDATE items SET title = ?, raw_content = ?, updated_at = ? WHERE id = ?").run(title, rawContent, updatedAt, id);

/** Chunks go with it (ON DELETE CASCADE). */
export const deleteItem = (id: string): boolean => db.prepare("DELETE FROM items WHERE id = ?").run(id).changes > 0;

/** An already saved note with the same text, or link with the same canonical address. Never changes anything. */
export function findDuplicate(type: "note" | "url", content: string): { id: string; title: string } | undefined {
  if (type === "note") return db.prepare("SELECT id, title FROM items WHERE source_type = 'note' AND trim(raw_content) = ?").get(content.trim()) as never;
  const want = canonicalUrl(content);
  const rows = db.prepare("SELECT id, title, source_url AS u FROM items WHERE source_type = 'url'").all() as { id: string; title: string; u: string }[];
  return rows.find((r) => canonicalUrl(r.u) === want);
}

export const listItemTexts = (): { id: string; title: string; rawContent: string }[] =>
  db.prepare("SELECT id, title, raw_content AS rawContent FROM items ORDER BY created_at").all() as never;

export const messageAlreadySaved = (messageId: string): boolean =>
  db.prepare("SELECT 1 FROM items WHERE message_id = ?").get(messageId) !== undefined;
