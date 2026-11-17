import { describe, expect, it, vi } from "vitest";

// Unit vectors at a chosen cosine to the query [1, 0].
const at = (cos: number) => new Float32Array([cos, Math.sqrt(1 - cos * cos)]);
const chunk = (title: string, cos: number) => ({ chunkId: title, itemId: title, title, type: "note", sourceUrl: null, content: title, flagged: false, updatedAt: "", embedding: at(cos) });
const stored = [chunk("best", 0.82), chunk("second", 0.65), chunk("meh", 0.55), chunk("noise", 0.3)];
vi.mock("../src/db/chunks.repository.js", () => ({ loadAllChunks: () => stored }));

const { retrieveTopK } = await import("../src/rag/retriever.js");

describe("relevance filter", () => {
  it("keeps two relevant notes (0.82 and 0.65) and drops the weaker ones", () => {
    const { hits } = retrieveTopK(new Float32Array([1, 0]));
    expect(hits.map((h) => h.title)).toEqual(["best", "second"]);
  });

  it("without a strong match, only the window applies", () => {
    stored.splice(0, 2); // best is now 0.55: nothing reaches 0.6, window is 0.55-0.12
    expect(retrieveTopK(new Float32Array([1, 0])).hits.map((h) => h.title)).toEqual(["meh"]);
  });
});
