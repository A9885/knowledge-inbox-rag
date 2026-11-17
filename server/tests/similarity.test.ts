import { expect, it } from "vitest";
import { cosineSimilarity } from "../src/rag/similarity.js";

it("identical vectors → 1", () => {
  expect(cosineSimilarity(new Float32Array([1, 2, 3]), new Float32Array([1, 2, 3]))).toBeCloseTo(1);
});

it("orthogonal vectors → 0", () => {
  expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBe(0);
});

it("zero vector → 0, not NaN", () => {
  expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0);
});
