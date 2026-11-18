import { listItems } from "../db/items.repository.js";
import { chat } from "../lib/llm.js";
import { log } from "../lib/logger.js";
import { relevantSuggestions } from "./suggestions.js";

const SYSTEM = `You write example questions for a personal notes app.
You get a list of the user's saved notes and links. Write exactly 3 short questions (at most 10 words each) the user could ask about them.
Each question must be answerable from one of the saved items, and the three must be about different items or topics.
Use the user's own words from the items. Output only the 3 questions, one per line, no numbering, no quotes.`;

let cache: { key: string; questions: string[] } | null = null; // one model call per change of the inbox, not per page view

/** Up to 3 questions generated from what is actually saved (recent first, different kinds mixed). Any failure → []. */
export async function inboxSuggestions(): Promise<string[]> {
  const items = listItems().filter((i) => i.type === "note" || i.type === "url");
  if (!items.length) return [];
  const key = `${items.length}:${items[0].id}:${items[0].updatedAt}`;
  if (cache?.key === key) return cache.questions;
  // The 4 newest of each kind: recent and varied. Titles and the start of the text are enough.
  const pick = (type: string) => items.filter((i) => i.type === type).slice(0, 4);
  const list = [...pick("note"), ...pick("url")].map((i) => `- ${i.title}: ${i.preview.replace(/\s+/g, " ").slice(0, 120)}`).join("\n");
  try {
    const raw = await chat(SYSTEM, list);
    const lines = raw.split("\n").map((l) => l.replace(/^[\s\-*\d.)]+/, "").replace(/^["']|["']$/g, "").trim()).filter((l) => l.endsWith("?")).slice(0, 3);
    const questions = await relevantSuggestions(lines); // the same grounding check as follow-ups
    cache = { key, questions };
    return questions;
  } catch (e) {
    log.warn({ err: (e as Error).message }, "inbox_suggestions.failed");
    return [];
  }
}
