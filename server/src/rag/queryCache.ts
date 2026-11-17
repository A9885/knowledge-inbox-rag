import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const cacheKey = (model: string, text: string): string => createHash("sha256").update(`${model}\n${text}`).digest("hex");

/**
 * Query-embedding cache: in-memory LRU with a TTL, plus an optional JSON file (no TTL) so evals and sweeps can
 * be re-run without calling the embedding API again.
 * ponytail: the file is rewritten on every new entry; fine for the few hundred questions an eval has.
 */
export class QueryEmbeddingCache {
  private mem = new Map<string, { vec: number[]; at: number }>(); // insertion order = least recently used first
  private disk: Record<string, number[]> | null = null;

  constructor(
    private max = 500,
    private ttlMs = 60 * 60 * 1000,
    private dir?: string,
    private now: () => number = Date.now,
  ) {}

  get(key: string): number[] | undefined {
    const hit = this.mem.get(key);
    if (hit && this.now() - hit.at <= this.ttlMs) {
      this.mem.delete(key);
      this.mem.set(key, hit); // mark as recently used
      return hit.vec;
    }
    this.mem.delete(key);
    const vec = this.load()[key];
    if (vec) this.remember(key, vec);
    return vec;
  }

  set(key: string, vec: number[]): void {
    this.remember(key, vec);
    if (!this.dir) return;
    this.load()[key] = vec;
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.file(), JSON.stringify(this.disk));
  }

  private remember(key: string, vec: number[]): void {
    this.mem.delete(key);
    this.mem.set(key, { vec, at: this.now() });
    if (this.mem.size > this.max) this.mem.delete(this.mem.keys().next().value!);
  }

  private file = () => join(this.dir!, "embeddings.json");

  private load(): Record<string, number[]> {
    if (!this.dir) return {};
    if (!this.disk) {
      try {
        this.disk = JSON.parse(readFileSync(this.file(), "utf8"));
      } catch {
        this.disk = {};
      }
    }
    return this.disk!;
  }
}
