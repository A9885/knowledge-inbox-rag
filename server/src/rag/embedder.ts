import { embed } from "../lib/llm.js";
import { AppError } from "../lib/errors.js";
import { log } from "../lib/logger.js";

export async function embedMany(texts: string[]): Promise<number[][]> {
  try {
    return await embed(texts);
  } catch (e) {
    log.error({ err: (e as Error).message }, "embedding.failed");
    throw new AppError("EMBEDDING_FAILED", 502, "Embedding provider failed", e);
  }
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embedMany([text]))[0];
}
