import { useEffect, useRef, useState } from "react";
import type { Draft } from "../hooks/useChats";
import type { Item, Message } from "../types";
import { AnswerView } from "./AnswerView";

interface Props {
  messages: Message[];
  draft: Draft | null;
  onSuggest: (q: string) => void;
  items: Item[];
  onOpenItem: (id: string) => void;
  onPin: (messageId: string, content: string) => Promise<void>;
}

/** A user message. With onPin it shows 📌 (saves the message to the inbox); the live draft has none. */
function Question({ text, onPin }: { text: string; onPin?: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const pin = async () => {
    setState("saving");
    try {
      await onPin!();
      setState("saved");
    } catch {
      setState("failed");
    }
  };
  return (
    <div className="ml-auto flex max-w-[85%] items-center gap-2">
      {onPin && (
        <button
          onClick={pin}
          disabled={state === "saving" || state === "saved"}
          title="Save this message to your inbox"
          className="shrink-0 text-xs text-slate-500 hover:text-slate-900 disabled:cursor-default"
        >
          {state === "saved" ? "✓ Saved" : state === "failed" ? "📌 Retry" : "📌"}
        </button>
      )}
      <div className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">{text}</div>
    </div>
  );
}

/** Items whose text changed after this answer was written: its quoted snippets may be outdated. */
const editedSince = (m: Message, items: Item[]) =>
  new Set(m.createdAt ? items.filter((i) => i.updatedAt > m.createdAt!).map((i) => i.id) : []);

export function ChatThread({ messages, draft, onSuggest, items, onOpenItem, onPin }: Props) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" }); // braces: an effect must not return scrollIntoView's value
  }, [messages, draft]);

  if (!messages.length && !draft) {
    return <p className="py-8 text-center text-sm text-slate-500">Ask anything about your saved notes and links.</p>;
  }
  return (
    <div className="max-h-[60vh] space-y-4 overflow-y-auto py-3 pr-1">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <Question key={m.id} text={m.content} onPin={() => onPin(m.id, m.content)} />
        ) : (
          <AnswerView
            key={m.id}
            idPrefix={m.id}
            answer={m.content}
            sources={m.sources}
            debug={m.debug}
            editedItems={editedSince(m, items)}
            onOpenItem={onOpenItem}
            suggestions={i === messages.length - 1 ? m.suggestions : []}
            expandSources={i === messages.length - 1}
            onSuggest={onSuggest}
          />
        ),
      )}
      {draft && (
        <>
          <Question text={draft.question} />
          <p className="whitespace-pre-wrap text-sm">{draft.text || <span className="text-slate-400">Thinking…</span>}</p>
        </>
      )}
      <div ref={end} />
    </div>
  );
}
