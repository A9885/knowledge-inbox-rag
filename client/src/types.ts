export interface Item {
  id: string;
  type: "note" | "url" | "chat" | "memory";
  title: string;
  sourceUrl: string | null;
  preview: string;
  chunkCount: number;
  status: "processing" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  ref: number;
  itemId: string;
  chunkId: string;
  title: string;
  type: "note" | "url" | "chat" | "memory";
  sourceUrl: string | null;
  snippet: string;
  score: number;
  flagged?: boolean;
  updatedAt?: string;
  cited: boolean;
}

export interface Debug {
  rewrittenQuestion: string;
  candidates: { title: string; score: number; kept: boolean; reason: string; vecRank?: number | null; kwRank?: number | null; finalRank?: number }[];
  timings: { embedMs: number; searchMs: number; firstTokenMs: number; totalMs: number };
}

export interface Answer {
  answer: string;
  sources: Source[];
  suggestions: string[];
  debug?: Debug; // only when the server runs with DEBUG=true
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  suggestions: string[];
  createdAt?: string;
  debug?: Debug; // fresh answers only; not stored with the chat
}
