export interface Item {
  id: string;
  type: "note" | "url";
  title: string;
  sourceUrl: string | null;
  preview: string;
  chunkCount: number;
  status: "processing" | "ready" | "failed";
  createdAt: string;
}

export interface Source {
  ref: number;
  itemId: string;
  chunkId: string;
  title: string;
  type: "note" | "url";
  sourceUrl: string | null;
  snippet: string;
  score: number;
  cited: boolean;
}

export interface Answer {
  answer: string;
  sources: Source[];
  suggestions: string[];
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
}
