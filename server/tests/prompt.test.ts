import { describe, expect, it } from "vitest";
import { buildUserMessage, SYSTEM_PROMPT } from "../src/rag/prompt.js";

const chunk = (title: string, updatedAt: string) =>
  ({ chunkId: title, itemId: title, title, type: "note", sourceUrl: null, content: "text", flagged: false, updatedAt, score: 0.9 }) as const;

describe("dated sources", () => {
  it("each source carries its last-updated date, and the system prompt says newest wins", () => {
    const msg = buildUserMessage("q?", [chunk("Old plan", "2026-01-05T10:00:00.000Z"), chunk("New plan", "2026-11-18T09:00:00.000Z")]);
    expect(msg).toContain('title="Old plan" saved="2026-01-05"');
    expect(msg).toContain('title="New plan" saved="2026-11-18"');
    expect(SYSTEM_PROMPT).toContain("trust the most recently saved one");
  });
});
