import { useState } from "react";
import type { Debug, NearMatch, Source } from "../types";
import { domainOf, ICONS, shortDate, TYPE_LABEL } from "./ItemList";
import { RichText } from "./RichText";

function DebugDetails({ debug: d }: { debug: Debug }) {
  const t = d.timings;
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
      <summary className="cursor-pointer font-semibold">Show details</summary>
      <p className="mt-1">Searched for: {d.rewrittenQuestion}</p>
      <p>
        embed {t.embedMs}ms · search {t.searchMs}ms · first word {t.firstTokenMs}ms · total {t.totalMs}ms
      </p>
      <ul className="mt-1 space-y-0.5">
        {d.candidates.map((c, i) => (
          <li key={i} className={c.kept ? "" : "text-slate-500"}>
            {c.score.toFixed(2)} {c.title} · {c.kept ? "kept" : "dropped"} ({c.reason}) · rank: vector {c.vecRank ?? "-"}, keyword {c.kwRank ?? "-"}, final {c.finalRank ?? i + 1}
          </li>
        ))}
      </ul>
    </details>
  );
}

interface Props {
  idPrefix: string; // keeps source anchors unique when several answers are on one page
  answer: string;
  sources: Source[];
  suggestions: string[];
  debug?: Debug;
  didYouMean?: NearMatch[];
  editedItems: Set<string>;
  onOpenItem: (id: string) => void;
  onSuggest: (q: string) => void;
}

export function AnswerView({ idPrefix, answer, sources, suggestions, debug, didYouMean, editedItems, onOpenItem, onSuggest }: Props) {
  const [openRef, setOpenRef] = useState<number | null>(null);
  const uncited = sources.length > 0 && !sources[0].cited;
  const open = sources.find((s) => s.ref === openRef);
  const show = (n: number) => {
    if (!sources.some((s) => s.ref === n)) return;
    setOpenRef(n);
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-source-${n}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <RichText text={answer} onCite={show} />
        {sources.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Sources</p>
            {uncited && <p className="mb-1 text-xs text-slate-600">The answer cited no source; showing the closest match.</p>}
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <button
                  key={s.chunkId}
                  type="button"
                  onClick={() => setOpenRef(openRef === s.ref ? null : s.ref)}
                  aria-expanded={openRef === s.ref}
                  title={`Match score ${s.score.toFixed(2)}`}
                  className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs ${
                    openRef === s.ref ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span aria-hidden>{ICONS[s.type]}</span>
                  <span className="font-semibold">{s.ref}</span>
                  <span className="max-w-48 truncate">{s.title}</span>
                  {s.updatedAt && <span className="shrink-0 whitespace-nowrap text-slate-600">· {shortDate(s.updatedAt)}</span>}
                  {(s.flagged || editedItems.has(s.itemId)) && <span aria-label="Warning: edited or instruction-like text" className="text-amber-700">⚠</span>}
                </button>
              ))}
            </div>
            {open && (
              <div id={`${idPrefix}-source-${open.ref}`} className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onOpenItem(open.itemId)} className="min-h-8 text-left font-medium text-slate-900 hover:underline">
                    {open.title}
                  </button>
                  <span className="shrink-0 text-xs text-slate-600">{TYPE_LABEL[open.type]}{open.updatedAt ? ` · saved ${shortDate(open.updatedAt)}` : ""} · match {open.score.toFixed(2)}</span>
                </div>
                {open.sourceUrl && (
                  <a href={open.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline">
                    {domainOf(open.sourceUrl)} ↗
                  </a>
                )}
                {editedItems.has(open.itemId) && <p className="text-xs font-medium text-amber-800">⚠ Edited after this answer was written</p>}
                {open.flagged && <p className="text-xs font-medium text-amber-800">⚠ This text contains instruction-like wording</p>}
                <p className="text-slate-700">{open.snippet}</p>
              </div>
            )}
          </div>
        )}
      </div>
      {!!didYouMean?.length && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Did you mean</p>
          <div className="flex flex-col items-start gap-1.5">
            {didYouMean.map((n) => (
              <button
                key={n.itemId}
                type="button"
                onClick={() => onOpenItem(n.itemId)}
                title={`Open ${n.title}`}
                className="flex max-w-full items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
              >
                <span aria-hidden>{ICONS[n.type]}</span>
                <span className="truncate">{n.title}</span>
                <span className="shrink-0 text-blue-800">Open</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {suggestions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Try asking</p>
          <div className="flex flex-col items-start gap-1.5">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onSuggest(q)}
                title={q}
                className="max-w-full truncate rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-left text-xs text-blue-900 hover:bg-blue-100"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      {debug && <DebugDetails debug={debug} />}
    </div>
  );
}
