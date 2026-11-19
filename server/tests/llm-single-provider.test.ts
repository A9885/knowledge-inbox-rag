import { beforeEach, describe, expect, it, vi } from "vitest";

// Gemini only (no NVIDIA key): there is nothing to fall back to, so a slow first token must be waited for, not cut at the short limit.
const create = vi.fn();
vi.mock("openai", () => ({ default: class { chat = { completions: { create } }; embeddings = { create: vi.fn() }; } }));
vi.mock("../src/config.js", () => ({ config: { GEMINI_API_KEY: "g", EMBEDDING_MODEL: "e", LOG_LEVEL: "silent", LLM_FIRST_TOKEN_TIMEOUT_MS: 50, LLM_REQUEST_TIMEOUT_MS: 500 } }));
const { chatStream } = await import("../src/lib/llm.js");

const collect = async (g: AsyncGenerator<string>) => { let o = ""; for await (const t of g) o += t; return o; };
const slowStream = (ms: number, text: string) => (_b: unknown, o: { signal: AbortSignal }) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve((async function* () { yield { choices: [{ delta: { content: text } }] }; })()), ms);
    o.signal.addEventListener("abort", () => { clearTimeout(t); reject(Object.assign(new Error("aborted"), { name: "APIUserAbortError" })); });
  });

beforeEach(() => create.mockReset());

describe("single provider", () => {
  it("a first token slower than the short limit still arrives", async () => {
    create.mockImplementationOnce(slowStream(150, "late but fine"));
    expect(await collect(chatStream("s", "u"))).toBe("late but fine");
  });

  it("but the full request timeout still applies", async () => {
    create.mockImplementationOnce(slowStream(2000, "never"));
    await expect(collect(chatStream("s", "u"))).rejects.toMatchObject({ name: "LlmTimeoutError" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
