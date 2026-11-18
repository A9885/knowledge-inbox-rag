import { PlusIcon } from "./icons";

interface Props {
  title: string;
  disabled: boolean;
  isNew: boolean;
  onNew: () => void;
}

/** The chat header: New chat, and the title of the chat that is open. The list of earlier chats is its own panel (ChatList). */
export function ChatTabs({ title, disabled, isNew, onNew }: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <button
        disabled={disabled}
        onClick={onNew}
        aria-pressed={isNew}
        className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        <PlusIcon /> New chat
      </button>
      <span aria-hidden className="h-6 w-px bg-slate-200" />
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900" title={title}>{title}</h2>
    </div>
  );
}
