// Pure helpers for hybrid (vector + keyword) retrieval. No I/O.

const STOP = new Set("a an and are as at be by can did do does for from has have how i in is it its me my of on or our so than that the their them then there these they this to was we were what when where which who whom whose why will with you your any all some about saved".split(" "));

/**
 * Turns free text into a safe FTS5 MATCH expression: every word is double-quoted (so punctuation and
 * operators like AND, NEAR, *, ", ( can never be syntax) and the words are OR-ed; bm25 ranks by overlap.
 */
export function ftsQuery(text: string): string {
  const words = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) ?? [];
  const keep = [...new Set(words.filter((w) => w.length > 1 && !STOP.has(w)))].slice(0, 12);
  // The keyword index does no stemming: also search the singular or plural, so "movies" finds "movie" and back.
  const forms = keep.flatMap((w) => [w, w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : `${w}s`]);
  return [...new Set(forms)].map((w) => `"${w}"`).join(" OR ");
}

/** "gym and birthday" -> ["gym", "birthday"]. Splits on and / & / commas, at most 3 parts of 2+ words; [] if not multi-topic. */
export function splitTopics(question: string): string[] {
  const parts = question
    .replace(/\?+$/, "")
    .split(/\s+and\s+|\s*&\s*|\s*,\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.split(/\s+/).length >= 2);
  return parts.length >= 2 ? parts.slice(0, 3) : [];
}

export type RankedList = { kind: "vec" | "kw"; ids: string[]; scores: number[] }; // best first; higher score = better

export const RRF_K = 60;
export const VEC_WEIGHT = 0.7;
export const RECENCY_BOOST = 0.02;

/** Fused score per id, scaled so the best is 1. rrf: sum of 1/(60+rank). weighted: 0.7 * vector + 0.3 * keyword, min-max per list. */
export function fuse(lists: RankedList[], mode: "rrf" | "weighted"): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: string, v: number) => out.set(id, (out.get(id) ?? 0) + v);
  if (mode === "rrf") {
    for (const l of lists) l.ids.forEach((id, r) => add(id, 1 / (RRF_K + r + 1)));
  } else {
    const best = new Map<string, number>(); // best normalized score per id and kind (several lists when the question was split)
    for (const l of lists) {
      const lo = Math.min(...l.scores);
      const span = Math.max(...l.scores) - lo;
      l.ids.forEach((id, r) => {
        const norm = span > 0 ? (l.scores[r] - lo) / span : 1;
        const w = l.kind === "vec" ? VEC_WEIGHT : 1 - VEC_WEIGHT;
        best.set(`${l.kind}|${id}`, Math.max(best.get(`${l.kind}|${id}`) ?? 0, w * norm));
      });
    }
    for (const [k, v] of best) add(k.slice(k.indexOf("|") + 1), v);
  }
  const max = Math.max(0, ...out.values());
  if (max > 0) for (const [id, v] of out) out.set(id, v / max);
  return out;
}

const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
function jaccard(a: Set<string>, b: Set<string>): number {
  let both = 0;
  for (const w of a) if (b.has(w)) both++;
  return both / (a.size + b.size - both || 1);
}

/** Ids that are the newest of a pair of near-duplicate chunks (word overlap >= 0.7, strictly newer saved date). */
export function newestOfDuplicates(items: { id: string; content: string; updatedAt: string }[]): Set<string> {
  const ws = items.map((i) => words(i.content));
  const newest = new Set<string>();
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++) {
      if (items[a].updatedAt === items[b].updatedAt || jaccard(ws[a], ws[b]) < 0.7) continue;
      newest.add(items[a].updatedAt > items[b].updatedAt ? items[a].id : items[b].id);
    }
  return newest;
}
