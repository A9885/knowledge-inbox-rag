import { useEffect, useRef, useState } from "react";
import type { Conversation } from "../types";
import { DotsIcon, PlusIcon } from "./icons";

interface Props {
  tabs: Conversation[];
  activeId: string | null;
  disabled: boolean;
  onOpen: (id: string | null) => void;
  onClose: (id: string) => void;
}

/** First question, cut short: a chat is found again by its title, not read in the list. */
const cut = (t: string, n = 40) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

/** The chat header: New chat, the open chat's title, and a "…" menu to switch to or delete any chat. */
export function ChatTabs({ tabs, activeId, disabled, onOpen, onClose }: Props) {
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
  const title = tabs.find((t) => t.id === activeId)?.title ?? "New chat";

  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <button
        disabled={disabled}
        onClick={() => onOpen(null)}
        aria-pressed={activeId === null}
        className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        <PlusIcon /> New chat
      </button>
      <span aria-hidden className="h-6 w-px bg-slate-200" />
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900" title={title}>{cut(title, 60)}</h2>
      <div ref={box} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Your chats (${tabs.length})`}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <DotsIcon />
        </button>
        {open && (
          <div role="menu" aria-label="Chats" className="absolute right-0 top-full z-10 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {!tabs.length && <p className="px-3 py-2 text-sm text-slate-600">No chats yet. Ask a question to start one.</p>}
            {tabs.map((t) => (
              <div key={t.id} className={`flex items-center ${t.id === activeId ? "bg-blue-50" : "hover:bg-slate-100"}`}>
                <button
                  role="menuitem"
                  disabled={disabled}
                  onClick={() => {
                    setOpen(false);
                    onOpen(t.id);
                  }}
                  className={`min-h-10 min-w-0 flex-1 truncate px-3 text-left text-sm ${t.id === activeId ? "font-semibold text-blue-900" : "text-slate-800"} disabled:opacity-60`}
                  title={t.title}
                >
                  {cut(t.title)}
                </button>
                <button
                  disabled={disabled}
                  aria-label={`Delete chat ${t.title}`}
                  onClick={() => window.confirm(`Delete "${t.title}" and its history?`) && (setOpen(false), onClose(t.id))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 hover:text-red-700 disabled:opacity-60"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
