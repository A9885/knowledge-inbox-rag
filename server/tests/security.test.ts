import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// Mocked model (no network): these tests check what OUR code does with hostile input, not what a real LLM says.
vi.mock("../src/lib/llm.js", () => ({
  embed: async (texts: string[]) =>
    texts.map((t) => {
      const v = new Array(64).fill(0);
      for (const w of t.toLowerCase().match(/[a-z0-9]+/g) ?? []) v[w.charCodeAt(0) % 64] += 1;
      return v;
    }),
  chat: vi.fn(async () => "I couldn't find that in your saved content."),
  chatStream: async function* () {},
}));

const { createApp } = await import("../src/app.js");
const { chat } = await import("../src/lib/llm.js");
const app = createApp();

describe("input and error safety", () => {
  it("stores markup as plain text (the client renders text nodes only)", async () => {
    const xss = "<script>alert(1)</script><img src=x onerror=alert(1)> teapot facts";
    expect((await request(app).post("/ingest").send({ type: "note", content: xss })).status).toBe(201);
    const items = await request(app).get("/items");
    expect(items.body.items.some((i: { preview: string }) => i.preview.includes("<script>alert(1)</script>"))).toBe(true);
  });

  it("FTS5 operators and punctuation in a question don't crash search", async () => {
    for (const q of ['"quoted" AND OR NOT', "NEAR(a b) * : ( )", '"', "*", "a OR"]) {
      expect((await request(app).post("/query").send({ question: q })).status, q).toBe(200);
    }
  });

  it("a question about something never saved gets the exact not-found line, no sources", async () => {
    const res = await request(app).post("/query").send({ question: "What is my bank account number?" });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBe("I couldn't find that in your saved content.");
    expect(res.body.sources).toEqual([]);
  });

  it("an unexpected failure returns a generic 500 with a request id and no internals", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error("boom at /Users/me/secret/path.ts SELECT * FROM items"));
    await request(app).post("/ingest").send({ type: "note", content: "Pottery class is on Sundays at five." });
    const res = await request(app).post("/query").send({ question: "pottery class Sundays" });
    const text = JSON.stringify(res.body);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(text).not.toMatch(/boom|\/Users|SELECT|stack/);
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("CORS: only localhost origins are allowed", async () => {
    const ok = await request(app).get("/health").set("Origin", "http://localhost:5173");
    const bad = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
