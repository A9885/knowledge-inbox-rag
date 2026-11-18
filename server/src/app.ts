import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { pinoHttp } from "pino-http";
import { log } from "./lib/logger.js";
import { errorHandler, notFound } from "./lib/errors.js";
import { conversationRoutes } from "./routes/conversations.routes.js";
import { ingestRoutes } from "./routes/ingest.routes.js";
import { itemsRoutes } from "./routes/items.routes.js";
import { queryRoutes } from "./routes/query.routes.js";
import { suggestionsRoutes } from "./routes/suggestions.routes.js";

export function createApp() {
  const app = express();
  app.use(
    pinoHttp({
      logger: log,
      genReqId: (req, res) => {
        const id = String(req.headers["x-request-id"] ?? randomUUID());
        res.setHeader("x-request-id", id);
        return id;
      },
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => void res.json({ status: "ok" }));
  app.use(ingestRoutes, itemsRoutes, queryRoutes, conversationRoutes, suggestionsRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
