import { useCallback, useEffect, useState } from "react";
import * as api from "../api/client";
import type { Conversation, Message } from "../types";

/** A question being answered right now: its text so far streams into `text`. */
export interface Draft {
  question: string;
  text: string;
}

const msg = (e: unknown) => (e as Error).message;

export function useChats() {
  const [tabs, setTabs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null); // null = a new chat, created on first question
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = draft !== null; // tabs are locked while an answer streams, so nothing can interleave

  const load = useCallback(async (id: string | null) => {
    setActiveId(id);
    setMessages([]);
    if (!id) return;
    try {
      setMessages(await api.getMessages(id));
    } catch (e) {
      setError(msg(e));
    }
  }, []);

  useEffect(() => {
    api
      .listConversations()
      .then((list) => {
        setTabs(list);
        return load(list[0]?.id ?? null); // reopen the most recent chat
      })
      .catch((e) => setError(msg(e)));
  }, [load]);

  const open = (id: string | null) => {
    if (loading || id === activeId) return;
    setError(null);
    void load(id);
  };

  const close = async (id: string) => {
    if (loading) return;
    try {
      await api.deleteConversation(id);
    } catch (e) {
      return setError(msg(e));
    }
    const rest = tabs.filter((t) => t.id !== id);
    setTabs(rest);
    if (id === activeId) await load(rest[0]?.id ?? null);
  };

  const ask = async (question: string) => {
    setError(null);
    setDraft({ question, text: "" });
    try {
      let id = activeId;
      if (!id) {
        id = (await api.createConversation()).id;
        setActiveId(id);
      }
      const r = await api.askStream(question, id, (t) => setDraft((d) => d && { ...d, text: d.text + t }));
      const key = crypto.randomUUID();
      setMessages((m) => [
        ...m,
        { id: `${key}-q`, role: "user", content: question, sources: [], suggestions: [] },
        { id: `${key}-a`, role: "assistant", content: r.answer, sources: r.sources, suggestions: r.suggestions },
      ]);
      setTabs(await api.listConversations()); // picks up the new tab / title / order
    } catch (e) {
      setError(msg(e));
    } finally {
      setDraft(null);
    }
  };

  return { tabs, activeId, messages, draft, loading, error, open, close, ask };
}
