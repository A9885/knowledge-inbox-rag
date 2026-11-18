import { config } from "./config.js";
import { createApp } from "./app.js";
import { vectorIndex } from "./rag/vectorIndex.js";
import { log } from "./lib/logger.js";
import { checkEmbeddingModel } from "./services/embeddingGuard.js";

checkEmbeddingModel(); // exits with a clear message if the stored vectors came from another model
vectorIndex.load();
createApp().listen(config.PORT, () => log.info({ port: config.PORT }, "server.started"));
