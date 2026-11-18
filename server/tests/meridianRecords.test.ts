import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { idFromTitle, loadRecords, recordToNote, type MeridianRecord } from "../scripts/meridianRecords.js";

const base = { department: "Sales", date: "2026-11-06", content: "Body text." };
const title60 = (note: string) => note.replace(/\s+/g, " ").slice(0, 60); // same as noteTitle() in the ingest service

describe("meridian records", () => {
  it("note: metadata lines first, then the content", () => {
    const r: MeridianRecord = { ...base, id: "SAL005", type: "note", title: "Pipeline snapshot", author: "Neha Shah" };
    expect(recordToNote(r)).toBe("ID: SAL005\nType: note\nTitle: Pipeline snapshot\nDepartment: Sales\nDate: 2026-11-06\nAuthor: Neha Shah\n\nContent:\nBody text.");
  });

  it("message: sender and channel are added; link page: the source url is added (never fetched)", () => {
    const m = recordToNote({ ...base, id: "MSG003", type: "message", title: "#sales update", sender: "Neha Shah", channel: "#sales" });
    expect(m).toContain("Sender: Neha Shah");
    expect(m).toContain("Channel: #sales");
    const u = recordToNote({ ...base, id: "URL004", type: "url", title: "Plans", source_url: "https://example.com/plans" });
    expect(u).toContain("Source URL: https://example.com/plans");
  });

  it("idFromTitle reads the record id back from a saved note title, in the new and the old format", () => {
    expect(idFromTitle("ID: MEET099 Type: meeting_minutes Title: Weekly sync Department: Product")).toBe("MEET099");
    expect(idFromTitle("FACT004 · Board meeting — Meridian internal record, Company, 2026-11-18")).toBe("FACT004");
  });

  it("the business dataset loads, ids are unique, and every saved title gives its id back (so re-running the seed skips, not duplicates)", () => {
    const rs = loadRecords(fileURLToPath(new URL("../../business-rag-dataset/data/business_records.jsonl", import.meta.url)));
    expect(rs.length).toBe(220);
    for (const r of rs) expect(idFromTitle(title60(recordToNote(r)))).toBe(r.id);
  });
});
