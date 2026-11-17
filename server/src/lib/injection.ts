// Heuristic only: flags instruction-like text for the user to see. It never blocks anything.
const PATTERNS = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now/i,
  /system\s+prompt/i,
  /disregard\s.{0,30}instructions/i,
];

export const looksLikeInjection = (text: string): boolean => PATTERNS.some((p) => p.test(text));
