// `npm run eval:compare -- eval/results/a.md eval/results/b.md` — side-by-side of two eval reports (reads the .json next to each .md).
import { readFileSync } from "node:fs";

const [a, b] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p.replace(/\.md$/, ".json"), "utf8")));
if (!a || !b) throw new Error("usage: npm run eval:compare -- a.md b.md");
const cols = ["recall3", "recall5", "mrr", "hit1", "kw", "cite", "nf"] as const;
const row = (label: string, x: Record<string, string>, y: Record<string, string>) =>
  `${label.padEnd(16)}` + cols.map((c) => `${x[c]} -> ${y[c]}`.padEnd(15)).join("");
console.log(`${a.config} -> ${b.config}`);
console.log("".padEnd(16) + cols.map((c) => c.padEnd(15)).join(""));
console.log(row("overall", a.overall, b.overall));
for (const c of Object.keys(a.byCat)) if (b.byCat[c]) console.log(row(c, a.byCat[c], b.byCat[c]));
for (const k of ["embedMs", "searchMs", "firstMs", "totalMs"]) console.log(`${k.padEnd(16)}p50 ${a.speed[k].p50} -> ${b.speed[k].p50}   p95 ${a.speed[k].p95} -> ${b.speed[k].p95}`);
