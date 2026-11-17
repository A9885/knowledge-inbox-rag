import type Database from "better-sqlite3";

const hasColumn = (db: Database.Database, table: string, col: string) =>
  (db.pragma(`table_info(${table})`) as { name: string }[]).some((c) => c.name === col);

/** SQLite can't change a CHECK constraint, so the items table is rebuilt (the documented 12-step way) from schema.sql. */
function rebuildItems(db: Database.Database, schema: string): void {
  const ddl = /CREATE TABLE IF NOT EXISTS items \([\s\S]*?\n\);/.exec(schema)?.[0];
  if (!ddl) throw new Error("items table definition not found in schema.sql");
  const cols = "id, source_type, source_url, title, raw_content, status, error, created_at, updated_at";
  db.pragma("foreign_keys = OFF"); // otherwise DROP TABLE would cascade-delete every chunk
  try {
    db.transaction(() => {
      db.exec(ddl.replace("IF NOT EXISTS items", "items_new"));
      db.exec(`INSERT INTO items_new (${cols}) SELECT ${cols} FROM items; DROP TABLE items; ALTER TABLE items_new RENAME TO items`);
      if ((db.pragma("foreign_key_check") as unknown[]).length) throw new Error("foreign key check failed after rebuilding items");
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

/** Changes for databases created before a column existed. CREATE TABLE IF NOT EXISTS won't add them. */
export function migrate(db: Database.Database, schema: string): void {
  if (!hasColumn(db, "chunks", "flagged")) db.exec("ALTER TABLE chunks ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0");
  if (!hasColumn(db, "items", "updated_at"))
    db.exec("ALTER TABLE items ADD COLUMN updated_at TEXT; UPDATE items SET updated_at = created_at");
  if (!hasColumn(db, "items", "message_id")) rebuildItems(db, schema); // adds conversation_id, message_id and the 'chat'/'memory' types
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_items_message ON items(message_id)"); // NULLs don't collide
  db.exec(schema); // idempotent: recreates the chunks_fts triggers if the items rebuild dropped them
  // Existing databases get their keyword index built once, from the chunks they already have.
  const indexed = (db.prepare("SELECT COUNT(*) AS n FROM chunks_fts").get() as { n: number }).n;
  if (!indexed)
    db.exec(`INSERT INTO chunks_fts (content, title, chunk_id)
             SELECT c.content, i.title, c.id FROM chunks c JOIN items i ON i.id = c.item_id`);
}
