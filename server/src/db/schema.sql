CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,            -- uuid
  source_type  TEXT NOT NULL CHECK (source_type IN ('note','url')),
  source_url   TEXT,                        -- null for notes
  title        TEXT NOT NULL,
  raw_content  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing','ready','failed')),
  error        TEXT,
  created_at   TEXT NOT NULL                -- ISO timestamp
);

CREATE TABLE IF NOT EXISTS chunks (
  id           TEXT PRIMARY KEY,
  item_id      TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    BLOB NOT NULL                -- Float32Array bytes
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
