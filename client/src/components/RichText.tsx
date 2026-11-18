import type { ReactNode } from "react";

/** Plain-text formatting for answers: keeps line breaks, turns "1." / "-" lines into lists, [n] into citation badges. No markdown, no HTML. */
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;

export function CitationBadge({ n, onClick }: { n: number; onClick?: (n: number) => void }) {
  const cls = "mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 align-baseline text-[11px] font-semibold text-blue-800";
  return onClick ? (
    <button type="button" onClick={() => onClick(n)} aria-label={`Show source ${n}`} className={`${cls} hover:bg-blue-200`}>
      {n}
    </button>
  ) : (
    <span className={cls}>{n}</span>
  );
}

function inline(text: string, onCite?: (n: number) => void): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    return m ? <CitationBadge key={i} n={Number(m[1])} onClick={onCite} /> : part;
  });
}

type Block = { kind: "p"; text: string } | { kind: "ol" | "ul"; items: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const num = line.match(NUMBERED);
    const bul = line.match(BULLET);
    const kind = num ? "ol" : bul ? "ul" : "p";
    const body = num?.[2] ?? bul?.[1] ?? line.trim();
    const last = blocks[blocks.length - 1];
    if (kind !== "p" && last?.kind === kind) last.items.push(body);
    else blocks.push(kind === "p" ? { kind, text: body } : { kind, items: [body] });
  }
  return blocks;
}

export function RichText({ text, onCite }: { text: string; onCite?: (n: number) => void }) {
  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-slate-800">
      {parse(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{inline(b.text, onCite)}</p>
        ) : (
          (() => {
            const Tag = b.kind;
            return (
              <Tag key={i} className={`space-y-1 pl-5 ${b.kind === "ol" ? "list-decimal" : "list-disc"}`}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, onCite)}</li>
                ))}
              </Tag>
            );
          })()
        ),
      )}
    </div>
  );
}
