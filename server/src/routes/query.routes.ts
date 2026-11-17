import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { querySchema } from "../schemas/api.schemas.js";
import { loadHistory, saveTurn } from "../services/conversation.service.js";
import { answerQuestion, streamAnswer } from "../services/query.service.js";

export const queryRoutes = Router();

// With a conversationId the chat's earlier turns are used as memory and this turn is saved to it.
queryRoutes.post("/query", async (req, res) => {
  const { question, topK, conversationId } = querySchema.parse(req.body);
  const history = conversationId ? loadHistory(conversationId) : [];
  const result = await answerQuestion(question, topK, history);
  if (conversationId) saveTurn(conversationId, question, result);
  res.json(result);
});

// Server-sent events: `token` (answer text), then `done` (final answer + sources + suggestions) or `error`.
// ponytail: no abort on client disconnect, the LLM call runs to completion.
queryRoutes.post("/query/stream", async (req, res) => {
  const { question, topK, conversationId } = querySchema.parse(req.body); // bad input still gets a normal 400 JSON error
  const history = conversationId ? loadHistory(conversationId) : []; // unknown chat id → normal 404 JSON error
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    const result = await streamAnswer(question, topK, (t) => send("token", { t }), history);
    if (conversationId) saveTurn(conversationId, question, result);
    send("done", result);
  } catch (e) {
    const err = e instanceof AppError ? e : new AppError("INTERNAL_ERROR", 500, "Something went wrong", e);
    if (!(e instanceof AppError)) log.error({ err: e }, "unhandled_error");
    send("error", { code: err.code, message: err.message, requestId: String(req.id) });
  }
  res.end();
});
