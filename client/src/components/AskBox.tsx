import type { FormEvent } from "react";

export type Mode = "ask" | "note" | "url";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  loading: boolean;
}

const PLACEHOLDER: Record<Mode, string> = {
  ask: "Ask about your saved content…",
  note: "Type a note to save…",
  url: "Paste a link to save…",
};

export function AskBox({ value, onChange, onSubmit, mode, onMode, loading }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault(); // Enter in the input submits the form
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <form onSubmit={submit} className="space-y-1">
      <div className="flex gap-2">
        <select
          value={mode}
          onChange={(e) => onMode(e.target.value as Mode)}
          disabled={loading}
          aria-label="Mode"
          className="rounded border border-slate-300 bg-white p-2 text-sm"
        >
          <option value="ask">Ask</option>
          <option value="note">Save note</option>
          <option value="url">Save URL</option>
        </select>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          placeholder={PLACEHOLDER[mode]}
          className="flex-1 rounded border border-slate-300 p-2 text-sm"
        />
        <button disabled={loading || !value.trim()} className="rounded bg-blue-600 px-4 text-sm text-white disabled:opacity-50">
          {loading ? "Asking…" : mode === "ask" ? "Ask" : "Save"}
        </button>
      </div>
      {mode === "ask" && value.startsWith("/") && (
        <p className="text-xs text-slate-500">
          Commands: <code>/note your text</code> saves a note, <code>/url https://…</code> saves a link.
        </p>
      )}
    </form>
  );
}
