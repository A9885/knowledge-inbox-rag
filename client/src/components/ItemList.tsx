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

export function ItemList({ items, loading }: { items: Item[]; loading: boolean }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold">Saved items ({items.length})</h2>
      {loading && !items.length ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !items.length ? (
        <p className="text-sm text-slate-500">Nothing saved yet. Add a note or URL above.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="rounded border border-slate-200 bg-white p-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {i.type === "note" ? "📝" : "🔗"} {i.title}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{timeAgo(i.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-slate-600">{i.preview}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
