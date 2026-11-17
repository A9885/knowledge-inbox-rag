import { test } from "node:test";
import assert from "node:assert/strict";
import { guessIntent, parseCommand } from "../src/lib/intent.ts";

test("guessIntent table", () => {
  const rows: [string, string][] = [
    ["https://example.com/a", "url"],
    ["When is my mom's birthday", "question"],
    ["is the gym open on sunday", "question"],
    ["anything about goa?", "question"],
    ["Gym moved to 7 AM on weekdays now", "note"],
    ["gym update", "unclear"],
    ["see https://example.com now please", "note"],
  ];
  for (const [text, want] of rows) assert.equal(guessIntent(text), want, text);
});

test("parseCommand", () => {
  assert.deepEqual(parseCommand("/note Gym moved to 7 AM"), { type: "note", content: "Gym moved to 7 AM" });
  assert.deepEqual(parseCommand("/URL https://a.com"), { type: "url", content: "https://a.com" });
  assert.equal(parseCommand("/note"), null);
  assert.equal(parseCommand("what is /note"), null);
});
