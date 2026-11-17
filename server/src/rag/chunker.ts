export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

const MIN_CHARS = 50;

/** Greedily pack sentences into pieces <= max; hard-cut any single sentence longer than max. */
function splitLong(paragraph: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (let s of paragraph.split(/(?<=[.?!])\s+/)) {
    while (s.length > max) {
      if (cur) out.push(cur), (cur = "");
      out.push(s.slice(0, max));
      s = s.slice(max);
    }
    if (cur && cur.length + 1 + s.length > max) out.push(cur), (cur = s);
    else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

/** Last n chars, starting at a word boundary. */
function tail(s: string, n: number): string {
  if (n <= 0) return "";
  if (s.length <= n) return s;
  const t = s.slice(-n);
  return s[s.length - n - 1] === " " || s[s.length - n - 1] === "\n" ? t : t.slice(t.search(/\s/) + 1);
}

export function chunkText(
  text: string,
  opts: ChunkOptions = { maxChars: 2000, overlapChars: 300 },
): string[] {
  const { maxChars, overlapChars } = opts;
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const units = paragraphs.flatMap((p) => (p.length <= maxChars ? [p] : splitLong(p, maxChars)));

  const chunks: string[] = [];
  let cur = "";
  for (const u of units) {
    if (cur && cur.length + 2 + u.length <= maxChars) {
      cur += `\n\n${u}`;
      continue;
    }
    if (cur) chunks.push(cur);
    // Seed the next chunk with overlap from the previous one, as long as it still fits.
    const room = maxChars - u.length - 2;
    const overlap = cur ? tail(cur, Math.min(overlapChars, room)) : "";
    cur = overlap ? `${overlap}\n\n${u}` : u;
  }
  if (cur) chunks.push(cur);

  return chunks.length === 1 ? chunks : chunks.filter((c) => c.length >= MIN_CHARS);
}
