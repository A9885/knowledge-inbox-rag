import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadRecords, recordToNote, type MeridianRecord } from "../scripts/meridianRecords.js";

const base = { department: "Sales", date: "2026-11-06", content: "Body text." };

describe("meridian records", () => {
  it("note: id, title, author, department, date on the first line, then the content", () => {
    const r: MeridianRecord = { ...base, id: "SAL005", type: "note", title: "Pipeline snapshot", author: "Neha Shah, Sales Director" };
    expect(recordToNote(r)).toBe("SAL005 · Pipeline snapshot — Neha Shah, Sales Director, Sales, 2026-11-06\nBody text.");
  });

  it("message: sender stands in for the author and the channel is added", () => {
    const r: MeridianRecord = { ...base, id: "MSG003", type: "message", title: "#sales update", sender: "Neha Shah", channel: "#sales" };
    expect(recordToNote(r).split("\n")[0]).toBe("MSG003 · #sales update — Neha Shah, Sales, 2026-11-06 · channel #sales");
  });

  it("link page: the url is added to the first line, and nothing is fetched", () => {
    const r: MeridianRecord = { ...base, id: "URL004", type: "url", title: "Plans and pricing", url: "https://example.com/meridian/plans" };
    expect(recordToNote(r).split("\n")[0]).toBe("URL004 · Plans and pricing — Sales, 2026-11-06 · https://example.com/meridian/plans");
  });

  it("the real records.json loads, ids are unique, and every note title would start with its id (so eval matching works)", () => {
    const rs = loadRecords(fileURLToPath(new URL("../test-data/records.json", import.meta.url)));
    expect(rs.length).toBeGreaterThan(100);
    expect(new Set(rs.map((r) => r.id)).size).toBe(rs.length);
    for (const r of rs) expect(recordToNote(r).replace(/\s+/g, " ").slice(0, 60).startsWith(`${r.id} `)).toBe(true);
  });
});
