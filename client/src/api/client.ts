import type { Answer, Conversation, Item, Message } from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** What went wrong and what to do next, in the app's own words. Unknown codes keep the server's message. */
export function friendly(code: string, serverMessage: string): string {
  switch (code) {
    case "NETWORK_ERROR":
      return "Can't reach the server. Check that it is running, then try again.";
    case "PROVIDER_QUOTA":
      return "The AI provider's quota is used up for now. Nothing was lost. Try again later, or enable billing for your API key.";
    case "URL_NOT_ALLOWED":
      return "This link points to a private or local address, so it can't be saved. Use a public link, or paste the text as a note.";
    case "URL_FETCH_FAILED":
      return `Couldn't open this link (${serverMessage.replace(/^URL /, "")}). Check the address, or paste the text as a note.`;
    case "NO_EXTRACTABLE_TEXT":
      return "No readable text found. The page may need a login or JavaScript. Paste the text as a note instead.";
    case "NOT_EDITABLE":
      return "Links can't be edited. Delete it and save the link again.";
    case "LLM_FAILED":
      return "The answer model didn't respond. Try again in a moment.";
    case "EMBEDDING_FAILED":
      return "Couldn't index this text (the embedding service failed). Try again in a moment.";
    case "ALREADY_SAVED":
      return "This message is already in your inbox.";
    default:
      return serverMessage;
  }
}
const apiError = (code: string | undefined, message: string | undefined, status: number) =>
  new ApiError(code ?? "UNKNOWN", friendly(code ?? "UNKNOWN", message ?? `Request failed (${status})`));

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", friendly("NETWORK_ERROR", ""));
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw apiError(body?.error?.code, body?.error?.message, res.status);
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const ingest = (type: Item["type"], content: string) =>
  request<{ item: Item }>("/ingest", post({ type, content })).then((r) => r.item);

export const pinMessage = (conversationId: string, messageId: string, content: string) =>
  request<{ item: Item }>("/ingest", post({ type: "chat", content, conversationId, messageId })).then((r) => r.item);

export const getItem = (id: string) =>
  request<{ item: Item & { content: string } }>(`/items/${id}`).then((r) => r.item);
export const editItem = (id: string, content: string) =>
  request<{ item: Item }>(`/items/${id}`, { method: "PATCH", body: JSON.stringify({ content }) }).then((r) => r.item);
export const deleteItem = (id: string) => request<null>(`/items/${id}`, { method: "DELETE" });

export const listItems = () => request<{ items: Item[] }>("/items").then((r) => r.items);

export const listConversations = () =>
  request<{ conversations: Conversation[] }>("/conversations").then((r) => r.conversations);
export const createConversation = () =>
  request<{ conversation: Conversation }>("/conversations", post({})).then((r) => r.conversation);
export const getMessages = (id: string) => request<{ messages: Message[] }>(`/conversations/${id}`).then((r) => r.messages);
export const deleteConversation = (id: string) => request<null>(`/conversations/${id}`, { method: "DELETE" });

/** Streams an answer over server-sent events: onToken gets text as it arrives, resolves with the final result. */
export async function askStream(
  question: string,
  conversationId: string,
  onToken: (text: string) => void,
): Promise<Answer> {
  const networkError = new ApiError("NETWORK_ERROR", friendly("NETWORK_ERROR", ""));
  let res: Response;
  try {
    res = await fetch(`${BASE}/query/stream`, { ...post({ question, conversationId }), headers: { "Content-Type": "application/json" } });
  } catch {
    throw networkError;
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw apiError(body?.error?.code, body?.error?.message, res.status);
  }

  let result: Answer | null = null;
  let buf = "";
  try {
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += value;
      for (let end; (end = buf.indexOf("\n\n")) >= 0; ) {
        const block = buf.slice(0, end);
        buf = buf.slice(end + 2);
        const event = /^event: (.*)$/m.exec(block)?.[1];
        const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? "null");
        if (event === "token") onToken(data.t);
        else if (event === "done") result = data;
        else if (event === "error") throw apiError(data.code, data.message, 500);
      }
    }
  } catch (e) {
    throw e instanceof ApiError ? e : networkError;
  }
  if (!result) throw new ApiError("STREAM_ENDED", "The answer was cut off. Ask again.");
  return result;
}
