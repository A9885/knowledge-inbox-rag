import { config } from "../config.js";
import { chunkCount, getMeta, setMeta } from "../db/meta.repository.js";
import { DEFAULT_EMBEDDING_MODEL } from "../lib/providers.js";

/**
 * Vectors from different embedding models cannot be compared: searching one model's vectors with another's
 * gives wrong results and no error. So the model is recorded in the database and a mismatch stops the server.
 *  record   : nothing stored yet and it is safe to assume this model (empty database, or an older one made with the default)
 *  mismatch : stored (or assumed) model differs from EMBEDDING_MODEL
 */
export function embeddingModelCheck(stored: string | undefined, chunks: number, configured: string): "ok" | "record" | "mismatch" {
  if (stored) return stored === configured ? "ok" : "mismatch";
  if (chunks === 0 || configured === DEFAULT_EMBEDDING_MODEL) return "record"; // databases from before this check were all made with the default
  return "mismatch";
}

export function checkEmbeddingModel(): void {
  const stored = getMeta("embedding_model");
  const verdict = embeddingModelCheck(stored, chunkCount(), config.EMBEDDING_MODEL);
  if (verdict === "record") setMeta("embedding_model", config.EMBEDDING_MODEL);
  if (verdict === "mismatch") {
    console.error(
      `This inbox was indexed with ${stored ? `"${stored}"` : `"${DEFAULT_EMBEDDING_MODEL}" (assumed)`}, but EMBEDDING_MODEL is "${config.EMBEDDING_MODEL}".\n` +
        `Searching with a different model would return wrong results. Either set EMBEDDING_MODEL back,\n` +
        `or run "npm run reindex" in server/ to re-embed everything with the new model (one embedding request per batch of chunks).`,
    );
    process.exit(1);
  }
}
