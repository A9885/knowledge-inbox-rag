# Test data: Meridian

`records.json` is a fictional company ("Meridian Workspace"): one JSON object per line, 157 records
(135 notes, 12 chat messages, 10 link pages). It includes dated facts that change, "don't quote X" traps
and one prompt-injection test (`MSG009`).

## Load it into a separate database

Never into your real inbox. The seed script refuses `data/inbox.db`.

```bash
cd server
DB_PATH=./data/meridian.db npm run seed:meridian
```

- Each record is saved as a **note** through the normal ingest path. The first line is
  `<id> · <title> — <author>, <department>, <date>`, plus `· channel #x` for messages and `· <url>` for link pages.
- The example.com links are **not** fetched.
- It prints progress, skips records already saved, and stops with a clear message if Gemini returns a quota error (429).
  Run the same command again later to continue.
- It makes one embedding request per record (about 157), so check your Gemini quota first.
- `npm run seed:meridian -- --dry-run` prints the first note texts and calls nothing.

## Run the app on that database

```bash
cd server
DB_PATH=./data/meridian.db DEBUG=true npm run dev
```

In another terminal: `cd client && npm run dev`, then open http://localhost:5173.
`DEBUG=true` adds a "Show details" panel under each answer (rewritten question, every candidate with its score, timings).
Stop the server and restart without `DB_PATH` to go back to your real inbox.
