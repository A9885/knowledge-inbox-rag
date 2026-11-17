import { useState, type FormEvent } from "react";
import type { Item } from "../types";
import { ErrorBanner } from "./ErrorBanner";

const isHttpUrl = (s: string) => {
  try {
    return ["http:", "https:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
};

export function IngestForm({ onSave }: { onSave: (type: Item["type"], content: string) => Promise<void> }) {
  const [type, setType] = useState<Item["type"]>("note");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = content.trim();
    if (!value) return setError("Content must not be empty.");
    if (type === "url" && !isHttpUrl(value)) return setError("Enter a valid http(s) URL.");
    setSaving(true);
    setError(null);
    try {
      await onSave(type, value);
      setContent("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="inline-flex overflow-hidden rounded border border-slate-300 text-sm">
        {(["note", "url"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-3 py-1 ${type === t ? "bg-slate-800 text-white" : "bg-white"}`}
          >
            {t === "note" ? "Note" : "URL"}
          </button>
        ))}
      </div>
      {type === "note" ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Write a note…"
          className="w-full rounded border border-slate-300 p-2 text-sm"
        />
      ) : (
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="https://…"
          className="w-full rounded border border-slate-300 p-2 text-sm"
        />
      )}
      <ErrorBanner message={error} />
      <button
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
