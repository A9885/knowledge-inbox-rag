import type { FormEvent, KeyboardEvent } from "react";

export type Mode = "ask" | "note" | "url";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  loading: boolean;
}

const MODES: { id: Mode; label: string }[] = [
  { id: "ask", label: "Ask" },
  { id: "note", label: "Save note" },
  { id: "url", label: "Save link" },
];

const PLACEHOLDER: Record<Mode, string> = {
  ask: "Ask about your saved content…",
  note: "Type a note to save to your inbox…",
  url: "Paste a link to save to your inbox…",
};

/** The one place to type: pick Ask / Save note / Save link, or use /note and /url in Ask mode. Enter sends, Shift+Enter adds a line. */
export function AskBox({ value, onChange, onSubmit, mode, onMode, loading }: Props) {
  const send = () => value.trim() && !loading && onSubmit(value.trim());
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
            disabled={loading}
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
          disabled={loading}
          rows={Math.min(5, Math.max(1, value.split("\n").length))}
          placeholder={PLACEHOLDER[mode]}
          aria-label={PLACEHOLDER[mode]}
          className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-[15px] leading-snug disabled:bg-slate-100"
        />
        <button
          disabled={loading || !value.trim()}
          aria-label={loading ? "Waiting for the answer" : mode === "ask" ? "Ask" : "Save"}
          title={mode === "ask" ? "Ask (Enter)" : "Save (Enter)"}
          className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl bg-blue-700 px-3 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <span className="text-sm">Asking…</span> : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-xs text-slate-600">
        {mode === "ask" && value.startsWith("/") ? (
          <>
            Commands: <code>/note your text</code> saves a note, <code>/url https://…</code> saves a link.
          </>
        ) : (
          "Enter to send, Shift+Enter for a new line. Tip: type /note or /url to save from Ask."
        )}
      </p>
    </form>
  );
}
