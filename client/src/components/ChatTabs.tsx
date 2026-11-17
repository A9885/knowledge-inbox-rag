import type { Conversation } from "../types";

interface Props {
  tabs: Conversation[];
  activeId: string | null;
  disabled: boolean;
  onOpen: (id: string | null) => void;
  onClose: (id: string) => void;
}

export function ChatTabs({ tabs, activeId, disabled, onOpen, onClose }: Props) {
  const tab = (active: boolean) =>
    `flex items-center gap-1 rounded-t border border-b-0 px-3 py-1.5 text-sm ${
      active ? "border-slate-300 bg-white font-medium" : "border-transparent text-slate-500 hover:bg-slate-100"
    } ${disabled ? "opacity-60" : ""}`;

  return (
    <div className="flex flex-wrap items-end gap-1 border-b border-slate-300">
      {tabs.map((t) => (
        <div key={t.id} className={tab(t.id === activeId)}>
          <button disabled={disabled} onClick={() => onOpen(t.id)} className="max-w-40 truncate" title={t.title}>
            {t.title}
          </button>
          <button
            disabled={disabled}
            aria-label={`Delete chat ${t.title}`}
            onClick={() => window.confirm(`Delete "${t.title}" and its history?`) && onClose(t.id)}
            className="text-slate-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      ))}
      <button disabled={disabled} onClick={() => onOpen(null)} className={tab(activeId === null)}>
        {activeId === null ? "New chat" : "+ New"}
      </button>
    </div>
  );
}
