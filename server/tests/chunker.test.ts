import { describe, expect, it } from "vitest";
import { chunkText } from "../src/rag/chunker.js";

const sent = (i: number) => `Sentence number ${i} is here and says something quite specific about topic ${i}.`;
const sentences = (from: number, n: number) => Array.from({ length: n }, (_, k) => sent(from + k)).join(" ");

describe("chunkText", () => {
  it("short text → one chunk", () => {
    expect(chunkText("Meet Ravi.")).toEqual(["Meet Ravi."]);
  });

  it("empty input → []", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("  \n\n ")).toEqual([]);
    expect(chunkText("# Only a heading")).toEqual([]);
  });

  const long = Array.from({ length: 12 }, (_, i) => `P${i} ${sentences(i * 100, 15)}`).join("\n\n");

  it("long text → several chunks within the limit", () => {
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(2200); // 2000 plus at most one merged tiny tail
  });

  it("consecutive chunks overlap by their last 2 sentences", () => {
    const [a, b] = chunkText(sentences(0, 60));
    const lastTwo = a.split(/(?<=\.)\s/).slice(-2).join(" ");
    expect(b.startsWith(lastTwo)).toBe(true);
  });

  it("splits one giant paragraph on sentence boundaries", () => {
    const chunks = chunkText(sentences(0, 300));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(2200);
      expect(c.endsWith(".")).toBe(true);
    }
  });

  it("sections never mix, and each chunk starts with its heading", () => {
    const text = `Intro line here.\n\n# Alpha\n\n${sentences(0, 5)}\n\n## Beta\n\n${sentences(50, 5)}`;
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toBe("Intro line here.");
    expect(chunks[1].startsWith("Alpha: Sentence number 0")).toBe(true);
    expect(chunks[1]).not.toContain("Sentence number 50");
    expect(chunks[2].startsWith("Beta: Sentence number 50")).toBe(true);
  });

  it("a tiny trailing chunk is merged into the one before it, without repeating the overlap", () => {
    const body = sentences(0, 24); // fills the first chunk almost completely...
    const chunks = chunkText(`${body} Tail.`, { maxChars: body.length + 5, overlapSentences: 2 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].endsWith("Tail.")).toBe(true);
    expect(chunks[0].match(/Sentence number 23 /g)).toHaveLength(1);
  });
});
