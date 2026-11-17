// Re-chunks and re-embeds every saved item: `npm run reindex` (uses DB_PATH from .env; stop nothing, it is safe to re-run).
import { reindexAll } from "../src/services/reindex.service.js";

const { failed } = await reindexAll();
process.exit(failed ? 1 : 0);
