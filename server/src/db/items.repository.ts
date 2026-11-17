import { db } from "./connection.js";

export interface ItemDto {
  id: string;
  type: "note" | "url";
  title: string;
  sourceUrl: string | null;
  preview: string;
  chunkCount: number;
  status: "processing" | "ready" | "failed";
  createdAt: string;
}

export interface NewItem {
  id: string;
  type: "note" | "url";
  sourceUrl: string | null;
  title: string;
  rawContent: string;
  createdAt: string;
}

export function insertItem(i: NewItem): void {
  db.prepare(
    `INSERT INTO items (id, source_type, source_url, title, raw_content, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'ready', ?)`,
  ).run(i.id, i.type, i.sourceUrl, i.title, i.rawContent, i.createdAt);
}

const SELECT = `
  SELECT i.id, i.source_type AS type, i.title, i.source_url AS sourceUrl,
         substr(i.raw_content, 1, 200) AS preview, i.status, i.created_at AS createdAt,
         (SELECT count(*) FROM chunks c WHERE c.item_id = i.id) AS chunkCount
  FROM items i`;

export const listItems = (): ItemDto[] =>
  db.prepare(`${SELECT} ORDER BY i.created_at DESC`).all() as ItemDto[];

export const getItem = (id: string): ItemDto | undefined =>
  db.prepare(`${SELECT} WHERE i.id = ?`).get(id) as ItemDto | undefined;
