import { Router } from "express";
import { ingestSchema } from "../schemas/api.schemas.js";
import { ingest } from "../services/ingest.service.js";

export const ingestRoutes = Router().post("/ingest", async (req, res) => {
  const item = await ingest(ingestSchema.parse(req.body));
  res.status(201).json({ item });
});
