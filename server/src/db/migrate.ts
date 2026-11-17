import type Database from "better-sqlite3";

const hasColumn = (db: Database.Database, table: string, col: string) =>
  (db.pragma(`table_info(${table})`) as { name: string }[]).some((c) => c.name === col);

/** Additive changes for databases created before a column existed. CREATE TABLE IF NOT EXISTS won't add them. */
export function migrate(db: Database.Database): void {
  if (!hasColumn(db, "chunks", "flagged")) db.exec("ALTER TABLE chunks ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0");
  if (!hasColumn(db, "items", "updated_at"))
    db.exec("ALTER TABLE items ADD COLUMN updated_at TEXT; UPDATE items SET updated_at = created_at");
}
