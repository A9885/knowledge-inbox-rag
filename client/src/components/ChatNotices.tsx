import type { Item } from "../types";
import { TYPE_LABEL } from "./ItemList";

/** UI-only messages shown above the chat bar. They are never sent to the server as chat history. */
export type Notice =
  | { id: number; kind: "saved"; item: Item; undone?: boolean }
  | { id: number; kind: "duplicate"; itemId: string; title: string }
  | { id: number; kind: "error"; text: string };

/** What the user just typed, with a one-click suggestion (nothing is saved until they click). */
export type Chip = { kind: "url" | "note"; text: string };

interface Props {
  notices: Notice[];
  chip: Chip | null;
  saving: "note" | "url" | null;
  onView: (id: string) => void;
  onUndo: (n: Extract<Notice, { kind: "saved" }>) => void;
  onDismiss: (id: number) => void;
  onSave: (type: "note" | "url", text: string) => void;
  onAskChip: (text: string) => void;
  onDismissChip: () => void;
}

const MAX_SHOWN = 3; // older ones drop out of view; successes also hide themselves after a few seconds (see App)
const btn = "min-h-8 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium hover:bg-slate-100";
const row = "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm";
const text = "min-w-0 flex-1 truncate";

/** A slim bar above the input: one line per message, never more than three in total. */
export function ChatNotices({ notices, chip, saving, onView, onUndo, onDismiss, onSave, onAskChip, onDismissChip }: Props) {
  return (
    <div className="shrink-0 space-y-1 px-3 pt-2 empty:hidden" aria-live="polite">
      {notices.slice(-MAX_SHOWN).map((n) =>
        n.kind === "error" ? (
          <div key={n.id} role="alert" className={`${row} border-red-300 bg-red-50 text-red-800`}>
            <span className="min-w-0 flex-1">{n.text}</span>
            <button className={btn} onClick={() => onDismiss(n.id)} aria-label="Dismiss this message">✕</button>
          </div>
        ) : n.kind === "duplicate" ? (
          <div key={n.id} className={`${row} border-amber-300 bg-amber-50 text-amber-900`}>
            <span className={text} title={n.title}>Already in your inbox: "{n.title}"</span>
            <button className={btn} onClick={() => onView(n.itemId)}>View</button>
          </div>
        ) : (
          <div key={n.id} className={`${row} border-green-300 bg-green-50 text-green-900`}>
            {n.undone ? (
              <span className={text}>Removed {TYPE_LABEL[n.item.type].toLowerCase()}: "{n.item.title}"</span>
            ) : (
              <>
                <span className={text} title={n.item.title}>✓ Saved {TYPE_LABEL[n.item.type].toLowerCase()}: "{n.item.title}"</span>
                <button className={btn} onClick={() => onView(n.item.id)}>View</button>
                <button className={btn} onClick={() => onUndo(n)}>Undo</button>
              </>
            )}
          </div>
        ),
      )}
      {saving && (
        <div role="status" className={`${row} border-slate-300 bg-white text-slate-800`}>
          {saving === "url" ? "Saving link… opening the page and reading it. This can take a few seconds." : "Saving note…"}
        </div>
      )}
      {chip && (
        <div className={`${row} flex-wrap border-blue-200 bg-blue-50 text-blue-900`}>
          <span>{chip.kind === "url" ? "Save this link or ask about it?" : "Save this as a note?"}</span>
          {chip.kind === "url" ? (
            <>
              <button className={btn} onClick={() => onSave("url", chip.text)}>Save link</button>
              <button className={btn} onClick={() => onAskChip(chip.text)}>Ask</button>
            </>
          ) : (
            <button className={btn} onClick={() => onSave("note", chip.text)}>Save note</button>
          )}
          <button className={btn} onClick={onDismissChip} aria-label="Dismiss this suggestion">✕</button>
        </div>
      )}
    </div>
  );
}
