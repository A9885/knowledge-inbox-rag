import { useEffect, useRef, useState } from "react";
import * as api from "../api/client";
import type { Draft } from "../hooks/useChats";
import type { Item, Message } from "../types";
import { AnswerView } from "./AnswerView";
import { guessIntent } from "../lib/intent";
import { SparkleIcon, UserIcon } from "./icons";
import { RichText } from "./RichText";

interface Props {
  messages: Message[];
  draft: Draft | null;
  onSuggest: (q: string) => void;
  items: Item[];
  onOpenItem: (id: string) => void;
  onPin: (messageId: string, content: string) => Promise<void>;
  onStartNote: () => void;
}

function Avatar() {
  return (
    <span aria-hidden className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
      <SparkleIcon />
    </span>
  );
}

/** A user message. With onPin, a small "Save this message as a note in your inbox" button appears on hover/focus (always on touch); the live draft has none. */
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
    <div className="group ml-auto flex max-w-[90%] items-start gap-2">
     <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="whitespace-pre-wrap break-words rounded-xl rounded-tr-sm bg-blue-100 px-4 py-2.5 text-[15px] leading-relaxed text-slate-900">{text}</div>
      {onPin &&
        (state === "saved" ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">✓ Saved to your inbox</span>
        ) : (
          <button
            type="button"
            onClick={pin}
            disabled={state === "saving"}
            title="Save this message as a note in your inbox"
            aria-label="Save this message as a note in your inbox"
            className={`flex min-h-8 items-center gap-1 rounded-full px-2 text-xs text-slate-600 transition-opacity hover:bg-slate-100 hover:text-slate-900 ${reveal}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 3v10m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
            {state === "failed" ? "Retry saving" : state === "saving" ? "Saving…" : "Save to inbox"}
          </button>
        ))}
     </div>
     <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
       <UserIcon size={20} />
     </span>
    </div>
  );
}

/** New chat: with content, three questions made from the inbox itself; without, the first step. */
function EmptyChat({ hasItems, onSuggest, onStartNote }: { hasItems: boolean; onSuggest: (q: string) => void; onStartNote: () => void }) {
  const [qs, setQs] = useState<string[] | null>(null); // null = still being made
  useEffect(() => {
    let live = true;
    setQs(hasItems ? null : []);
    if (hasItems) api.getSuggestions().then((s) => live && setQs(s)).catch(() => live && setQs([]));
    return () => {
      live = false;
    };
  }, [hasItems]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
      <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white"><SparkleIcon size={24} /></span>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{hasItems ? "Ask your inbox" : "Start with a note or link"}</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-600">
          {hasItems ? "Answers come only from the notes and links in your inbox, with sources." : "Save a note or link, then ask a question about it. Answers cite their sources."}
        </p>
      </div>
      {!hasItems && (
        <button type="button" onClick={onStartNote} className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
          Save your first note
        </button>
      )}
      {hasItems && qs === null && <p role="status" className="text-sm text-slate-600">Looking at your inbox for ideas…</p>}
      {!!qs?.length && (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Try asking</p>
          {qs.map((q) => (
            <button key={q} type="button" onClick={() => onSuggest(q)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-left text-sm text-slate-800 hover:border-blue-400 hover:bg-blue-50">
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Animated dots while waiting for the first word. */
function Thinking() {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-slate-600" role="status">
      <span>Thinking…</span>
      {[0, 150, 300].map((d) => (
        <span key={d} aria-hidden className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

/** Items whose text changed after this answer was written: its quoted snippets may be outdated. */
const editedSince = (m: Message, items: Item[]) =>
  new Set(m.createdAt ? items.filter((i) => i.updatedAt > m.createdAt!).map((i) => i.id) : []);

export function ChatThread({ messages, draft, onSuggest, items, onOpenItem, onPin, onStartNote }: Props) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" }); // braces: an effect must not return scrollIntoView's value
  }, [messages, draft]);

  if (!messages.length && !draft) return <EmptyChat hasItems={items.length > 0} onSuggest={onSuggest} onStartNote={onStartNote} />;
  return (
    <div className="scroll-quiet min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4" aria-live="polite">
      {messages.map((m, i) =>
        m.role === "user" ? (
          // Only statements are worth saving: a saved question matches future questions better than the real note and crowds it out.
          <Question key={m.id} text={m.content} onPin={guessIntent(m.content) === "note" ? () => onPin(m.id, m.content) : undefined} />
        ) : (
          <div key={m.id} className="flex max-w-[95%] gap-2">
            <Avatar />
            <div className="min-w-0 max-w-[70ch] flex-1">
              <AnswerView
                idPrefix={m.id}
                answer={m.content}
                sources={m.sources}
                debug={m.debug}
                didYouMean={m.didYouMean}
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
            <div className="min-w-0 max-w-[70ch] rounded-xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
              {draft.text ? <RichText text={draft.text} /> : <Thinking />}
            </div>
          </div>
        </>
      )}
      <div ref={end} />
    </div>
  );
}
