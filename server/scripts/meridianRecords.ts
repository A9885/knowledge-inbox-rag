// Reads test-data/records.json (one JSON object per line) and turns each record into note text. Pure: no I/O besides the file read.
import { readFileSync } from "node:fs";

export type MeridianRecord = {
  id: string;
  type: "note" | "message" | "url";
  department: string;
  title: string;
  date: string;
  content: string;
  author?: string;
  sender?: string;
  channel?: string;
  url?: string;
};

export function loadRecords(path: string): MeridianRecord[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l) as MeridianRecord;
      } catch {
        throw new Error(`${path} line ${i + 1} is not valid JSON`);
      }
    });
}

/** First line "<id> · <title> — <author>, <department>, <date>" (+ channel for messages, + url for link pages), then the content. */
export function recordToNote(r: MeridianRecord): string {
  const who = r.author ?? r.sender;
  const head = `${r.id} · ${r.title} — ${[who, r.department, r.date].filter(Boolean).join(", ")}`;
  const extra = r.channel ? ` · channel ${r.channel}` : r.url ? ` · ${r.url}` : "";
  return `${head}${extra}\n${r.content}`;
}
