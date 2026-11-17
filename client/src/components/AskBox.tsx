import type { FormEvent } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onAsk: (q: string) => void;
  loading: boolean;
}

export function AskBox({ value, onChange, onAsk, loading }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault(); // Enter in the input submits the form
    if (value.trim()) onAsk(value.trim());
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        placeholder="Ask about your saved content…"
        className="flex-1 rounded border border-slate-300 p-2 text-sm"
      />
      <button disabled={loading || !value.trim()} className="rounded bg-blue-600 px-4 text-sm text-white disabled:opacity-50">
        {loading ? "Asking…" : "Ask"}
      </button>
    </form>
  );
}
