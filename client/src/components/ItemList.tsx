import { useMemo, useState } from "react";
import type { Item } from "../types";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

function timeAgo(iso: string) {
  const secs = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  return "just now";
}

export const ICONS: Record<Item["type"], string> = { note: "📝", url: "🔗", chat: "💬", memory: "🧠" };
/** One word per kind, used everywhere the UI names a saved thing. */
export const TYPE_LABEL: Record<Item["type"], string> = { note: "Note", url: "Link", chat: "Chat", memory: "Memory" };
/** "12 Nov" — a short date for source chips and lists. */
export const shortDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" }) : "");
/** "learn.microsoft.com" from a full address. */
export const domainOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

type Filter = "all" | "notes" | "links";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "links", label: "Links" },
];

interface Props {
  items: Item[];
  loading: boolean;
  selectedId: string | null;
  onOpen: (id: string, edit: boolean) => void;
  onDelete: (id: string) => Promise<void>;
  onStartNote: () => void;
}

export function ItemList({ items, loading, selectedId, onOpen, onDelete, onStartNote }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // Client-side only: the title and the start of the text, whatever is already loaded.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (filter === "all" || (filter === "links" ? i.type === "url" : i.type !== "url")) &&
        (!q || `${i.title} ${i.preview} ${i.sourceUrl ?? ""}`.toLowerCase().includes(q)),
    );
  }, [items, query, filter]);

  // Actions appear on hover/focus; on touch screens they are always visible.
  const act = "min-h-8 rounded-lg px-2 text-xs font-medium";
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="inbox-title">
      <div className="space-y-2 p-3 pb-2">
        <div className="flex items-baseline justify-between">
          <h2 id="inbox-title" className="font-semibold text-slate-900">Inbox</h2>
          <span className="text-xs font-medium text-slate-600" aria-live="polite">
            {shown.length === items.length ? `${items.length} saved` : `${shown.length} of ${items.length}`}
          </span>
        </div>
        {items.length > 0 && (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search your inbox"
              placeholder="Search your inbox…"
              className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            />
            <div role="radiogroup" aria-label="Show" className="flex gap-1 rounded-full bg-slate-200 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`min-h-8 flex-1 rounded-full text-xs font-medium ${filter === f.id ? "bg-white text-blue-800 shadow-sm" : "text-slate-700 hover:text-slate-900"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading && !items.length ? (
          <p className="p-2 text-sm text-slate-600">Loading…</p>
        ) : !items.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-600">
            <p className="font-medium text-slate-800">Your inbox is empty</p>
            <p className="mt-1">Save a note or link, then ask a question about it.</p>
            <button type="button" onClick={onStartNote} className="mt-3 min-h-10 rounded-lg bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-800">
              Save your first note
            </button>
          </div>
        ) : !shown.length ? (
          <p className="p-2 text-sm text-slate-600">Nothing in your inbox matches. Clear the search or pick All.</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((i) => (
              <li
                key={i.id}
                aria-current={selectedId === i.id ? "true" : undefined}
                className={`group rounded-xl border p-3 text-sm transition-colors ${
                  selectedId === i.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <button onClick={() => onOpen(i.id, false)} className="block w-full truncate text-left font-medium text-slate-900 hover:underline" title={i.title}>
                  {i.title}
                </button>
                <p className="mt-1 line-clamp-2 break-words text-slate-600">{i.preview}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-slate-600 group-hover:max-w-[45%] group-focus-within:max-w-[45%]">
                    <span aria-hidden>{ICONS[i.type]}</span> {TYPE_LABEL[i.type]} · {timeAgo(i.createdAt)}
                  </span>
                  <div className="hidden shrink-0 gap-0.5 group-focus-within:flex group-hover:flex [@media(hover:none)]:flex">
                    <button onClick={() => onOpen(i.id, false)} aria-label={`View ${i.title}`} className={`${act} text-blue-800 hover:bg-blue-100`}>
                      View
                    </button>
                    {i.type !== "url" && (
                      <button onClick={() => onOpen(i.id, true)} aria-label={`Edit ${i.title}`} className={`${act} text-blue-800 hover:bg-blue-100`}>
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => window.confirm(`Delete this ${TYPE_LABEL[i.type].toLowerCase()} from your inbox? This cannot be undone.`) && void onDelete(i.id)}
                      aria-label={`Delete ${i.title}`}
                      className={`${act} text-red-700 hover:bg-red-50`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
