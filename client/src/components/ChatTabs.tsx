import type { Conversation } from "../types";

interface Props {
  tabs: Conversation[];
  activeId: string | null;
  disabled: boolean;
  onOpen: (id: string | null) => void;
  onClose: (id: string) => void;
}

export function ChatTabs({ tabs, activeId, disabled, onOpen, onClose }: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
      <button
        disabled={disabled}
        onClick={() => onOpen(null)}
        aria-pressed={activeId === null}
        className={`flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold ${
          activeId === null ? "bg-blue-700 text-white" : "border border-blue-700 text-blue-800 hover:bg-blue-50"
        } disabled:opacity-60`}
      >
        <span aria-hidden>＋</span> New chat
      </button>
      <div role="tablist" aria-label="Chats" className="scroll-quiet flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`flex shrink-0 items-center rounded-lg border text-sm ${
                active ? "border-blue-600 bg-blue-50 font-semibold text-blue-900" : "border-transparent text-slate-700 hover:bg-slate-100"
              } ${disabled ? "opacity-60" : ""}`}
            >
              <button role="tab" aria-selected={active} disabled={disabled} onClick={() => onOpen(t.id)} className="min-h-10 max-w-40 truncate pl-3 pr-1" title={t.title}>
                {t.title}
              </button>
              <button
                disabled={disabled}
                aria-label={`Delete chat ${t.title}`}
                onClick={() => window.confirm(`Delete "${t.title}" and its history?`) && onClose(t.id)}
                className="flex h-10 w-8 items-center justify-center text-slate-600 hover:text-red-700"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
