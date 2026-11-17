import { db } from "./connection.js";

export interface ConversationDto {
  id: string;
  title: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: unknown[];
  suggestions: string[];
  createdAt: string;
}

export const NEW_CHAT_TITLE = "New chat";

export function insertConversation(id: string, now: string): void {
  db.prepare("INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    id,
    NEW_CHAT_TITLE,
    now,
    now,
  );
}

export const listConversations = (): ConversationDto[] =>
  db
    .prepare("SELECT id, title, updated_at AS updatedAt FROM conversations ORDER BY updated_at DESC")
    .all() as ConversationDto[];

export const conversationExists = (id: string): boolean =>
  db.prepare("SELECT 1 FROM conversations WHERE id = ?").get(id) !== undefined;

export const deleteConversation = (id: string): boolean =>
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id).changes > 0;

/** Bumps updated_at; names a still-untitled chat after its first question. */
export function touchConversation(id: string, now: string, titleIfNew: string): void {
  db.prepare(
    "UPDATE conversations SET updated_at = ?, title = CASE WHEN title = ? THEN ? ELSE title END WHERE id = ?",
  ).run(now, NEW_CHAT_TITLE, titleIfNew, id);
}

export function insertMessage(m: MessageDto & { conversationId: string }): void {
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, sources, suggestions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(m.id, m.conversationId, m.role, m.content, JSON.stringify(m.sources), JSON.stringify(m.suggestions), m.createdAt);
}

type Row = Omit<MessageDto, "sources" | "suggestions"> & { sources: string; suggestions: string };
const toDto = (r: Row): MessageDto => ({ ...r, sources: JSON.parse(r.sources), suggestions: JSON.parse(r.suggestions) });

/** Oldest first. rowid keeps insertion order when timestamps tie. */
export const isUserMessageOf = (conversationId: string, messageId: string): boolean =>
  db.prepare("SELECT 1 FROM messages WHERE id = ? AND conversation_id = ? AND role = 'user'").get(messageId, conversationId) !== undefined;

export const listMessages = (conversationId: string): MessageDto[] =>
  (db
    .prepare("SELECT id, role, content, sources, suggestions, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY rowid")
    .all(conversationId) as Row[]).map(toDto);

export const recentMessages = (conversationId: string, limit: number): MessageDto[] =>
  (db
    .prepare(
      `SELECT * FROM (SELECT rowid AS rid, id, role, content, sources, suggestions, created_at AS createdAt FROM messages
                      WHERE conversation_id = ? ORDER BY rowid DESC LIMIT ?) ORDER BY rid`,
    )
    .all(conversationId, limit) as Row[]).map(toDto);
