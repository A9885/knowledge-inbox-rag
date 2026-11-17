import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({ default: class { chat = { completions: { create } }; embeddings = { create: vi.fn() }; } }));
vi.mock("../src/config.js", () => ({ config: { GEMINI_API_KEY: "g", NVIDIA_API_KEY: "n", EMBEDDING_MODEL: "e", LOG_LEVEL: "silent", LLM_FIRST_TOKEN_TIMEOUT_MS: 50, LLM_REQUEST_TIMEOUT_MS: 50 } }));
const { chat, chatStream } = await import("../src/lib/llm.js");

const gone = Object.assign(new Error("gone"), { status: 410 });
const stream = async function* (...t: string[]) { for (const x of t) yield { choices: [{ delta: { content: x } }] }; };
const collect = async (g: AsyncGenerator<string>) => { let o = ""; for await (const t of g) o += t; return o; };

beforeEach(() => create.mockReset());

describe("model fallback", () => {
  it("NVIDIA 410 → the answer comes from Gemini", async () => {
    create.mockRejectedValueOnce(gone).mockResolvedValueOnce({ choices: [{ message: { content: " from gemini " } }] });
    expect(await chat("s", "u")).toBe("from gemini");
    expect(create.mock.calls[0][0].model).toBe("poolside/laguna-xs-2.1");
    expect(create.mock.calls[1][0].model).toBe("gemini-3.1-flash-lite");
  });

  it("other errors (400) are not retried", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 400 }));
    await expect(chat("s", "u")).rejects.toThrow("boom");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("stream: failure before the first token switches silently", async () => {
    create.mockRejectedValueOnce(gone).mockResolvedValueOnce(stream("hi ", "there"));
    expect(await collect(chatStream("s", "u"))).toBe("hi there");
  });

  it("stream: failure after the first token is raised, not retried", async () => {
    create.mockResolvedValueOnce((async function* () { yield { choices: [{ delta: { content: "hi" } }] }; throw gone; })());
    await expect(collect(chatStream("s", "u"))).rejects.toThrow("gone");
    expect(create).toHaveBeenCalledTimes(1);
  });

  // A call that never answers, but honours the abort signal like the real SDK.
  const hang = (_body: unknown, opts: { signal: AbortSignal }) =>
    new Promise((_, reject) => opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "APIUserAbortError" }))));
  const unavailable = Object.assign(new Error("overloaded"), { status: 503 });

  it("chat: a hanging provider times out and the other one answers", async () => {
    create.mockImplementationOnce(hang).mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });
    expect(await chat("s", "u")).toBe("ok");
    expect(create.mock.calls[1][0].model).toBe("gemini-3.1-flash-lite");
  });

  it("stream: no first token in time → silently switches", async () => {
    create.mockImplementationOnce(hang).mockResolvedValueOnce(stream("fast ", "answer"));
    expect(await collect(chatStream("s", "u"))).toBe("fast answer");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("stream: 503 before the first token → switches", async () => {
    create.mockRejectedValueOnce(unavailable).mockResolvedValueOnce(stream("ok"));
    expect(await collect(chatStream("s", "u"))).toBe("ok");
  });

  it("stream: connection error before the first token → switches", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("Connection error."), { name: "APIConnectionError" })).mockResolvedValueOnce(stream("ok"));
    expect(await collect(chatStream("s", "u"))).toBe("ok");
  });

  it("stream: a 503 after the first token is raised and not retried", async () => {
    create.mockResolvedValueOnce((async function* () { yield { choices: [{ delta: { content: "hi" } }] }; throw unavailable; })());
    await expect(collect(chatStream("s", "u"))).rejects.toThrow("overloaded");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("both providers failing: one fallback attempt, then the error", async () => {
    create.mockRejectedValueOnce(unavailable).mockRejectedValueOnce(unavailable).mockRejectedValueOnce(unavailable).mockRejectedValueOnce(unavailable);
    await expect(chat("s", "u")).rejects.toThrow("overloaded");
    expect(create).toHaveBeenCalledTimes(2);
    create.mockClear();
    await expect(collect(chatStream("s", "u"))).rejects.toThrow("overloaded");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("429 (quota) is not a reason to switch", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("quota"), { status: 429 }));
    await expect(chat("s", "u")).rejects.toThrow("quota");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
