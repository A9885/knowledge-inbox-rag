import request from "supertest";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/llm.js", () => ({
  embed: async (texts: string[]) =>
    texts.map((t) => {
      const v = new Array(256).fill(0);
      for (const w of t.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        let h = 0;
        for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) % 256;
        v[h] += 1;
      }
      return v;
    }),
  chat: vi.fn(async () => "Answer. [1]"),
  chatStream: async function* () {},
}));

const { createApp } = await import("../src/app.js");
const { loadAllChunks } = await import("../src/db/chunks.repository.js");
const { insertItem } = await import("../src/db/items.repository.js");
const app = createApp();
const ask = async (question: string) => (await request(app).post("/query").send({ question })).body;

describe("edit & delete", () => {
  it("PATCH changes the retrieval result and updatedAt", async () => {
    const { item } = (await request(app).post("/ingest").send({ type: "note", content: "Parking spot is level two near the elevator." })).body;
    expect((await ask("parking spot level two elevator")).sources[0].itemId).toBe(item.id);

    const res = await request(app).patch(`/items/${item.id}`).send({ content: "Locker combination is seventeen thirty nine." });
    expect(res.status).toBe(200);
    expect(res.body.item.title).toContain("Locker");
    expect(Date.parse(res.body.item.updatedAt)).toBeGreaterThanOrEqual(Date.parse(item.createdAt));

    expect((await ask("parking spot level two elevator")).sources).toEqual([]); // old text is gone
    const after = await ask("locker combination seventeen thirty nine");
    expect(after.sources[0]).toMatchObject({ itemId: item.id, updatedAt: res.body.item.updatedAt });
    expect((await request(app).get(`/items/${item.id}`)).body.item.content).toBe("Locker combination is seventeen thirty nine.");
  });

  it("PATCH on a URL → 409 NOT_EDITABLE; unknown id → 404", async () => {
    const id = randomUUID();
    insertItem({ id, type: "url", sourceUrl: "https://example.com", title: "Example", rawContent: "page", createdAt: new Date().toISOString() });
    const res = await request(app).patch(`/items/${id}`).send({ content: "new text here" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "NOT_EDITABLE" });
    expect((await request(app).patch(`/items/${randomUUID()}`).send({ content: "x" })).body.error.code).toBe("ITEM_NOT_FOUND");
    expect((await request(app).patch(`/items/${id}`).send({})).status).toBe(400);
  });

  it("DELETE removes the item and its chunks", async () => {
    const { item } = (await request(app).post("/ingest").send({ type: "note", content: "Delete me please, temporary reminder." })).body;
    expect(loadAllChunks().some((c) => c.itemId === item.id)).toBe(true);
    expect((await request(app).delete(`/items/${item.id}`)).status).toBe(204);
    expect(loadAllChunks().some((c) => c.itemId === item.id)).toBe(false);
    expect((await request(app).delete(`/items/${item.id}`)).status).toBe(404);
  });
});
