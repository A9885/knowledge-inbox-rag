import { Router } from "express";
import { listItems } from "../db/items.repository.js";

export const itemsRoutes = Router().get("/items", (_req, res) => {
  res.json({ items: listItems() });
});
