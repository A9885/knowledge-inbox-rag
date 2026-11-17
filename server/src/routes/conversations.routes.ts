import { Router } from "express";
import { listConversations } from "../db/conversations.repository.js";
import { createChat, getMessages, removeChat } from "../services/conversation.service.js";

export const conversationRoutes = Router();

conversationRoutes.get("/conversations", (_req, res) => void res.json({ conversations: listConversations() }));
conversationRoutes.post("/conversations", (_req, res) => void res.status(201).json({ conversation: createChat() }));
conversationRoutes.get("/conversations/:id", (req, res) => void res.json({ messages: getMessages(req.params.id) }));
conversationRoutes.delete("/conversations/:id", (req, res) => {
  removeChat(req.params.id);
  res.status(204).end();
});
