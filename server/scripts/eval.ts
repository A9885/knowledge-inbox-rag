// Runs eval/questions.json against the live API: `npm run eval`
// Env: API_URL (default http://localhost:4000), EVAL_INGEST_URL (optional: also time saving this URL; it WILL be saved).
import { readFileSync } from "node:fs";

const API = process.env.API_URL ?? "http://localhost:4000";
const NOT_FOUND = "couldn't find";

type Q = { question: string; expectKeywords?: string[]; expectSource?: string; expectNotFound?: boolean; conversation?: string };
type Source = { title: string };

const json = (method: string, path: string, body?: unknown) =>
  fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });

/** Streams one answer; returns ms to the first token event, ms to done, and the final payload. */
async function ask(question: string, conversationId?: string) {
  const t0 = performance.now();
  const res = await json("POST", "/query/stream", { question, conversationId });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  let buf = "";
  let firstMs = 0;
  let done: { answer: string; sources: Source[] } | undefined;
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

function check(q: Q, answer: string, sources: Source[]): string[] {
  const fails: string[] = [];
  const low = answer.toLowerCase();
  if (q.expectNotFound) {
    if (!low.includes(NOT_FOUND)) fails.push("expected not-found answer");
    if (sources.length) fails.push("sources shown for not-found");
  }
  for (const k of q.expectKeywords ?? []) if (!low.includes(k.toLowerCase())) fails.push(`missing "${k}"`);
  if (q.expectSource && !sources.some((s) => s.title.toLowerCase().includes(q.expectSource!.toLowerCase())))
    fails.push(`source "${q.expectSource}" not cited`);
  return fails;
}

const questions: Q[] = JSON.parse(readFileSync(new URL("../eval/questions.json", import.meta.url), "utf8"));
const chats = new Map<string, string>(); // conversation key → id (created here, deleted at the end)
const rows: { n: number; ok: boolean; first: number; total: number; q: string; why: string }[] = [];

try {
  if (process.env.EVAL_INGEST_URL) {
    const t0 = performance.now();
    const res = await json("POST", "/ingest", { type: "url", content: process.env.EVAL_INGEST_URL });
    console.log(`save URL: ${res.status} in ${Math.round(performance.now() - t0)} ms (${process.env.EVAL_INGEST_URL})`);
  }
  for (const [i, q] of questions.entries()) {
    let id: string | undefined;
    if (q.conversation) {
      if (!chats.has(q.conversation)) chats.set(q.conversation, (await (await json("POST", "/conversations")).json()).conversation.id);
      id = chats.get(q.conversation);
    }
    try {
      const r = await ask(q.question, id);
      const fails = check(q, r.answer, r.sources);
      rows.push({ n: i + 1, ok: !fails.length, first: r.firstMs, total: r.totalMs, q: q.question, why: fails.join("; ") });
    } catch (e) {
      rows.push({ n: i + 1, ok: false, first: 0, total: 0, q: q.question, why: (e as Error).message });
    }
  }
} finally {
  for (const id of chats.values()) await json("DELETE", `/conversations/${id}`);
}

console.log("\n #  result  first(ms)  total(ms)  question");
for (const r of rows)
  console.log(`${String(r.n).padStart(2)}  ${r.ok ? "PASS" : "FAIL"}    ${String(Math.round(r.first)).padStart(8)}  ${String(Math.round(r.total)).padStart(9)}  ${r.q}${r.why ? `  <- ${r.why}` : ""}`);
const passed = rows.filter((r) => r.ok).length;
const withTokens = rows.filter((r) => r.first > 0);
const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / (xs.length || 1));
console.log(`\nScore: ${passed}/${rows.length}  avg first word: ${avg(withTokens.map((r) => r.first))} ms  avg total: ${avg(rows.map((r) => r.total))} ms`);
process.exit(passed === rows.length ? 0 : 1);
