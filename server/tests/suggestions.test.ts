import { describe, expect, it, vi } from "vitest";

const stored = [{ embedding: new Float32Array([1, 0]) }];
vi.mock("../src/db/chunks.repository.js", () => ({ loadAllChunks: () => stored }));
const embed = vi.fn();
vi.mock("../src/lib/llm.js", () => ({ embed }));
const { relevantSuggestions } = await import("../src/services/suggestions.js");

describe("suggestion filter", () => {
  it("removes an unrelated suggestion, keeps a related one, in a single batched call", async () => {
    embed.mockResolvedValueOnce([[0.9, 0.436], [0.1, 0.995]]); // cosine 0.9 and 0.1 to the stored chunk
    expect(await relevantSuggestions(["related?", "unrelated?"])).toEqual(["related?"]);
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it("returns no suggestions (and does not throw) when embedding fails", async () => {
    embed.mockRejectedValueOnce(new Error("quota"));
    expect(await relevantSuggestions(["anything?"])).toEqual([]);
  });
});
