import type { Source } from "../types";

// "https://en.wikipedia.org/wiki/Goa" → "en.wikipedia.org/wiki/Goa"
const shortLink = (u: string) => {
  try {
    const { hostname, pathname } = new URL(u);
    const path = pathname.length > 1 ? pathname : "";
    return hostname.replace(/^www\./, "") + (path.length > 28 ? `${path.slice(0, 28)}…` : path);
  } catch {
    return u;
  }
};

const jump = (id: string) => {
  const el = document.getElementById(id);
  el?.closest("details")?.setAttribute("open", ""); // a collapsed source list must open first
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
};

interface Props {
  idPrefix: string; // keeps source anchors unique when several answers are on one page
  expandSources?: boolean;
  answer: string;
  sources: Source[];
  suggestions: string[];
  onSuggest: (q: string) => void;
}

export function AnswerView({ idPrefix, expandSources = false, answer, sources, suggestions, onSuggest }: Props) {
  const uncited = sources.length > 0 && !sources[0].cited;
  return (
    <div className="space-y-4">
      <div>
        <p className="whitespace-pre-wrap text-sm">
          {answer.split(/(\[\d+\])/g).map((part, i) => {
            const m = part.match(/^\[(\d+)\]$/);
            return m ? (
              <button key={i} onClick={() => jump(`${idPrefix}-source-${m[1]}`)} className="mx-0.5 font-semibold text-blue-600 hover:underline">
                {part}
              </button>
            ) : (
              part
            );
          })}
        </p>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              onClick={() => onSuggest(q)}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      {sources.length > 0 && (
        <details open={expandSources}>
          <summary className="mb-1 cursor-pointer text-sm font-semibold">Sources ({sources.length})</summary>
          {uncited && <p className="mb-1 text-xs text-slate-500">The answer cited no source; showing the closest match.</p>}
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.chunkId} id={`${idPrefix}-source-${s.ref}`} className="rounded border border-slate-200 bg-white p-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    [{s.ref}] {s.title}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{s.score.toFixed(2)}</span>
                </div>
                {s.sourceUrl && (
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                    {shortLink(s.sourceUrl)} ↗
                  </a>
                )}
                <p className="mt-1 text-slate-600">{s.snippet}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
