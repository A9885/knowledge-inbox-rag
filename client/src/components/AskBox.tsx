import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { DocIcon, LinkIcon, SendIcon } from "./icons";

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
  // Save note / Save link are switches: press again to go back to Ask.
  const toggle = (m: Mode) => onMode(mode === m ? "ask" : m);
  const saveBtn = (m: Exclude<Mode, "ask">, icon: ReactNode, name: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      disabled={busy}
      onClick={() => toggle(m)}
      className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-60 ${
        mode === m ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
      }`}
    >
      {icon} {name}
    </button>
  );

  return (
    <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-4">
      <div className="flex items-end gap-2">
        <textarea
          id="askbox-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          disabled={busy}
          rows={Math.min(MAX_ROWS, Math.max(1, value.split("\n").length))}
          placeholder={PLACEHOLDER[mode]}
          aria-label={PLACEHOLDER[mode]}
          className="max-h-40 min-h-12 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-slate-300 px-4 py-3 text-[15px] leading-snug disabled:bg-slate-100"
        />
        <button
          disabled={busy || !value.trim()}
          aria-label={saving ? "Saving" : loading ? "Waiting for the answer" : label}
          title={`${label} (Enter)`}
          className="flex h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <span className="text-sm">{saving ? "Saving…" : "Asking…"}</span> : <SendIcon size={20} />}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {saveBtn("note", <DocIcon />, "Save note")}
          {saveBtn("url", <LinkIcon />, "Save link")}
        </div>
        <p className="text-xs text-slate-600">
          {mode === "ask" && value.startsWith("/") ? (
            <>
              <code>/note text</code> saves a note, <code>/link https://…</code> saves a link.
            </>
          ) : (
            "Enter to send · Shift+Enter for a new line"
          )}
        </p>
      </div>
    </form>
  );
}
