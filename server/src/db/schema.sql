CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,            -- uuid
  source_type  TEXT NOT NULL CHECK (source_type IN ('note','url','chat','memory')),
  source_url   TEXT,                        -- null for notes
  title        TEXT NOT NULL,
  raw_content  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing','ready','failed')),
  error        TEXT,
  created_at   TEXT NOT NULL,               -- ISO timestamp
  updated_at   TEXT,                        -- set on edit; null/old rows fall back to created_at
  conversation_id TEXT,                     -- chat items: the chat they were pinned from
  message_id   TEXT                         -- chat items: the pinned user message (unique)
);

CREATE TABLE IF NOT EXISTS chunks (
  id           TEXT PRIMARY KEY,
  item_id      TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    BLOB NOT NULL,               -- Float32Array bytes
  flagged      INTEGER NOT NULL DEFAULT 0   -- 1 = looks like a prompt injection
);

CREATE INDEX IF NOT EXISTS idx_chunks_item ON chunks(item_id);

CREATE TABLE IF NOT EXISTS conversations (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  sources         TEXT NOT NULL DEFAULT '[]',      -- JSON, assistant messages only
  suggestions     TEXT NOT NULL DEFAULT '[]',      -- JSON, assistant messages only
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

-- Keyword index for hybrid search. Kept in sync by triggers (ingest, edit, delete, reindex all go through chunks/items).
-- ponytail: deleting by the UNINDEXED chunk_id scans the table; fine for thousands of chunks.
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(content, title, chunk_id UNINDEXED);

CREATE TRIGGER IF NOT EXISTS chunks_fts_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (content, title, chunk_id)
  VALUES (new.content, COALESCE((SELECT title FROM items WHERE id = new.item_id), ''), new.id);
END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_ad AFTER DELETE ON chunks BEGIN
  DELETE FROM chunks_fts WHERE chunk_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_title AFTER UPDATE OF title ON items BEGIN
  UPDATE chunks_fts SET title = new.title WHERE chunk_id IN (SELECT id FROM chunks WHERE item_id = new.id);
END;

-- Small facts about this database. embedding_model: which model made the stored vectors (vectors from different models cannot be compared).
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
