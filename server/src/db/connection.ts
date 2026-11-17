import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "./migrate.js";
import { config } from "../config.js";

if (config.DB_PATH !== ":memory:") mkdirSync(dirname(config.DB_PATH), { recursive: true });

export const db = new Database(config.DB_PATH);
db.pragma("foreign_keys = ON");
// Same relative path works from src/db and dist/db.
const schema = readFileSync(new URL("../../src/db/schema.sql", import.meta.url), "utf8");
db.exec(schema);

migrate(db, schema);

/** Changes when another process (e.g. `npm run reindex`) modifies the database file; never for this connection's own writes. */
export const dataVersion = (): number => db.pragma("data_version", { simple: true }) as number;

export const inTransaction = <T>(fn: () => T): T => db.transaction(fn)();
