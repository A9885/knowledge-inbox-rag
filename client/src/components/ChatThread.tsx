import { useEffect, useRef, useState } from "react";
import type { Draft } from "../hooks/useChats";
import type { Item, Message } from "../types";
import { AnswerView } from "./AnswerView";
import { guessIntent } from "../lib/intent";
import { RichText } from "./RichText";

interface Props {
  messages: Message[];
  draft: Draft | null;
  onSuggest: (q: string) => void;
  items: Item[];
  onOpenItem: (id: string) => void;
  onPin: (messageId: string, content: string) => Promise<void>;
}

const EXAMPLES = ["What do I have planned this week?", "Summarize my saved notes", "What did I save about travel?"];

function Avatar() {
  return (
    <span aria-hidden className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-[11px] font-bold text-white">
      AI
    </span>
  );
}

/** A user message. With onPin, a small "Save to inbox" button appears on hover/focus (always on touch); the live draft has none. */
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
  const reveal = state === "idle" || state === "saving" ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" : "";
  return (
    <div className="group ml-auto flex max-w-[85%] flex-col items-end gap-1">
      <div className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-2.5 text-[15px] leading-relaxed text-white">{text}</div>
      {onPin &&
        (state === "saved" ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">✓ Saved to inbox</span>
        ) : (
          <button
            type="button"
            onClick={pin}
            disabled={state === "saving"}
            title="Save to inbox"
            aria-label="Save to inbox"
            className={`flex min-h-8 items-center gap-1 rounded-full px-2 text-xs text-slate-600 transition-opacity hover:bg-slate-100 hover:text-slate-900 ${reveal}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 3v10m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
            {state === "failed" ? "Retry saving" : state === "saving" ? "Saving…" : "Save to inbox"}
          </button>
        ))}
    </div>
  );
}

/** Animated dots while waiting for the first word. */
function Thinking() {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-slate-600" role="status">
      <span>Thinking</span>
      {[0, 150, 300].map((d) => (
        <span key={d} aria-hidden className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
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
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-800">AI</span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ask your knowledge inbox</h2>
          <p className="mt-1 text-sm text-slate-600">Answers come only from the notes and links you saved, with sources.</p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" onClick={() => onSuggest(q)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-left text-sm text-slate-800 hover:border-blue-400 hover:bg-blue-50">
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="scroll-quiet min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4" aria-live="polite">
      {messages.map((m, i) =>
        m.role === "user" ? (
          // Only statements are worth saving: a saved question matches future questions better than the real note and crowds it out.
          <Question key={m.id} text={m.content} onPin={guessIntent(m.content) === "note" ? () => onPin(m.id, m.content) : undefined} />
        ) : (
          <div key={m.id} className="flex max-w-[95%] gap-2">
            <Avatar />
            <div className="min-w-0 flex-1">
              <AnswerView
                idPrefix={m.id}
                answer={m.content}
                sources={m.sources}
                debug={m.debug}
                editedItems={editedSince(m, items)}
                onOpenItem={onOpenItem}
                suggestions={i === messages.length - 1 ? m.suggestions : []}
                onSuggest={onSuggest}
              />
            </div>
          </div>
        ),
      )}
      {draft && (
        <>
          <Question text={draft.question} />
          <div className="flex max-w-[95%] gap-2">
            <Avatar />
            <div className="min-w-0 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
              {draft.text ? <RichText text={draft.text} /> : <Thinking />}
            </div>
          </div>
        </>
      )}
      <div ref={end} />
    </div>
  );
}
