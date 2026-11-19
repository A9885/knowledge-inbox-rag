import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Both keys set, short timeouts (set before config loads). Only the openai SDK is mocked, so the real fallback code runs.
process.env.NVIDIA_API_KEY = "n";
process.env.LLM_REQUEST_TIMEOUT_MS = "50";
process.env.LLM_FIRST_TOKEN_TIMEOUT_MS = "50";

const create = vi.fn();
const vec = (t: string) => {
  const v = new Array(64).fill(0);
  for (const w of t.toLowerCase().match(/[a-z0-9]+/g) ?? []) v[w.charCodeAt(0) % 64] += 1;
  return v;
};
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
    embeddings = { create: async ({ input }: { input: string[] }) => ({ data: input.map((t, i) => ({ index: i, embedding: vec(t) })) }) };
  },
}));

const { createApp } = await import("../src/app.js");
const app = createApp();
const NOT_FOUND = "I couldn't find that in your saved content.";

// A call that never answers but honours the abort signal, like the real SDK.
const hang = (_b: unknown, o: { signal: AbortSignal }) =>
  new Promise((_, reject) => o.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "APIUserAbortError" }))));
const reply = (text: string) => ({ choices: [{ message: { content: text } }] });
const stream = async function* (text: string) { yield { choices: [{ delta: { content: text } }] }; };

beforeEach(() => create.mockReset());

describe("not-found answers keep sources [] after a provider fallback", () => {
  it("POST /query: primary times out, fallback says not found", async () => {
    await request(app).post("/ingest").send({ type: "note", content: "Pottery class is on Sundays at five in the evening." });
    create.mockImplementationOnce(hang).mockResolvedValueOnce(reply(NOT_FOUND));
    const res = await request(app).post("/query").send({ question: "pottery class Sundays evening" });
    expect(create).toHaveBeenCalledTimes(2); // primary (timed out) + fallback
    expect(res.status).toBe(200);
    expect(res.body.answer).toBe(NOT_FOUND);
    expect(res.body.sources).toEqual([]);
  });

  it("POST /query/stream: no first token in time, fallback says not found", async () => {
    create.mockImplementationOnce(hang).mockResolvedValueOnce(stream(NOT_FOUND));
    const res = await request(app).post("/query/stream").send({ question: "pottery class Sundays evening" });
    const done = JSON.parse(/event: done\ndata: (.*)/.exec(res.text)![1]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(done.answer).toBe(NOT_FOUND);
    expect(done.sources).toEqual([]);
  });
});
