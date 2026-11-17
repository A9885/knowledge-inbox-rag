// Evaluation engine: `npm run eval:full -- --config configs/vector.json`
// Add --retrieval-only for retrieval metrics only (no LLM answers, no server). Start any answer-server with the same EMBED_CACHE_DIR to share the cache.
// Needs a SCRATCH database seeded with `DB_PATH=... npm run seed:people`, and a server running on that same DB:
//   DB_PATH=/tmp/people.db DEBUG=true PORT=4001 npm run dev    then    DB_PATH=/tmp/people.db API_URL=http://localhost:4001 npm run eval:full -- --config configs/vector.json
// Retrieval metrics run in-process (no LLM); answer metrics go through the API. Report: eval/results/<date>-<config>.md (+ .json).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hitAt1, mean, percentile, recallAt, reciprocalRank, titleMatches } from "./evalMetrics.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const EVAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../eval");

type Q = { id: string; question: string; category: string; expectItemIds: string[]; expectKeywords: string[]; expectNotFound?: boolean; conversation?: string };
type Cfg = { name: string; dataset: string; retrieval: { mode: "vector" | "hybrid"; fusion?: "rrf" | "weighted"; topK: number }; answers: boolean };
type Row = {
  q: Q; ranked: string[]; kept: string[]; recall3?: number; recall5?: number; rr?: number; hit1?: number;
  answer?: string; cited?: string[]; kw?: number; cite?: number; nf?: number; embedMs?: number; searchMs?: number; firstMs?: number; totalMs?: number; error?: string;
};

const arg = (n: string) => process.argv[process.argv.indexOf(n) + 1];
const cfgPath = [arg("--config"), resolve(EVAL_DIR, arg("--config") ?? "")].find((p) => p && existsSync(p));
if (!process.argv.includes("--config") || !cfgPath) throw new Error("usage: npm run eval:full -- --config configs/<name>.json");
if (!process.env.DB_PATH || process.env.DB_PATH.endsWith("data/inbox.db")) throw new Error("Set DB_PATH to the scratch people database (not data/inbox.db).");
const cfg: Cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
// In-process retrieval follows the config. The API server answers with ITS OWN env: start it with the same
// RETRIEVAL_MODE / HYBRID_FUSION, or the answer metrics describe a different retriever.
process.env.RETRIEVAL_MODE = cfg.retrieval.mode;
process.env.HYBRID_FUSION = cfg.retrieval.fusion ?? "rrf";
// Question embeddings are cached on disk, so re-runs and config sweeps cost no embedding calls.
process.env.EMBED_CACHE_DIR ??= resolve(EVAL_DIR, ".cache");
if (process.argv.includes("--retrieval-only")) cfg.answers = false; // Recall/MRR/Hit@1 only: no LLM, no server needed
const questions: Q[] = JSON.parse(readFileSync(resolve(EVAL_DIR, `datasets/${cfg.dataset}.json`), "utf8"));

// Imported after the DB_PATH check: these open the database.
const { retrieve } = await import("../src/rag/retrieve.js");

const json = (method: string, path: string, body?: unknown) =>
  fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });

async function ask(question: string, conversationId?: string) {
  const t0 = performance.now();
  const res = await json("POST", "/query/stream", { question, conversationId, topK: cfg.retrieval.topK });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  let buf = "", firstMs = 0;
  let done: { answer: string; sources: { title: string; cited: boolean }[]; debug?: { rewrittenQuestion: string } } | undefined;
  for await (const chunk of res.body.pipeThrough(new TextDecoderStream())) {
    buf += chunk;
    for (let end; (end = buf.indexOf("\n\n")) >= 0; ) {
      const block = buf.slice(0, end);
      buf = buf.slice(end + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? "null");
      if (event === "token") firstMs ||= performance.now() - t0;
      else if (event === "done") done = data;
      else if (event === "error") throw new Error(`${data.code}: ${data.message}`);
    }
  }
  if (!done) throw new Error("stream ended early");
  return { firstMs, totalMs: performance.now() - t0, ...done };
}

const chats = new Map<string, string>();
const rows: Row[] = [];
try {
  for (const q of questions) {
    const row: Row = { q, ranked: [], kept: [] };
    rows.push(row);
    let searchText: string | undefined = q.conversation ? undefined : q.question;
    if (cfg.answers) {
      try {
        let id: string | undefined;
        if (q.conversation) {
          if (!chats.has(q.conversation)) chats.set(q.conversation, (await (await json("POST", "/conversations")).json()).conversation.id);
          id = chats.get(q.conversation);
        }
        const r = await ask(q.question, id);
        const low = r.answer.toLowerCase();
        row.answer = r.answer;
        row.firstMs = r.firstMs;
        row.totalMs = r.totalMs;
        row.cited = r.sources.map((s) => s.title);
        row.kw = q.expectKeywords.length ? (q.expectKeywords.every((k) => low.includes(k.toLowerCase())) ? 1 : 0) : undefined;
        row.cite = q.expectItemIds.length ? q.expectItemIds.filter((e) => row.cited!.some((t) => titleMatches(t, e))).length / q.expectItemIds.length : undefined;
        row.nf = q.expectNotFound ? (low.includes("couldn't find") && !r.sources.length ? 1 : 0) : undefined;
        if (q.conversation) searchText = r.debug?.rewrittenQuestion; // needs DEBUG=true on the server
      } catch (e) {
        row.error = (e as Error).message;
      }
    }
    if (searchText && !q.expectNotFound) {
      const { hits, candidates, embedMs, searchMs } = await retrieve(searchText, cfg.retrieval.topK);
      row.embedMs = embedMs;
      row.searchMs = searchMs;
      row.ranked = candidates.map((c) => c.title);
      row.kept = hits.map((h) => h.title);
      row.recall3 = recallAt(row.ranked, q.expectItemIds, 3);
      row.recall5 = recallAt(row.ranked, q.expectItemIds, 5);
      row.rr = reciprocalRank(row.ranked, q.expectItemIds);
      row.hit1 = hitAt1(row.ranked, q.expectItemIds);
    }
  }
} finally {
  for (const id of chats.values()) await json("DELETE", `/conversations/${id}`);
}

