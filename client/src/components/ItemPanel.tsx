import { useEffect, useState } from "react";
import * as api from "../api/client";
import { ErrorBanner } from "./ErrorBanner";
import { TypeIcon } from "./icons";
import { domainOf, TYPE_LABEL } from "./ItemList";

interface Props {
  itemId: string;
  startEditing?: boolean;
  onClose: () => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/** Full text of one saved note, link or chat, with edit and delete. Links are read-only (save the link again instead). Esc closes. */
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const saved = item ? new Date(item.createdAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <div role="dialog" aria-modal="true" aria-label={item ? `${TYPE_LABEL[item.type]}: ${item.title}` : "Loading"} className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl bg-white text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 p-4">
          <div className="min-w-0">
            {item && (
              <p className="text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1"><TypeIcon type={item.type} size={14} /> {TYPE_LABEL[item.type]} · saved {saved}</span>
              </p>
            )}
            <h3 className="break-words text-base font-semibold text-slate-900">{item?.title ?? "Loading…"}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            ✕
          </button>
        </div>
        <div className="scroll-quiet min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <ErrorBanner message={error} />
          {item && draft !== null ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} aria-label="Edit note text" className="w-full rounded-lg border border-slate-300 p-2 text-[15px] leading-relaxed" />
          ) : (
            item && <p className="max-w-[70ch] whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">{item.content}</p>
          )}
          {item?.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-blue-700 hover:underline">
              {domainOf(item.sourceUrl)} ↗
            </a>
          )}
        </div>
        {item && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-3">
            <button disabled={busy} onClick={remove} className="min-h-10 rounded-lg border border-red-300 px-4 font-medium text-red-700 hover:bg-red-50">
              Delete
            </button>
            <div className="flex gap-2">
              {draft !== null ? (
                <>
                  <button disabled={busy} onClick={() => setDraft(null)} className="min-h-10 rounded-lg border border-slate-300 px-4">
                    Cancel
                  </button>
                  <button disabled={busy || !draft.trim()} onClick={save} className="min-h-10 rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {busy ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <>
                  {item.type !== "url" && (
                    <button onClick={() => setDraft(item.content)} className="min-h-10 rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700">
                      Edit
                    </button>
                  )}
                  <button onClick={onClose} className="min-h-10 rounded-lg border border-slate-300 px-4">
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
