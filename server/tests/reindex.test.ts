import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ v: 1, failOn: "" }));
vi.mock("../src/lib/llm.js", () => ({
  embed: async (texts: string[]) => {
    if (state.failOn && texts.some((t) => t.includes(state.failOn))) throw new Error("provider down");
    return texts.map(() => [state.v, 1]);
  },
  chat: vi.fn(),
  chatStream: async function* () {},
}));
const { createApp } = await import("../src/app.js");
const { loadAllChunks } = await import("../src/db/chunks.repository.js");
const { reindexAll } = await import("../src/services/reindex.service.js");
const app = createApp();

describe("reindex", () => {
  it("re-embeds every item, is safe to re-run, and a failing item keeps its old chunks", async () => {
    for (const content of ["First note about apples and pears.", "Second note about trains and planes."])
      await request(app).post("/ingest").send({ type: "note", content });
    const firstVec = () => loadAllChunks().map((c) => c.embedding[0]);
    expect(firstVec()).toEqual([1, 1]);

    state.v = 2;
    expect(await reindexAll()).toEqual({ items: 2, failed: 0 });
    expect(firstVec()).toEqual([2, 2]);
    expect(await reindexAll()).toEqual({ items: 2, failed: 0 }); // again: same result, no duplicate chunks
    expect(loadAllChunks()).toHaveLength(2);

    state.v = 3;
    state.failOn = "trains";
    expect(await reindexAll()).toEqual({ items: 2, failed: 1 });
    expect(loadAllChunks().map((c) => c.embedding[0]).sort()).toEqual([2, 3]); // failed item untouched at 2
  });
});
