import "dotenv/config";
import { z } from "zod";
import { DEFAULT_EMBEDDING_MODEL, providerProblems } from "./lib/providers.js";

const schema = z.object({
  GEMINI_API_KEY: z.string().optional(), // the default setup; not needed when AI_* or EMBEDDING_* / CHAT_* are set (see lib/providers.ts)
  AI_BASE_URL: z.string().optional(), // one OpenAI-compatible API for embeddings and chat
  AI_API_KEY: z.string().optional(),
  EMBEDDING_BASE_URL: z.string().optional(), // or a separate API for embeddings...
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_BATCH: z.coerce.number().int().positive().optional(), // inputs per embedding request (default 100)
  CHAT_BASE_URL: z.string().optional(), // ...and another for chat
  CHAT_API_KEY: z.string().optional(),
  PORT: z.coerce.number().int().default(4000),
  DB_PATH: z.string().default("./data/inbox.db"),
  EMBEDDING_MODEL: z.string().optional(), // default gemini-embedding-001; required for any other embedding API
  NVIDIA_API_KEY: z.string().optional(), // if set, chat goes to NVIDIA NIM instead of Gemini
  CHAT_MODEL: z.string().optional(),
  LLM_FIRST_TOKEN_TIMEOUT_MS: z.coerce.number().int().positive().default(8000), // no first token by then → try the other provider
  LLM_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000), // whole non-streamed call
  EMBED_CACHE_DIR: z.string().optional(), // if set, query embeddings are also cached in a JSON file there (used by the evals)
  RELEVANCE_WINDOW: z.coerce.number().default(0.12), // keep chunks within this of the best score...
  RELEVANCE_HIGH_SCORE: z.coerce.number().default(0.6), // ...or at least this similar, whatever the best is
  RETRIEVAL_MODE: z.enum(["vector", "hybrid"]).default("hybrid"), // hybrid = vector + keyword (FTS5), fused; vector = cosine only
  HYBRID_FUSION: z.enum(["rrf", "weighted"]).default("weighted"),
  DEBUG: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const i of parsed.error.issues) console.error(`  - ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}

const problems = providerProblems(parsed.data);
if (problems.length) {
  console.error("Invalid environment configuration:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

export const config = { ...parsed.data, EMBEDDING_MODEL: parsed.data.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL };
