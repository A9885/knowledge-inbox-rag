import { describe, expect, it, vi } from "vitest";

vi.mock("../src/db/chunks.repository.js", () => ({ loadAllChunks: () => [], loadChunksOfItem: () => [] }));
const { InMemoryVectorIndex } = await import("../src/rag/vectorIndex.js");
const { cosineSimilarity } = await import("../src/rag/similarity.js");

const chunk = (itemId: string, id: string, v: number[]) =>
  ({ chunkId: id, itemId, title: itemId, type: "note", sourceUrl: null, content: id, flagged: false, updatedAt: "", embedding: Float32Array.from(v) }) as const;

describe("InMemoryVectorIndex", () => {
  const make = () => {
    const idx = new InMemoryVectorIndex();
    idx.upsert("a", [chunk("a", "a1", [1, 0, 0]), chunk("a", "a2", [0, 5, 0])]); // stored length doesn't matter: normalized
    idx.upsert("b", [chunk("b", "b1", [1, 1, 0])]);
    return idx;
  };

  it("scores equal cosine similarity and returns the best k first", () => {
    const q = Float32Array.from([2, 1, 0]);
    const hits = make().search(q, 2);
    expect(hits.map((h) => h.chunkId)).toEqual(["b1", "a1"]);
    expect(hits[0].score).toBeCloseTo(cosineSimilarity(q, Float32Array.from([1, 1, 0])), 5);
    expect(hits[1].score).toBeCloseTo(cosineSimilarity(q, Float32Array.from([1, 0, 0])), 5);
  });

  it("upsert replaces an item's chunks and deleteItem removes them", () => {
    const idx = make();
    idx.upsert("a", [chunk("a", "a3", [0, 0, 1])]);
    expect(idx.search(Float32Array.from([0, 1, 0]), 5).map((h) => h.chunkId)).not.toContain("a2");
    expect(idx.search(Float32Array.from([0, 0, 1]), 1)[0].chunkId).toBe("a3");
    idx.deleteItem("a");
    expect(idx.search(Float32Array.from([1, 0, 0]), 5).map((h) => h.chunkId)).toEqual(["b1"]);
    idx.deleteItem("b");
    expect(idx.search(Float32Array.from([1, 0, 0]), 5)).toEqual([]);
  });
});
