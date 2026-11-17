import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";

if (config.DB_PATH !== ":memory:") mkdirSync(dirname(config.DB_PATH), { recursive: true });

export const db = new Database(config.DB_PATH);
db.pragma("foreign_keys = ON");
// Same relative path works from src/db and dist/db.
db.exec(readFileSync(new URL("../../src/db/schema.sql", import.meta.url), "utf8"));

// Existing databases predate chunks.flagged; CREATE TABLE IF NOT EXISTS won't add it.
if (!(db.pragma("table_info(chunks)") as { name: string }[]).some((c) => c.name === "flagged"))
  db.exec("ALTER TABLE chunks ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0");

export const inTransaction = <T>(fn: () => T): T => db.transaction(fn)();
