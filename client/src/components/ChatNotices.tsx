import type { Item } from "../types";
import { TYPE_LABEL } from "./ItemList";

/** UI-only messages shown under the chat. They are never sent to the server as chat history. */
export type Notice =
  | { id: number; kind: "saved"; item: Item; undone?: boolean }
  | { id: number; kind: "error"; text: string };

/** What the user just typed, with a one-click suggestion (nothing is saved until they click). */
export type Chip = { kind: "url" | "note"; text: string };

interface Props {
  notices: Notice[];
  chip: Chip | null;
  saving: "note" | "url" | null;
  onView: (id: string) => void;
  onUndo: (n: Extract<Notice, { kind: "saved" }>) => void;
  onSave: (type: "note" | "url", text: string) => void;
  onAskChip: (text: string) => void;
  onDismissChip: () => void;
}

const btn = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-100";

export function ChatNotices({ notices, chip, saving, onView, onUndo, onSave, onAskChip, onDismissChip }: Props) {
  return (
    <div className="space-y-2 px-3 pt-2 empty:hidden">
      {notices.map((n) =>
        n.kind === "error" ? (
          <div key={n.id} role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {n.text}
          </div>
        ) : (
          <div key={n.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
            {n.undone ? (
              <span>Undone: removed the {TYPE_LABEL[n.item.type].toLowerCase()} "{n.item.title}" from your inbox.</span>
            ) : (
              <>
                <span>✓ Saved {TYPE_LABEL[n.item.type].toLowerCase()} to your inbox: "{n.item.title}"</span>
                <button className={btn} onClick={() => onView(n.item.id)}>View</button>
                <button className={btn} onClick={() => onUndo(n)}>Undo</button>
              </>
            )}
          </div>
        ),
      )}
      {saving && (
        <div role="status" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
          {saving === "url" ? "Saving link… opening the page and reading it. This can take a few seconds." : "Saving note…"}
        </div>
      )}
      {chip && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
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
