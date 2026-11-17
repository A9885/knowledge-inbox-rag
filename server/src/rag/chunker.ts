export interface ChunkOptions {
  maxChars: number;
  overlapSentences: number;
}

const TINY_CHARS = 200;
const MAX_HEADING = 100;
// Headings are "#", "##" or "###" lines. URL text gets them from its h1-h3 tags (see fetchUrl.ts); a note can type them too.
const HEADING = /^#{1,3}\s+(\S.*?)\s*$/;

interface Group {
  sents: string[];
  fresh: number; // sents[0..fresh) repeat the end of the previous group (the overlap)
}

/** Splits at headings. Text before the first heading has an empty heading. */
function sections(text: string): { heading: string; body: string }[] {
  const out: { heading: string; lines: string[] }[] = [{ heading: "", lines: [] }];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const m = HEADING.exec(line.trim());
    if (m) out.push({ heading: m[1].slice(0, MAX_HEADING), lines: [] });
    else out.at(-1)!.lines.push(line);
  }
  return out.map((s) => ({ heading: s.heading, body: s.lines.join("\n") }));
}

const sentencesOf = (body: string): string[] =>
  body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((p) => p.split(/(?<=[.?!])\s+/));

const len = (sents: string[]) => sents.join(" ").length;

/** Packs sentences into groups of at most max chars; each new group starts with the last `overlap` sentences of the previous. */
function pack(sentences: string[], max: number, overlap: number): Group[] {
  const groups: Group[] = [];
  let cur: Group = { sents: [], fresh: 0 };
  for (let s of sentences) {
    while (s.length > max) {
      // one sentence longer than a chunk: hard cut
      if (cur.sents.length) groups.push(cur), (cur = { sents: [], fresh: 0 });
      groups.push({ sents: [s.slice(0, max)], fresh: 0 });
      s = s.slice(max);
    }
    if (cur.sents.length && len(cur.sents) + 1 + s.length > max) {
      groups.push(cur);
      const keep = overlap > 0 ? cur.sents.slice(-overlap) : [];
      while (keep.length && len(keep) + 1 + s.length > max) keep.shift();
      cur = { sents: keep, fresh: keep.length };
    }
    cur.sents.push(s);
  }
  if (cur.sents.length) groups.push(cur);
  return groups;
}

/** A group under TINY_CHARS joins the one before it (only its new sentences, not the overlap). The result may run up to TINY_CHARS over max. */
function mergeTiny(groups: Group[], max: number): Group[] {
  const out: Group[] = [];
  for (const g of groups) {
    const prev = out.at(-1);
    const fresh = g.sents.slice(g.fresh);
    if (prev && len(g.sents) < TINY_CHARS && len([...prev.sents, ...fresh]) <= max + TINY_CHARS) prev.sents.push(...fresh);
    else out.push(g);
  }
  return out;
}

/** Chunks never mix sections; inside a section, sentences are packed and overlap. Each chunk starts with "<heading>: ". */
export function chunkText(text: string, opts: ChunkOptions = { maxChars: 2000, overlapSentences: 2 }): string[] {
  const chunks: string[] = [];
  for (const { heading, body } of sections(text)) {
    const prefix = heading ? `${heading}: ` : "";
    const groups = mergeTiny(pack(sentencesOf(body), opts.maxChars - prefix.length, opts.overlapSentences), opts.maxChars - prefix.length);
    for (const g of groups) chunks.push(prefix + g.sents.join(" "));
  }
  return chunks;
}
