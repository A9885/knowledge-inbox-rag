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

interface Props {
  items: Item[];
  loading: boolean;
  onOpen: (id: string, edit: boolean) => void;
  onDelete: (id: string) => Promise<void>;
}

export function ItemList({ items, loading, onOpen, onDelete }: Props) {
  // Actions appear on hover/focus; on touch screens they are always visible.
  const reveal = "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";
  const act = "min-h-10 rounded-md px-2.5 text-xs font-medium";
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="inbox-title">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 id="inbox-title" className="font-semibold text-slate-900">Inbox</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800">{items.length} saved</span>
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading && !items.length ? (
          <p className="p-2 text-sm text-slate-600">Loading…</p>
        ) : !items.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-600">
            <p className="font-medium text-slate-800">Your inbox is empty</p>
            <p className="mt-1">Save a note or link, then ask a question about it. In the chat bar pick <b>Save note</b> or <b>Save link</b>, or type <code>/note</code> or <code>/link</code>.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="group rounded-xl border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
                <div className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5">{ICONS[i.type]}</span>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onOpen(i.id, false)} className="block w-full truncate text-left font-medium text-slate-900 hover:underline" title={i.title}>
                      {i.title}
                    </button>
                    <p className="mt-0.5 line-clamp-2 text-slate-600">{i.preview}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600">{TYPE_LABEL[i.type]} · {timeAgo(i.createdAt)}</span>
                      <div className={`flex gap-0.5 transition-opacity ${reveal}`}>
                        <button onClick={() => onOpen(i.id, false)} aria-label={`View ${i.title}`} className={`${act} text-blue-800 hover:bg-blue-50`}>
                          View
                        </button>
                        {i.type !== "url" && (
                          <button onClick={() => onOpen(i.id, true)} aria-label={`Edit ${i.title}`} className={`${act} text-blue-800 hover:bg-blue-50`}>
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
