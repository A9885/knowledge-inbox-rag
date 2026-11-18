import { describe, expect, it } from "vitest";
import { fuse, ftsQuery, newestOfDuplicates, splitTopics } from "../src/rag/hybrid.js";

describe("hybrid helpers", () => {
  it("ftsQuery quotes every word so punctuation and operators cannot break MATCH", () => {
    expect(ftsQuery('Who has code EMP-4471?')).toBe('"code" OR "codes" OR "emp-4471" OR "emp-4471s"');
    expect(ftsQuery("any movies?")).toBe('"movies" OR "movie"'); // singular and plural both searched; "any" is a stopword
    const nasty = ftsQuery('foo" OR (bar* NEAR/2 baz) AND ^x : - "');
    expect(nasty).not.toMatch(/[*()^:]/);
    expect(nasty.match(/"/g)!.length % 2).toBe(0);
    expect(ftsQuery("?!*")).toBe("");
  });

  it("splits multi-topic questions on and / & / commas, max 3 parts", () => {
    expect(splitTopics("gym plan and mom birthday?")).toEqual(["gym plan", "mom birthday"]);
    expect(splitTopics("gym plan & mom birthday, goa trip, wifi password")).toEqual(["gym plan", "mom birthday", "goa trip"]);
    expect(splitTopics("When is the meeting?")).toEqual([]);
    expect(splitTopics("rock and roll")).toEqual([]); // parts under 2 words are not topics
  });

  it("RRF puts an item found by both searches first", () => {
    const f = fuse(
      [
        { kind: "vec", ids: ["a", "b", "c"], scores: [0.9, 0.8, 0.7] },
        { kind: "kw", ids: ["c", "d"], scores: [5, 2] },
      ],
      "rrf",
    );
    const order = [...f].sort((x, y) => y[1] - x[1]).map(([id]) => id);
    expect(order[0]).toBe("c"); // 1/63 + 1/61 beats a's 1/61
    expect(order).toEqual(["c", "a", "b", "d"]);
    expect(f.get("c")).toBe(1);
  });

  it("weighted fusion is 0.7 vector + 0.3 keyword, min-max per list", () => {
    const f = fuse(
      [
        { kind: "vec", ids: ["a", "b"], scores: [0.9, 0.5] },
        { kind: "kw", ids: ["b", "a"], scores: [8, 2] },
      ],
      "weighted",
    );
    // a: 0.7*1 + 0.3*0 = 0.7 ; b: 0.7*0 + 0.3*1 = 0.3 ; scaled so best = 1
    expect(f.get("a")).toBe(1);
    expect(f.get("b")).toBeCloseTo(0.3 / 0.7);
  });

  it("flags the newest of near-duplicate chunks only", () => {
    const items = [
      { id: "old", content: "Gym moved to 6 AM on weekdays", updatedAt: "2026-01-01" },
      { id: "new", content: "Gym moved to 7 AM on weekdays", updatedAt: "2026-02-01" },
      { id: "other", content: "Wifi password is on the fridge", updatedAt: "2026-03-01" },
    ];
    expect([...newestOfDuplicates(items)]).toEqual(["new"]);
  });
});
