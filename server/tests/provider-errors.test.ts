import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Real llm.ts / embedder / services; only the OpenAI SDK is faked.
const chatCreate = vi.fn();
const embedCreate = vi.fn();
vi.mock("openai", () => ({ default: class { chat = { completions: { create: chatCreate } }; embeddings = { create: embedCreate }; } }));
vi.mock("../src/config.js", () => ({
  config: {
    GEMINI_API_KEY: "g", NVIDIA_API_KEY: "n", EMBEDDING_MODEL: "e", LOG_LEVEL: "silent", DEBUG: false,
    RELEVANCE_WINDOW: 0.12, RELEVANCE_HIGH_SCORE: 0.6, RETRIEVAL_MODE: "vector", HYBRID_FUSION: "rrf",
    LLM_FIRST_TOKEN_TIMEOUT_MS: 50, LLM_REQUEST_TIMEOUT_MS: 50, DB_PATH: ":memory:",
  },
}));

const { createApp } = await import("../src/app.js");
const app = createApp();
const vec = (n: number) => ({ data: [{ index: 0, embedding: [n, 1 - n, 0.2] }] });
const unavailable = () => Object.assign(new Error("overloaded"), { status: 503 });
const quota = () => Object.assign(new Error("429 quota"), { status: 429 });

beforeEach(() => {
  chatCreate.mockReset();
  embedCreate.mockReset();
});

describe("provider failures", () => {
  it("both answer providers failing → clean 502 LLM_FAILED after exactly two attempts", async () => {
    embedCreate.mockResolvedValue(vec(0.9));
    expect((await request(app).post("/ingest").send({ type: "note", content: "Gym plan on Monday is chest." })).status).toBe(201);
    chatCreate.mockRejectedValueOnce(unavailable()).mockRejectedValueOnce(unavailable());
    const res = await request(app).post("/query").send({ question: "gym plan monday chest" });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({ code: "LLM_FAILED" });
    expect(res.body.error.requestId).toBeTruthy();
    expect(chatCreate).toHaveBeenCalledTimes(2);
  });

  it("embedding 429 on /ingest → 429 PROVIDER_QUOTA with the free-tier message", async () => {
    embedCreate.mockRejectedValue(quota());
    const res = await request(app).post("/ingest").send({ type: "note", content: "Anything at all." });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("PROVIDER_QUOTA");
    expect(res.body.error.message).toContain("~1000 embedding requests a day");
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("embedding 429 on /query and /query/stream", async () => {
    embedCreate.mockRejectedValue(quota());
    const res = await request(app).post("/query").send({ question: "anything" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("PROVIDER_QUOTA");

    const sse = await request(app).post("/query/stream").send({ question: "anything" });
    expect(sse.text).toContain("event: error");
    expect(sse.text).toContain("PROVIDER_QUOTA");
    expect(sse.text).toContain("Gemini quota reached");
  });

  it("chat 429 → PROVIDER_QUOTA (not LLM_FAILED), no fallback", async () => {
    embedCreate.mockResolvedValue(vec(0.9));
    await request(app).post("/ingest").send({ type: "note", content: "Rent is due on the fifth." });
    chatCreate.mockRejectedValue(quota());
    const res = await request(app).post("/query").send({ question: "rent due fifth" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("PROVIDER_QUOTA");
    expect(res.body.error.message).toContain("answer model");
    expect(chatCreate).toHaveBeenCalledTimes(1);
  });
});
