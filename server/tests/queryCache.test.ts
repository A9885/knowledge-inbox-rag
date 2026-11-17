import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const embed = vi.fn(async (texts: string[]) => texts.map((t) => [t.length, 1, 0]));
vi.mock("../src/lib/llm.js", () => ({ embed }));
const { embedQueries } = await import("../src/rag/embedder.js");
const { QueryEmbeddingCache, cacheKey } = await import("../src/rag/queryCache.js");

describe("query embedding cache", () => {
  it("a repeated question skips the embed call; only misses are sent, in one request", async () => {
    await embedQueries(["when is the meeting"]);
    expect(embed).toHaveBeenCalledTimes(1);
    const again = await embedQueries(["when is the meeting"]);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(again[0]).toEqual([19, 1, 0]);

    await embedQueries(["when is the meeting", "gym plan", "gym plan"]);
    expect(embed).toHaveBeenCalledTimes(2);
    expect(embed.mock.calls[1][0]).toEqual(["gym plan"]);
  });

  it("evicts the least recently used entry beyond 500... (tiny max here) and expires after the TTL", () => {
    let t = 0;
    const c = new QueryEmbeddingCache(2, 1000, undefined, () => t);
    c.set("a", [1]);
    c.set("b", [2]);
    c.get("a"); // a is now newer than b
    c.set("c", [3]);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toEqual([1]);
    t = 2000;
    expect(c.get("a")).toBeUndefined();
  });

  it("the eval file cache reads and writes a JSON file in the given dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "embcache-"));
    try {
      const k = cacheKey("m", "hello");
      new QueryEmbeddingCache(500, 1000, dir).set(k, [0.5, 0.25]);
      expect(JSON.parse(readFileSync(join(dir, "embeddings.json"), "utf8"))[k]).toEqual([0.5, 0.25]);
      expect(new QueryEmbeddingCache(500, 1000, dir).get(k)).toEqual([0.5, 0.25]); // a new process would see it
      expect(cacheKey("m2", "hello")).not.toBe(k); // different model, different key
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
