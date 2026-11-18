import type { FormEvent, KeyboardEvent } from "react";

export type Mode = "ask" | "note" | "url";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  loading: boolean;
  saving: Mode | null; // a note or link is being saved right now
}

const MODES: { id: Mode; label: string }[] = [
  { id: "ask", label: "Ask" },
  { id: "note", label: "Save note" },
  { id: "url", label: "Save link" },
];

const PLACEHOLDER: Record<Mode, string> = {
  ask: "Ask a question…",
  note: "Write a note…",
  url: "Paste a link…",
};

const MAX_ROWS = 6; // the box grows to this many lines, then scrolls inside itself

/** The one place to type: pick Ask / Save note / Save link, or use /note and /link in Ask mode. Enter sends, Shift+Enter adds a line. */
export function AskBox({ value, onChange, onSubmit, mode, onMode, loading, saving }: Props) {
  const busy = loading || !!saving;
  const send = () => value.trim() && !busy && onSubmit(value.trim());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  const label = MODES.find((m) => m.id === mode)!.label;

  return (
    <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div role="radiogroup" aria-label="What should this message do?" className="inline-flex shrink-0 self-start rounded-full bg-slate-100 p-1 md:self-end">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              disabled={busy}
              onClick={() => onMode(m.id)}
              className={`min-h-9 whitespace-nowrap rounded-full px-3 text-sm font-medium ${
                mode === m.id ? "bg-white text-blue-800 shadow-sm" : "text-slate-700 hover:text-slate-900"
              } disabled:opacity-60`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-end gap-2">
          <textarea
            id="askbox-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
            rows={Math.min(MAX_ROWS, Math.max(1, value.split("\n").length))}
            placeholder={PLACEHOLDER[mode]}
            aria-label={PLACEHOLDER[mode]}
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] leading-snug disabled:bg-slate-100"
          />
          <button
            disabled={busy || !value.trim()}
            aria-label={saving ? "Saving" : loading ? "Waiting for the answer" : label}
            title={`${label} (Enter)`}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-700 px-3 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <span className="text-sm">{saving ? "Saving…" : "Asking…"}</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-600">
        {mode === "ask" && value.startsWith("/") ? (
          <>
            Commands: <code>/note your text</code> saves a note, <code>/link https://…</code> saves a link.
          </>
        ) : (
          "Enter to send, Shift+Enter for a new line. In Ask, type /note or /link to save instead."
        )}
      </p>
    </form>
  );
}
