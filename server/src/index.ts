import { config } from "./config.js";
import { createApp } from "./app.js";
import { log } from "./lib/logger.js";

createApp().listen(config.PORT, () => log.info({ port: config.PORT }, "server.started"));
