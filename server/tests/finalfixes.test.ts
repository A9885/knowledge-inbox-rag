import { describe, expect, it } from "vitest";
import { canonicalUrl, looksBlocked } from "../src/lib/pageCheck.js";
import { isTopic } from "../src/rag/prompt.js";
import { finalize } from "../src/services/query.service.js";
import type { ScoredChunk } from "../src/rag/retriever.js";

describe("canonicalUrl", () => {
  it("same page, however typed: host case, trailing slash, #hash, utm_*", () => {
    const a = canonicalUrl("HTTPS://Example.com/a/b/?utm_source=x&id=7#top");
    expect(a).toBe("https://example.com/a/b?id=7");
    expect(canonicalUrl("https://example.com/a/b?id=7")).toBe(a);
    expect(canonicalUrl("https://example.com/a/b?id=8")).not.toBe(a); // a real parameter is kept
  });
});

describe("looksBlocked", () => {
  it("rejects bot-check pages, keeps real ones", () => {
    expect(looksBlocked("Checking your browser - reCAPTCHA", "Please wait while we verify.".repeat(20))).toBe(true);
    expect(looksBlocked("Home", "Just a moment... enable JavaScript and cookies to continue")).toBe(true);
    expect(looksBlocked("Training - Courses", "Welcome to Microsoft Learn. ".repeat(100))).toBe(false);
    expect(looksBlocked("How reCAPTCHA works", "A long article about captcha design. ".repeat(80))).toBe(false); // long text that merely mentions it
  });
});

describe("isTopic", () => {
  it("one to three words is a topic search", () => {
    for (const q of ["movie", "any movie?", "how to build?"]) expect(isTopic(q)).toBe(true);
    for (const q of ["Which movies have I saved?", "When is my mom's birthday?"]) expect(isTopic(q)).toBe(false);
  });
});

describe("finalize: one source per item", () => {
  const hit = (i: number, itemId: string) => ({ itemId, chunkId: `c${i}`, title: `T ${itemId}`, type: "note", content: "x", score: 0.9, updatedAt: "2026-01-01", sourceUrl: null }) as unknown as ScoredChunk;
  it("two chunks of one item are cited as one source", () => {
    const r = finalize("A [1] and B [2] and C [3].", [hit(1, "a"), hit(2, "a"), hit(3, "b")]);
    expect(r.answer).toBe("A [1] and B [1] and C [2].");
    expect(r.sources.map((s) => s.itemId)).toEqual(["a", "b"]);
  });
});
