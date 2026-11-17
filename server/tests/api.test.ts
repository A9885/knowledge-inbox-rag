import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// Fake embeddings: hashed bag-of-words, so overlapping words → similar vectors.
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
  chat: vi.fn(async (system: string) =>
    system.includes("rewrite a follow-up")
      ? "When is my meeting with Ravi?"
      : "Your meeting with Ravi is on Friday at 3 PM. [1]\n\nSuggestions:\n- What is the budget meeting about?\n- Who else is attending?"),
  chatStream: async function* () {
    const text =
      "Your meeting with Ravi is on Friday at 3 PM. [1]\n\nSuggestions:\n- What is the budget meeting about?\n- Who else is attending?";
    for (let i = 0; i < text.length; i += 7) yield text.slice(i, i + 7);
  },
}));

const { createApp } = await import("../src/app.js");
const { chat } = await import("../src/lib/llm.js");
const app = createApp();
const NOTE = "Meeting with Ravi on Friday at 3 PM about the budget.";

describe("api", () => {
  it("POST /ingest with empty body → 400 in error shape", async () => {
    const res = await request(app).post("/ingest").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.requestId).toBeTruthy();
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("rejects non-http url", async () => {
    const res = await request(app).post("/ingest").send({ type: "url", content: "ftp://x.com" });
    expect(res.status).toBe(400);
  });

  it("private-network url → 422 URL_NOT_ALLOWED", async () => {
    const res = await request(app).post("/ingest").send({ type: "url", content: "http://localhost:4000/health" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("URL_NOT_ALLOWED");
  });

  it("valid note → 201", async () => {
    const res = await request(app).post("/ingest").send({ type: "note", content: NOTE });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ type: "note", chunkCount: 1, status: "ready" });
  });

  it("GET /items returns the note", async () => {
    const res = await request(app).get("/items");
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].preview).toBe(NOTE);
    expect(res.body.items[0]).not.toHaveProperty("raw_content");
  });

  it("POST /query → answer with sources", async () => {
    const res = await request(app).post("/query").send({ question: "When is my meeting with Ravi?" });
    expect(res.status).toBe(200);
    expect(res.body.answer).toContain("[1]");
    expect(res.body.answer).not.toContain("Suggestions");
    expect(res.body.suggestions).toEqual(["What is the budget meeting about?", "Who else is attending?"]);
    expect(res.body.sources[0]).toMatchObject({ ref: 1, type: "note", cited: true });
  });

  it("POST /query/stream → tokens without suggestions, then done event", async () => {
    const res = await request(app)
      .post("/query/stream")
      .send({ question: "When is my meeting with Ravi?" })
      .buffer(true)
      .parse((r, cb) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => cb(null, d));
      });
    const events = (res.body as string)
      .trim()
      .split("\n\n")
      .map((b) => ({ event: b.match(/^event: (.*)$/m)![1], data: JSON.parse(b.match(/^data: (.*)$/m)![1]) }));
    const streamed = events.filter((e) => e.event === "token").map((e) => e.data.t).join("");
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(events.filter((e) => e.event === "token").length).toBeGreaterThan(1);
    expect(streamed).not.toContain("Suggestions");
    expect(streamed.trim()).toBe("Your meeting with Ravi is on Friday at 3 PM. [1]");
    const done = events.at(-1)!;
    expect(done.event).toBe("done");
    expect(done.data.sources[0]).toMatchObject({ ref: 1, cited: true });
    expect(done.data.suggestions).toHaveLength(2);
  });

  it("stream: validation error is a normal 400", async () => {
    const res = await request(app).post("/query/stream").send({});
    expect(res.status).toBe(400);
  });

  it("unrelated question → fallback, no sources, no LLM", async () => {
    const res = await request(app).post("/query").send({ question: "zzz qqq xxx" });
    expect(res.body.answer).toBe("I couldn't find that in your saved content.");
    expect(res.body.sources).toEqual([]);
  });

  it("conversation: turns are saved, and a follow-up is rewritten using the chat's memory", async () => {
    const { id } = (await request(app).post("/conversations")).body.conversation;
    const first = await request(app).post("/query").send({ question: "When is my meeting with Ravi?", conversationId: id });
    expect(first.status).toBe(200);
    expect(chat).not.toHaveBeenCalledWith(expect.stringContaining("rewrite a follow-up"), expect.anything()); // first turn: no rewrite

    const second = await request(app).post("/query").send({ question: "and what is it about?", conversationId: id });
    expect(second.body.sources[0]).toMatchObject({ type: "note" });
    expect(chat).toHaveBeenCalledWith(expect.stringContaining("rewrite a follow-up"), expect.stringContaining("and what is it about?"));

    const rewrites = () => vi.mocked(chat).mock.calls.filter(([sys]) => sys.includes("rewrite a follow-up")).length;
    const before = rewrites();
    await request(app).post("/query").send({ question: "When is my meeting with Ravi on Friday about the budget?", conversationId: id });
    expect(rewrites()).toBe(before); // standalone question: no rewrite, so old topics cannot leak in

    const msgs = (await request(app).get(`/conversations/${id}`)).body.messages;
    expect(msgs.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user", "assistant"]);
    expect(msgs[1].sources[0]).toMatchObject({ ref: 1 });

    const list = (await request(app).get("/conversations")).body.conversations;
    expect(list.find((c: { id: string }) => c.id === id).title).toBe("When is my meeting with Ravi?");

    expect((await request(app).delete(`/conversations/${id}`)).status).toBe(204);
    expect((await request(app).get(`/conversations/${id}`)).status).toBe(404);
  });

  it("query with an unknown conversationId → 404", async () => {
    const res = await request(app).post("/query/stream").send({ question: "hi", conversationId: "nope" });
    expect(res.status).toBe(404);
  });

  it("unknown route → 404 NOT_FOUND", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /health", async () => {
    expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
  });
});
