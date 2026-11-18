import { Router } from "express";
import { inboxSuggestions } from "../services/inboxSuggestions.js";

export const suggestionsRoutes = Router();

// "Try asking" for a new chat: questions made from the user's own inbox. Empty list when there is nothing to base them on.
suggestionsRoutes.get("/suggestions", async (_req, res) => void res.json({ suggestions: await inboxSuggestions() }));
