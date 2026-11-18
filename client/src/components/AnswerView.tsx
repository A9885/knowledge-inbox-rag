import { useState } from "react";
import type { Debug, NearMatch, Source } from "../types";
import { ExternalIcon, TypeIcon } from "./icons";
import { domainOf, shortDate, TypePill } from "./ItemList";
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

const heading = "mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600";

export function AnswerView({ idPrefix, answer, sources, suggestions, debug, didYouMean, editedItems, onOpenItem, onSuggest }: Props) {
  const [lit, setLit] = useState<number | null>(null); // the source whose [n] badge was clicked
  const uncited = sources.length > 0 && !sources[0].cited;
  const show = (n: number) => {
    if (!sources.some((s) => s.ref === n)) return;
    setLit(n);
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-source-${n}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <RichText text={answer} onCite={show} />
        {sources.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className={heading}>Sources</p>
            {uncited && <p className="mb-1.5 text-xs text-slate-600">The answer cited no source; showing the closest match.</p>}
            <ul className="space-y-2">
              {sources.map((s) => (
                <li
                  key={s.chunkId}
                  id={`${idPrefix}-source-${s.ref}`}
                  className={`rounded-lg border p-3 text-sm ${lit === s.ref ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600"><TypeIcon type={s.type} /></span>
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 px-1 text-[11px] font-semibold text-blue-800">{s.ref}</span>
                    <button type="button" onClick={() => onOpenItem(s.itemId)} className="min-w-0 truncate text-left font-semibold text-slate-900 hover:underline" title={s.title}>
                      {s.title}
                    </button>
                    <TypePill type={s.type} />
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {s.updatedAt && <span className="hidden text-xs text-slate-600 sm:inline">{shortDate(s.updatedAt)}</span>}
                      {s.sourceUrl ? (
                        <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline" title={s.sourceUrl}>
                          {domainOf(s.sourceUrl)} <ExternalIcon />
                        </a>
                      ) : (
                        <button type="button" onClick={() => onOpenItem(s.itemId)} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
                          View source <ExternalIcon />
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 break-words text-slate-600">{s.snippet}</p>
                  {(s.flagged || editedItems.has(s.itemId)) && (
                    <p className="mt-1 text-xs font-medium text-amber-800">
                      {editedItems.has(s.itemId) && "⚠ Edited after this answer was written. "}
                      {s.flagged && "⚠ This text contains instruction-like wording."}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {!!didYouMean?.length && (
        <div>
          <p className={heading}>Did you mean</p>
          <div className="flex flex-col items-start gap-1.5">
            {didYouMean.map((n) => (
              <button
                key={n.itemId}
                type="button"
                onClick={() => onOpenItem(n.itemId)}
                title={`Open ${n.title}`}
                className="flex max-w-full items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
              >
                <TypeIcon type={n.type} size={14} />
                <span className="truncate">{n.title}</span>
                <span className="shrink-0 font-medium text-blue-800">Open</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {suggestions.length > 0 && (
        <div>
          <p className={heading}>Try asking</p>
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
