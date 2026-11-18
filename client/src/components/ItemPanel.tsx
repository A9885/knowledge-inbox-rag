import { useEffect, useState } from "react";
import * as api from "../api/client";
import { ErrorBanner } from "./ErrorBanner";
import { ICONS, TYPE_LABEL } from "./ItemList";

interface Props {
  itemId: string;
  startEditing?: boolean;
  onClose: () => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/** Full text of one saved note, link or chat, with edit and delete. Links are read-only (save the link again instead). */
export function ItemPanel({ itemId, startEditing = false, onClose, onEdit, onDelete }: Props) {
  const [item, setItem] = useState<Awaited<ReturnType<typeof api.getItem>> | null>(null);
  const [draft, setDraft] = useState<string | null>(null); // non-null = editing
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getItem(itemId)
      .then((i) => {
        setItem(i);
        if (startEditing && i.type !== "url") setDraft(i.content);
      })
      .catch((e) => setError((e as Error).message));
  }, [itemId, startEditing]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      await onEdit(itemId, draft ?? "");
      setItem(await api.getItem(itemId));
      setDraft(null);
    });
  const remove = () =>
    run(async () => {
      if (!window.confirm(`Delete this ${item ? TYPE_LABEL[item.type].toLowerCase() : "entry"} from your inbox? This cannot be undone.`)) return;
      await onDelete(itemId);
      onClose();
    });

  return (
    <div role="dialog" aria-modal="true" aria-label={item ? `${TYPE_LABEL[item.type]}: ${item.title}` : "Loading"} className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 text-sm shadow-xl">
        <div className="flex justify-between gap-2">
          <div className="min-w-0">
            {item && <p className="text-xs font-medium text-slate-600"><span aria-hidden>{ICONS[item.type]}</span> {TYPE_LABEL[item.type]}</p>}
            <h3 className="font-semibold">{item?.title ?? "Loading…"}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            ✕
          </button>
        </div>
        <ErrorBanner message={error} />
        {item && draft !== null ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} className="w-full rounded-lg border border-slate-300 p-2" />
        ) : (
          item && <p className="whitespace-pre-wrap text-slate-700">{item.content}</p>
        )}
        {item?.sourceUrl && (
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline">
            {item.sourceUrl} ↗
          </a>
        )}
        {item && (
          <div className="flex gap-2">
            {draft !== null ? (
              <>
                <button disabled={busy || !draft.trim()} onClick={save} className="min-h-10 rounded-lg bg-blue-700 px-4 text-white disabled:opacity-50">
                  {busy ? "Saving…" : "Save"}
                </button>
                <button disabled={busy} onClick={() => setDraft(null)} className="min-h-10 rounded-lg border border-slate-300 px-4">
                  Cancel
                </button>
              </>
            ) : (
              item.type !== "url" && (
                <button onClick={() => setDraft(item.content)} className="min-h-10 rounded-lg border border-slate-300 px-4">
                  Edit
                </button>
              )
            )}
            <button disabled={busy} onClick={remove} className="min-h-10 rounded-lg border border-red-300 px-4 text-red-700">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
