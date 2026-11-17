import { embed } from "../lib/llm.js";
import { AppError, isQuota, quotaError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { config } from "../config.js";
import { cacheKey, QueryEmbeddingCache } from "./queryCache.js";

export async function embedMany(texts: string[]): Promise<number[][]> {
  try {
    return await embed(texts);
  } catch (e) {
    if (isQuota(e)) throw quotaError("embedding", e);
    log.error({ err: (e as Error).message }, "embedding.failed");
    throw new AppError("EMBEDDING_FAILED", 502, "Embedding provider failed", e);
  }
}

const queryCache = new QueryEmbeddingCache(500, 60 * 60 * 1000, config.EMBED_CACHE_DIR);

/** Embeds questions, calling the provider only for the ones not seen in the last hour (all misses in one request). */
export async function embedQueries(texts: string[]): Promise<number[][]> {
  const keys = texts.map((t) => cacheKey(config.EMBEDDING_MODEL, t));
  const missing = [...new Set(texts.filter((_, i) => !queryCache.get(keys[i])))];
  if (missing.length) {
    const vecs = await embedMany(missing);
    missing.forEach((t, i) => queryCache.set(cacheKey(config.EMBEDDING_MODEL, t), vecs[i]));
  }
  return keys.map((k) => queryCache.get(k)!);
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embedQueries([text]))[0];
}
