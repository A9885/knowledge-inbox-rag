import { config } from "./config.js";
import { createApp } from "./app.js";
import { vectorIndex } from "./rag/vectorIndex.js";
import { log } from "./lib/logger.js";

vectorIndex.load();
createApp().listen(config.PORT, () => log.info({ port: config.PORT }, "server.started"));
