import { describe, expect, it } from "vitest";
import { customChat, embeddingProvider, GEMINI_URL, providerProblems } from "../src/lib/providers.js";
import { embeddingModelCheck } from "../src/services/embeddingGuard.js";

describe("providers", () => {
  it("default: GEMINI_API_KEY alone → Gemini embeddings, built-in chat", () => {
    const c = { GEMINI_API_KEY: "g" };
    expect(embeddingProvider(c)).toMatchObject({ baseURL: GEMINI_URL, apiKey: "g", model: "gemini-embedding-001", batch: 100 });
    expect(customChat(c)).toBeNull();
    expect(providerProblems(c)).toEqual([]);
  });

  it("one API for both jobs: AI_* is used for embeddings and chat, with a model for each", () => {
    const c = { AI_BASE_URL: "https://router.example/v1", AI_API_KEY: "k", EMBEDDING_MODEL: "embed-x", CHAT_MODEL: "chat-y" };
    expect(embeddingProvider(c)).toMatchObject({ baseURL: "https://router.example/v1", apiKey: "k", model: "embed-x" });
    expect(customChat(c)).toEqual({ baseURL: "https://router.example/v1", apiKey: "k", model: "chat-y" });
    expect(providerProblems(c)).toEqual([]);
  });

  it("two APIs: each job uses its own address, key and model", () => {
    const c = {
      EMBEDDING_BASE_URL: "https://a.example/v1", EMBEDDING_API_KEY: "ka", EMBEDDING_MODEL: "ea",
      CHAT_BASE_URL: "https://b.example/v1", CHAT_API_KEY: "kb", CHAT_MODEL: "cb",
    };
    expect(embeddingProvider(c)).toMatchObject({ baseURL: "https://a.example/v1", apiKey: "ka", model: "ea" });
    expect(customChat(c)).toEqual({ baseURL: "https://b.example/v1", apiKey: "kb", model: "cb" });
    expect(providerProblems(c)).toEqual([]);
  });

  it("Gemini embeddings with a separate chat API is allowed", () => {
    const c = { GEMINI_API_KEY: "g", CHAT_BASE_URL: "https://b.example/v1", CHAT_API_KEY: "kb", CHAT_MODEL: "cb" };
    expect(embeddingProvider(c).baseURL).toBe(GEMINI_URL);
    expect(customChat(c)?.model).toBe("cb");
    expect(providerProblems(c)).toEqual([]);
  });

  it("says what is missing", () => {
    expect(providerProblems({})[0]).toMatch(/No embedding key/);
    expect(providerProblems({ AI_BASE_URL: "https://r/v1", AI_API_KEY: "k" }).join(" ")).toMatch(/EMBEDDING_MODEL.*CHAT_MODEL|CHAT_MODEL/);
    expect(providerProblems({ GEMINI_API_KEY: "g", CHAT_BASE_URL: "https://b/v1", CHAT_MODEL: "m" }).join(" ")).toMatch(/No chat key/);
  });
});

describe("embeddingModelCheck", () => {
  it("records on an empty or older (default-model) database, accepts a match, refuses a different model", () => {
    expect(embeddingModelCheck(undefined, 0, "any-model")).toBe("record");
    expect(embeddingModelCheck(undefined, 50, "gemini-embedding-001")).toBe("record");
    expect(embeddingModelCheck("gemini-embedding-001", 50, "gemini-embedding-001")).toBe("ok");
    expect(embeddingModelCheck("gemini-embedding-001", 50, "text-embedding-3-small")).toBe("mismatch");
    expect(embeddingModelCheck(undefined, 50, "text-embedding-3-small")).toBe("mismatch");
  });
});
