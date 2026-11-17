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
});