// ---- report ----
const nums = (rs: Row[], f: (r: Row) => number | undefined) => rs.map(f).filter((x): x is number => x !== undefined);
const pct = (xs: number[]) => (xs.length ? `${(mean(xs) * 100).toFixed(0)}%` : "-");
const ms = (xs: number[], p: number) => (xs.length ? `${Math.round(percentile(xs, p))}` : "-");
const m3 = (xs: number[]) => (xs.length ? mean(xs).toFixed(2) : "-");
const stats = (rs: Row[]) => ({
  n: rs.length,
  recall3: pct(nums(rs, (r) => r.recall3)), recall5: pct(nums(rs, (r) => r.recall5)), mrr: m3(nums(rs, (r) => r.rr)), hit1: pct(nums(rs, (r) => r.hit1)),
  kw: pct(nums(rs, (r) => r.kw)), cite: pct(nums(rs, (r) => r.cite)), nf: pct(nums(rs, (r) => r.nf)),
});
const cats = [...new Set(questions.map((q) => q.category))];
const overall = stats(rows);
const byCat = Object.fromEntries(cats.map((c) => [c, stats(rows.filter((r) => r.q.category === c))]));
const speed = Object.fromEntries(
  (["embedMs", "searchMs", "firstMs", "totalMs"] as const).map((k) => [k, { p50: ms(nums(rows, (r) => r[k]), 50), p95: ms(nums(rows, (r) => r[k]), 95) }]),
);

const date = new Date().toLocaleDateString("sv-SE"); // local YYYY-MM-DD
const line = (label: string, s: typeof overall) => `| ${label} | ${s.n} | ${s.recall3} | ${s.recall5} | ${s.mrr} | ${s.hit1} | ${s.kw} | ${s.cite} | ${s.nf} |`;
const failed = rows.filter((r) => r.error || r.kw === 0 || r.nf === 0 || (r.cite !== undefined && r.cite < 1) || (r.recall5 !== undefined && r.recall5 < 1));
const md = [
  `# Eval ${cfg.name} (${date})`,
  `Dataset \`${cfg.dataset}\` (${questions.length} questions), retrieval \`${cfg.retrieval.mode}${cfg.retrieval.mode === "hybrid" ? `/${cfg.retrieval.fusion ?? "rrf"}` : ""}\` topK ${cfg.retrieval.topK}, answers ${cfg.answers ? "on" : "off"}.`,
  `\nRecall/MRR/Hit@1 use the raw ranked list (before the relevance filter). Keyword acc = all expected keywords in the answer. Citation acc = share of expected items cited. Not-found ok = said "couldn't find" with no sources.\n`,
  "| Category | n | Recall@3 | Recall@5 | MRR | Hit@1 | Keyword acc | Citation acc | Not-found ok |",
  "|---|---|---|---|---|---|---|---|---|",
  line("**Overall**", overall),
  ...cats.map((c) => line(c, byCat[c])),
  "\n## Speed (ms)\n",
  "| Step | p50 | p95 |", "|---|---|---|",
  ...(["embedMs", "searchMs", "firstMs", "totalMs"] as const).map((k) => `| ${{ embedMs: "embed", searchMs: "search", firstMs: "first token", totalMs: "total answer" }[k]} | ${speed[k].p50} | ${speed[k].p95} |`),
  `\n## Problem questions (${failed.length})\n`,
  ...failed.map((r) =>
    [`- **${r.q.id}** (${r.q.category}) ${r.q.question}`,
      `  - expected: ${r.q.expectItemIds.join(", ") || "(not found)"}; keywords: ${r.q.expectKeywords.join(", ") || "-"}`,
      `  - retrieved top 5: ${r.ranked.slice(0, 5).map((t) => t.slice(0, 28)).join(" | ") || "-"}`,
      `  - answer: ${r.error ?? (r.answer ?? "-").replace(/\s+/g, " ").slice(0, 200)}`].join("\n")),
].join("\n");

mkdirSync(resolve(EVAL_DIR, "results"), { recursive: true });
const base = resolve(EVAL_DIR, `results/${date}-${cfg.name}`);
writeFileSync(`${base}.md`, md + "\n");
writeFileSync(`${base}.json`, JSON.stringify({ config: cfg.name, date, overall, byCat, speed }, null, 1));
console.log(md);
console.log(`\nwritten: ${base}.md`);
process.exit(0);
