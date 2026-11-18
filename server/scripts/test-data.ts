// Injects test-data/records.json into a THROWAWAY database, asks test-data/questions.json, prints the responses: `npm run test:data`
// Your real data (server/data/inbox.db) is never touched. Needs GEMINI_API_KEY in .env; it makes real model calls.
// Flags: --keep (keep the scratch DB at test-data/.scratch/test.db), --verbose (print full answers)
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../test-data/", import.meta.url));
const scratch = `${dir}.scratch`;
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
process.env.DB_PATH = `${scratch}/test.db`; // set BEFORE the app is imported: config reads it once
process.env.LOG_LEVEL = "silent";

const { createApp } = await import("../src/app.js");
const { vectorIndex } = await import("../src/rag/vectorIndex.js");
vectorIndex.load();
const server = createApp().listen(0);
const API = `http://localhost:${(server.address() as { port: number }).port}`;
const verbose = process.argv.includes("--verbose");

type Q = { question: string; expectKeywords?: string[]; expectSource?: string; expectNotFound?: boolean };
const read = <T>(f: string): T => JSON.parse(readFileSync(`${dir}${f}`, "utf8"));
const { notes = [], urls = [] } = read<{ notes?: string[]; urls?: string[] }>("records.json");
const questions = read<Q[]>("questions.json");

const post = async (path: string, body: unknown) => {
  const res = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: await res.json() };
};

console.log(`Injecting ${notes.length} notes and ${urls.length} URLs into a scratch database...\n`);
for (const [type, items] of [["note", notes], ["url", urls]] as const)
  for (const content of items) {
    const r = await post("/ingest", { type, content });
    console.log(r.ok ? `  saved  ${type.padEnd(4)}  ${r.body.item.title.slice(0, 70)}` : `  FAILED ${type.padEnd(4)}  ${content.slice(0, 50)}  <- ${r.body.error.code}: ${r.body.error.message}`);
  }

console.log("\nAsking questions...\n");
let passed = 0;
for (const [i, q] of questions.entries()) {
  const t0 = performance.now();
  const r = await post("/query", { question: q.question });
  const ms = Math.round(performance.now() - t0);
  const answer: string = r.body.answer ?? "";
  const sources: { title: string }[] = r.body.sources ?? [];
  const fails: string[] = r.ok ? [] : [`HTTP ${r.status} ${r.body.error?.code ?? ""}`];
  if (r.ok) {
    if (q.expectNotFound) {
      if (!answer.toLowerCase().includes("couldn't find")) fails.push("expected not-found answer");
      if (sources.length) fails.push("sources shown for not-found");
    }
    for (const k of q.expectKeywords ?? []) if (!answer.toLowerCase().includes(k.toLowerCase())) fails.push(`missing "${k}"`);
    if (q.expectSource && !sources.some((s) => s.title.toLowerCase().includes(q.expectSource!.toLowerCase()))) fails.push(`source "${q.expectSource}" not cited`);
  }
  if (!fails.length) passed++;
  console.log(`${String(i + 1).padStart(2)}. ${fails.length ? "FAIL" : "PASS"}  ${ms} ms  ${q.question}`);
  console.log(`      answer:  ${verbose ? answer : `${answer.replace(/\s+/g, " ").slice(0, 150)}${answer.length > 150 ? "..." : ""}`}`);
  console.log(`      sources: ${sources.map((s) => s.title.slice(0, 40)).join(" | ") || "none"}`);
  if (fails.length) console.log(`      why:     ${fails.join("; ")}`);
}

console.log(`\nScore: ${passed}/${questions.length}`);
server.close();
if (!process.argv.includes("--keep")) rmSync(scratch, { recursive: true, force: true });
process.exit(passed === questions.length ? 0 : 1);
