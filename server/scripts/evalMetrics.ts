// Pure metric helpers for the evaluation engine (no I/O, unit-tested).

/** An item matches an expected id when its title is the id or starts with "<id> " / "<id>:". */
export const titleMatches = (title: string, id: string) => title === id || title.startsWith(`${id} `) || title.startsWith(`${id}:`);

/** Share of expected items found in the first k ranked titles. */
export function recallAt(ranked: string[], expected: string[], k: number): number {
  if (!expected.length) return 0;
  const top = ranked.slice(0, k);
  return expected.filter((id) => top.some((t) => titleMatches(t, id))).length / expected.length;
}

/** 1 / rank of the first expected item (0 if none). */
export function reciprocalRank(ranked: string[], expected: string[]): number {
  const i = ranked.findIndex((t) => expected.some((id) => titleMatches(t, id)));
  return i < 0 ? 0 : 1 / (i + 1);
}

export const hitAt1 = (ranked: string[], expected: string[]): number => (ranked[0] && expected.some((id) => titleMatches(ranked[0], id)) ? 1 : 0);

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** Nearest-rank percentile, p in 0..100. */
export function percentile(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}
