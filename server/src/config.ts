import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  GEMINI_API_KEY: z
    .string("GEMINI_API_KEY is required (copy .env.example to .env)")
    .min(1, "GEMINI_API_KEY is required (copy .env.example to .env)"),
  PORT: z.coerce.number().int().default(4000),
  DB_PATH: z.string().default("./data/inbox.db"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  NVIDIA_API_KEY: z.string().optional(), // if set, chat goes to NVIDIA NIM instead of Gemini
  CHAT_MODEL: z.string().optional(),
  DEBUG: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const i of parsed.error.issues) console.error(`  - ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}

export const config = parsed.data;
