import { describe, expect, it, vi } from "vitest";

process.env.RETRIEVAL_MODE = "hybrid"; // set before the config module loads

vi.mock("../src/lib/llm.js", () => ({
  embed: async (texts: string[]) =>
    texts.map((t) => {
      const v = new Array(256).fill(0.01);
      for (const w of t.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        let h = 0;
        for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) % 256;
        v[h] += 1;
      }
      return v;
    }),
}));

const { ingest } = await import("../src/services/ingest.service.js");
const { editItem, removeItem } = await import("../src/services/items.service.js");
const { searchKeywords } = await import("../src/db/chunks.repository.js");
const { retrieve } = await import("../src/rag/retrieve.js");
const { db } = await import("../src/db/connection.js");

describe("keyword index (FTS5)", () => {
  it("hybrid retrieval finds a keyword-only match and reports ranks", async () => {
    const a = await ingest({ type: "note", content: "Aarav Mehta works in Pune. Employee code EMP-4471." });
    await ingest({ type: "note", content: "Gym plan: Mon chest, Tue back, Wed legs." });
    const { candidates, hits } = await retrieve("EMP-4471", 5);
    expect(candidates[0].title).toContain("Aarav Mehta");
    expect(candidates[0].kwRank).toBe(1);
    expect(candidates[0].finalRank).toBe(1);
    expect(hits[0].itemId).toBe(a.id);
    expect(await retrieve("???? \" ( * ) AND", 5)).toBeTruthy(); // punctuation-only text must not throw
  });

  it("stays in sync on PATCH and DELETE", async () => {
    const item = await ingest({ type: "note", content: "Landlord is Mr Sharma and rent is due on the fifth." });
    expect(searchKeywords('"sharma"', 5).map((r) => r.itemId)).toContain(item.id);

    await editItem(item.id, "Landlord is Mr Verma and rent is due on the fifth.");
    expect(searchKeywords('"sharma"', 5).map((r) => r.itemId)).not.toContain(item.id);
    expect(searchKeywords('"verma"', 5).map((r) => r.itemId)).toContain(item.id);
    // title follows the edit
    expect((db.prepare("SELECT title FROM chunks_fts WHERE chunk_id IN (SELECT id FROM chunks WHERE item_id = ?)").get(item.id) as { title: string }).title).toContain("Verma");

    removeItem(item.id);
    expect(searchKeywords('"verma"', 5)).toEqual([]);
    expect((db.prepare("SELECT COUNT(*) AS n FROM chunks_fts WHERE chunk_id NOT IN (SELECT id FROM chunks)").get() as { n: number }).n).toBe(0);
  });
});
