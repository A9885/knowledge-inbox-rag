import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({ default: class { chat = { completions: { create } }; embeddings = { create: vi.fn() }; } }));
vi.mock("../src/config.js", () => ({ config: { GEMINI_API_KEY: "g", NVIDIA_API_KEY: "n", EMBEDDING_MODEL: "e", LOG_LEVEL: "silent" } }));
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
    expect(create.mock.calls[1][0].model).toBe("gemini-3.8-flash");
  });

  it("other errors are not retried", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
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
});
