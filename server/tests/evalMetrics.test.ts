import { describe, expect, it } from "vitest";
import { hitAt1, percentile, recallAt, reciprocalRank, titleMatches } from "../scripts/evalMetrics.js";

const ranked = ["Priya Nayar lives in Hyderabad", "UPDATE Rohan Gill: as of 10 Nov", "Priya Nair lives in Kochi", "Sana Qureshi lives in"];

describe("eval metrics", () => {
  it("matches titles by id prefix, not by substring", () => {
    expect(titleMatches("Priya Nair lives in Kochi", "Priya Nair")).toBe(true);
    expect(titleMatches("Priya Nayar lives in Hyderabad", "Priya Nair")).toBe(false);
    expect(titleMatches("UPDATE Rohan Gill: as of", "Rohan Gill")).toBe(false);
    expect(titleMatches("UPDATE Rohan Gill: as of", "UPDATE Rohan Gill")).toBe(true);
  });
  it("computes Recall@k, MRR and Hit@1 on a fixture", () => {
    expect(recallAt(ranked, ["Priya Nair", "Sana Qureshi"], 3)).toBe(0.5);
    expect(recallAt(ranked, ["Priya Nair", "Sana Qureshi"], 5)).toBe(1);
    expect(reciprocalRank(ranked, ["Priya Nair"])).toBeCloseTo(1 / 3);
    expect(reciprocalRank(ranked, ["Nobody"])).toBe(0);
    expect(hitAt1(ranked, ["Priya Nayar"])).toBe(1);
    expect(hitAt1(ranked, ["Priya Nair"])).toBe(0);
  });
  it("computes percentiles", () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(100);
  });
});
