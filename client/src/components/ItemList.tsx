import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "../types";
import { DotsIcon, SearchIcon, TypeIcon } from "./icons";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["hour", 3600],
  ["minute", 60],
];

/** "4 minutes ago" for the first day, then "Nov 19, 2026". */
export function when(iso: string) {
  const secs = (new Date(iso).getTime() - Date.now()) / 1000;
  if (Math.abs(secs) >= 86400) return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  for (const [unit, size] of UNITS) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  return "just now";
}

/** One word per kind, used everywhere the UI names a saved thing. */
export const TYPE_LABEL: Record<Item["type"], string> = { note: "Note", url: "Link", chat: "Chat", memory: "Memory" };
/** "12 Nov" — a short date for source cards. */
export const shortDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" }) : "");
/** "learn.microsoft.com" from a full address. */
export const domainOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/** The small coloured "Note" / "Link" label. */
export const TypePill = ({ type }: { type: Item["type"] }) => (
  <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">{TYPE_LABEL[type]}</span>
);

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

/** The "…" menu on a card: View, Edit (notes only), Delete. Closes on Escape, a click elsewhere, or a choice. */
function CardMenu({ item, onOpen, onDelete }: { item: Item; onOpen: Props["onOpen"]; onDelete: Props["onDelete"] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const entry = "block min-h-9 w-full px-3 text-left text-sm hover:bg-slate-100";
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${item.title}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-900"
      >
        <DotsIcon />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button role="menuitem" className={entry} onClick={pick(() => onOpen(item.id, false))}>View</button>
          {item.type !== "url" && <button role="menuitem" className={entry} onClick={pick(() => onOpen(item.id, true))}>Edit</button>}
          <button
            role="menuitem"
            className={`${entry} text-red-700 hover:bg-red-50`}
            onClick={pick(() => window.confirm(`Delete this ${TYPE_LABEL[item.type].toLowerCase()} from your inbox? This cannot be undone.`) && void onDelete(item.id))}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
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

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="inbox-title">
      <div className="space-y-3 p-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 id="inbox-title" className="text-lg font-semibold text-slate-900">Inbox</h2>
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-800" aria-live="polite">
            {shown.length === items.length ? `${items.length} saved` : `${shown.length} of ${items.length}`}
          </span>
        </div>
        {items.length > 0 && (
          <>
            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search your inbox"
                placeholder="Search your inbox…"
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm"
              />
            </label>
            <div role="radiogroup" aria-label="Show" className="flex gap-1 rounded-full bg-slate-200/70 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`min-h-9 flex-1 rounded-full text-sm font-medium ${filter === f.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:text-slate-900"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {loading && !items.length ? (
          <p className="p-2 text-sm text-slate-600">Loading…</p>
        ) : !items.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center text-sm text-slate-600">
            <p className="font-medium text-slate-800">Your inbox is empty</p>
            <p className="mt-1">Save a note or link, then ask a question about it.</p>
            <button type="button" onClick={onStartNote} className="mt-3 min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
              Save your first note
            </button>
          </div>
        ) : !shown.length ? (
          <p className="p-2 text-sm text-slate-600">Nothing in your inbox matches. Clear the search or pick All.</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((i) => (
              <li
                key={i.id}
                aria-current={selectedId === i.id ? "true" : undefined}
                className={`flex gap-3 rounded-xl border p-3 text-sm shadow-sm transition-colors ${
                  selectedId === i.id ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="mt-0.5 text-slate-600"><TypeIcon type={i.type} size={20} /></span>
                <div className="min-w-0 flex-1">
                  <button onClick={() => onOpen(i.id, false)} className="block w-full truncate text-left font-semibold text-slate-900 hover:underline" title={i.title}>
                    {i.title}
                  </button>
                  <p className="mt-0.5 line-clamp-2 break-words text-slate-600">{i.preview}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                      <TypePill type={i.type} />
                      <span className="truncate">· {when(i.createdAt)}</span>
                    </span>
                    <CardMenu item={i} onOpen={onOpen} onDelete={onDelete} />
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
