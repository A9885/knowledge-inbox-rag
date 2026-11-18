import { db } from "./connection.js";

export const getMeta = (key: string): string | undefined =>
  (db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined)?.value;

export const setMeta = (key: string, value: string): void =>
  void db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);

export const chunkCount = (): number => (db.prepare("SELECT count(*) AS n FROM chunks").get() as { n: number }).n;
