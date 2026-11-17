import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { env: { GEMINI_API_KEY: "test", DB_PATH: ":memory:", LOG_LEVEL: "silent" } },
});
