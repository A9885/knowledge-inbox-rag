// Seeds test-data/records.json into a SEPARATE database for manual testing:
//   DB_PATH=./data/meridian.db npm run seed:meridian
// Every record (note, message, link page) is saved as a NOTE through the normal ingest service (chunking, flags, vector and keyword
// indexes all run). The example.com URLs are never fetched. Re-runnable: records already saved (title starts with "<id> ") are skipped.
// Refuses to run without DB_PATH, or with the live database. Stops cleanly on a Gemini quota error (429); run it again later to continue.
// Makes embedding calls (one batch per record). `--dry-run` prints the first note texts and calls nothing.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRecords, recordToNote } from "./meridianRecords.js";

const records = loadRecords(fileURLToPath(new URL("../test-data/records.json", import.meta.url)));
if (process.argv.includes("--dry-run")) {
  for (const r of records.slice(0, 3)) console.log(`${recordToNote(r)}\n`);
  console.log(`dry run: ${records.length} records, nothing saved`);
  process.exit(0);
}

const live = resolve(fileURLToPath(new URL("../data/inbox.db", import.meta.url)));
const db = process.env.DB_PATH;
if (!db || db === ":memory:" || resolve(db) === live) {
  console.error("Refusing to run: set DB_PATH to a separate database, e.g.\n  DB_PATH=./data/meridian.db npm run seed:meridian\n(never data/inbox.db, which holds your real inbox).");
  process.exit(1);
}

// Imported after the checks: these open the database.
const { ingest } = await import("../src/services/ingest.service.js");
const { listItems } = await import("../src/db/items.repository.js");

const have = new Set(listItems().map((i) => i.title.split(" ")[0])); // note titles start with "<id> ·"
let saved = 0, skipped = 0, failed = 0;
for (const [i, r] of records.entries()) {
  const tag = `[${String(i + 1).padStart(3)}/${records.length}]`;
  if (have.has(r.id)) {
    skipped++;
    console.log(`${tag} skip   ${r.id} (already saved)`);
    continue;
  }
  try {
    await ingest({ type: "note", content: recordToNote(r) });
    saved++;
    console.log(`${tag} saved  ${r.id}  ${r.title.slice(0, 50)}`);
  } catch (e) {
    const err = e as { code?: string; message: string };
    if (err.code === "PROVIDER_QUOTA") {
      console.error(`\n${tag} STOPPED on ${r.id}: ${err.message}`);
      console.error(`Saved ${saved} this run, ${skipped} already there, ${records.length - saved - skipped} still to do. Run the same command again when the quota is back; it continues where it stopped.`);
      process.exit(2);
    }
    failed++;
    console.error(`${tag} FAILED ${r.id}: ${err.code ?? ""} ${err.message}`);
  }
}
console.log(`\nDone: ${saved} saved, ${skipped} skipped, ${failed} failed, into ${db}`);
process.exit(failed ? 1 : 0);
