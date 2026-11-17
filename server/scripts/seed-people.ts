// Seeds the fake 20-person eval dataset into a SCRATCH database: DB_PATH=/path/to/scratch.db npm run seed:people
// Refuses to run without DB_PATH so it can never write into the live database by accident.
import { readFileSync } from "node:fs";

if (!process.env.DB_PATH || process.env.DB_PATH.endsWith("data/inbox.db")) {
  console.error("Set DB_PATH to a scratch database (not data/inbox.db).");
  process.exit(1);
}
const { ingest } = await import("../src/services/ingest.service.js"); // after the check: importing opens the DB
const notes: string[] = JSON.parse(readFileSync(new URL("../eval/datasets/people-notes.json", import.meta.url), "utf8"));
for (const content of notes) await ingest({ type: "note", content });
console.log(`seeded ${notes.length} notes into ${process.env.DB_PATH}`);
process.exit(0);
