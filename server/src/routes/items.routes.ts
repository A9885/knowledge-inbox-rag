import { Router } from "express";
import { listItems } from "../db/items.repository.js";
import { editSchema } from "../schemas/api.schemas.js";
import { editItem, getFullItem, removeItem } from "../services/items.service.js";

export const itemsRoutes = Router()
  .get("/items", (_req, res) => void res.json({ items: listItems() }))
  .get("/items/:id", (req, res) => void res.json({ item: getFullItem(req.params.id) }))
  .patch("/items/:id", async (req, res) => {
    res.json({ item: await editItem(req.params.id, editSchema.parse(req.body).content) });
  })
  .delete("/items/:id", (req, res) => {
    removeItem(req.params.id);
    res.status(204).end();
  });
