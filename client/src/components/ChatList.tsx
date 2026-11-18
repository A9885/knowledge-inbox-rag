import type { Conversation } from "../types";

interface Props {
  chats: Conversation[];
  activeId: string | null;
  disabled: boolean; // locked while an answer streams
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });

/** Earlier chats, newest first. Opening one shows it in the middle; × deletes it after a confirmation. */
export function ChatList({ chats, activeId, disabled, onOpen, onDelete }: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="chats-title">
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 id="chats-title" className="text-lg font-semibold text-slate-900">Chats</h2>
        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-800">{chats.length}</span>
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!chats.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center text-sm text-slate-600">No chats yet. Ask a question to start one.</p>
        ) : (
          <ul className="space-y-2">
            {chats.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id} aria-current={active ? "true" : undefined} className={`flex items-center rounded-xl border text-sm shadow-sm ${active ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <button
                    disabled={disabled}
                    onClick={() => onOpen(c.id)}
                    title={c.title}
                    className="min-h-12 min-w-0 flex-1 px-3 py-2 text-left disabled:opacity-60"
                  >
                    <span className={`block truncate ${active ? "font-semibold text-blue-900" : "font-medium text-slate-900"}`}>{c.title}</span>
                    <span className="text-xs text-slate-600">{when(c.updatedAt)}</span>
                  </button>
                  <button
                    disabled={disabled}
                    aria-label={`Delete chat ${c.title}`}
                    onClick={() => window.confirm(`Delete "${c.title}" and its history?`) && onDelete(c.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 hover:text-red-700 disabled:opacity-60"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
