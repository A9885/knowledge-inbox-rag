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
  ask: "Ask a question about your inbox…",
  note: "Type a note to save in your inbox…",
  url: "Paste a link to save in your inbox…",
};

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

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-slate-200 bg-white p-3">
      <div role="radiogroup" aria-label="What should this message do?" className="inline-flex rounded-full bg-slate-100 p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            disabled={busy}
            onClick={() => onMode(m.id)}
            className={`min-h-10 rounded-full px-3 text-sm font-medium sm:px-4 ${
              mode === m.id ? "bg-white text-blue-800 shadow-sm" : "text-slate-700 hover:text-slate-900"
            } disabled:opacity-60`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          disabled={busy}
          rows={Math.min(5, Math.max(1, value.split("\n").length))}
          placeholder={PLACEHOLDER[mode]}
          aria-label={PLACEHOLDER[mode]}
          className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-[15px] leading-snug disabled:bg-slate-100"
        />
        <button
          disabled={busy || !value.trim()}
          aria-label={saving ? "Saving" : loading ? "Waiting for the answer" : MODES.find((m) => m.id === mode)!.label}
          title={`${MODES.find((m) => m.id === mode)!.label} (Enter)`}
          className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl bg-blue-700 px-3 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <span className="text-sm">{saving ? "Saving…" : "Asking…"}</span> : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
            </svg>
          )}
        </button>
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
