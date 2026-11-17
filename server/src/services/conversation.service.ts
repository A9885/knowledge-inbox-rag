import { randomUUID } from "node:crypto";
import { inTransaction } from "../db/connection.js";
import * as repo from "../db/conversations.repository.js";
import { AppError } from "../lib/errors.js";

const HISTORY_MESSAGES = 6; // last 3 question/answer pairs are enough to resolve "it" / "and the hotel?"
const TITLE_CHARS = 40;

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export function createChat(): repo.ConversationDto {
  const id = randomUUID();
  const now = new Date().toISOString();
  repo.insertConversation(id, now);
  return { id, title: repo.NEW_CHAT_TITLE, updatedAt: now };
}

export function requireChat(id: string): void {
  if (!repo.conversationExists(id)) throw new AppError("NOT_FOUND", 404, "Conversation not found");
}

export function getMessages(id: string): repo.MessageDto[] {
  requireChat(id);
  return repo.listMessages(id);
}

export function removeChat(id: string): void {
  if (!repo.deleteConversation(id)) throw new AppError("NOT_FOUND", 404, "Conversation not found");
}

/** Recent turns of this chat, used as memory when answering a follow-up. */
export function loadHistory(id: string): Turn[] {
  requireChat(id);
  return repo.recentMessages(id, HISTORY_MESSAGES).map(({ role, content }) => ({ role, content }));
}

export function saveTurn(
  id: string,
  question: string,
  result: { answer: string; sources: unknown[]; suggestions: string[] },
): void {
  const now = new Date().toISOString();
  inTransaction(() => {
    repo.insertMessage({ id: randomUUID(), conversationId: id, role: "user", content: question, sources: [], suggestions: [], createdAt: now });
    repo.insertMessage({ id: randomUUID(), conversationId: id, role: "assistant", content: result.answer, sources: result.sources, suggestions: result.suggestions, createdAt: now });
    repo.touchConversation(id, now, question.replace(/\s+/g, " ").slice(0, TITLE_CHARS));
  });
}
