import { describe, expect, it } from "vitest";
import { chunkText } from "../src/rag/chunker.js";

const para = (n: number) => `${"Sentence number one is here. ".repeat(n)}`.trim();

describe("chunkText", () => {
  it("short text → one chunk", () => {
    expect(chunkText("Meet Ravi.")).toEqual(["Meet Ravi."]);
  });

  it("empty input → []", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("  \n\n ")).toEqual([]);
  });

  const long = Array.from({ length: 12 }, (_, i) => `P${i} ${para(15)}`).join("\n\n");

  it("long text → several chunks within the limit", () => {
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(2000);
  });

  it("consecutive chunks overlap", () => {
    const [a, b] = chunkText(long);
    const probe = a.slice(-100).split(" ").slice(2).join(" "); // text from end of chunk a
    expect(b.startsWith(a.slice(-300).trimStart().split(/\s/).slice(1).join(" ").slice(0, 20))).toBe(true);
    expect(b).toContain(probe);
  });

  it("splits one giant paragraph on sentence boundaries", () => {
    const chunks = chunkText(para(200));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(2000);
  });
});
