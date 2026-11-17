import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/llm.js", async () => (await import("./fakeLlm.js")).fakeLlm);
const { createApp } = await import("../src/app.js");
const app = createApp();

describe("pin to inbox", () => {
  it("saves a user message as a chat item; a second pin → 409; AI answers can't be pinned", async () => {
    const { id } = (await request(app).post("/conversations")).body.conversation;
    await request(app).post("/query").send({ question: "my locker code is seventeen", conversationId: id });
    const msgs = (await request(app).get(`/conversations/${id}`)).body.messages;
    const user = msgs.find((m: { role: string }) => m.role === "user");
    const assistant = msgs.find((m: { role: string }) => m.role === "assistant");
    const pin = (m: { id: string; content: string }) =>
      request(app).post("/ingest").send({ type: "chat", content: m.content, conversationId: id, messageId: m.id });

    const first = await pin(user);
    expect(first.status).toBe(201);
    expect(first.body.item).toMatchObject({ type: "chat", status: "ready" });

    const again = await pin(user);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_SAVED");

    expect((await pin(assistant)).status).toBe(404);
    expect((await request(app).get("/items")).body.items.filter((i: { type: string }) => i.type === "chat")).toHaveLength(1);
  });
});
