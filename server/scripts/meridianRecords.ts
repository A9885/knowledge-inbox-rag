import { readFileSync } from "node:fs";

export type MeridianRecord = {
  id: string;
  type: string;
  department: string;
  title: string;
  date: string;
  content: string;
  author?: string;
  sender?: string;
  channel?: string;
  url?: string;
  source_url?: string | null;
  tags?: string[];
};

export function loadRecords(path: string): MeridianRecord[] {
  const records = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      let record: MeridianRecord;

      try {
        record = JSON.parse(line) as MeridianRecord;
      } catch {
        throw new Error(`${path} line ${index + 1} is not valid JSON`);
      }

      if (
        !record.id ||
        !record.title ||
        !record.department ||
        !record.date ||
        typeof record.content !== "string"
      ) {
        throw new Error(`${path} line ${index + 1} is missing required fields`);
      }

      return record;
    });

  const ids = new Set<string>();

  for (const record of records) {
    if (ids.has(record.id)) {
      throw new Error(`Duplicate record ID: ${record.id}`);
    }
    ids.add(record.id);
  }

  return records;
}

export function recordToNote(r: MeridianRecord): string {
  const metadata = [
    `ID: ${r.id}`,
    `Type: ${r.type}`,
    `Title: ${r.title}`,
    `Department: ${r.department}`,
    `Date: ${r.date}`,
    r.author ? `Author: ${r.author}` : undefined,
    r.sender ? `Sender: ${r.sender}` : undefined,
    r.channel ? `Channel: ${r.channel}` : undefined,
    r.tags?.length ? `Tags: ${r.tags.join(", ")}` : undefined,
    r.source_url ? `Source URL: ${r.source_url}` : undefined,
    r.url ? `Source URL: ${r.url}` : undefined,
  ].filter(Boolean);

  return `${metadata.join("\n")}\n\nContent:\n${r.content}`;
}

/** The record id of a saved note, read back from its title (the first 60 characters of the note text). Handles "ID: X ..." and the old "X · ..." format. */
export const idFromTitle = (title: string): string => /^ID: (\S+)/.exec(title)?.[1] ?? title.split(" ")[0];
