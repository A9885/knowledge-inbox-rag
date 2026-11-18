import { describe, expect, it } from "vitest";
import { finalize } from "../src/services/query.service.js";
import type { ScoredChunk } from "../src/rag/retriever.js";

const hit = (i: number) => ({ itemId: `i${i}`, title: `Item ${i}`, content: `text ${i}`, score: 0.9 }) as unknown as ScoredChunk;
const hits = [1, 2, 3, 4].map(hit);

describe("citation renumbering", () => {
  it("one cited source reads [1], not its retrieval position", () => {
    const r = finalize("Trip is booked [4].", hits);
    expect(r.answer).toBe("Trip is booked [1].");
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0]).toMatchObject({ ref: 1, cited: true, title: "Item 4" });
  });

  it("several sources are numbered 1..k in order of first appearance, repeats reuse the number", () => {
    const r = finalize("A [3] and B [1], again A [3].", hits);
    expect(r.answer).toBe("A [1] and B [2], again A [1].");
    expect(r.sources.map((s) => [s.ref, s.title])).toEqual([
      [1, "Item 3"],
      [2, "Item 1"],
    ]);
  });
});
