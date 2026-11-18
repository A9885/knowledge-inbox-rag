// Guesses what a typed message is. Only ever used to SUGGEST an action; nothing is saved without a click.
const Q_ANYWHERE = /\b(what|when|where|who|whom|whose|why|how|which)\b/i;
const Q_START = /^(is|are|can|could|do|does|did|should|will|tell me|find|show|list)\b/i;

export function guessIntent(text: string): "question" | "note" | "url" | "unclear" {
  const t = text.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return "url";
  if (t.endsWith("?") || Q_ANYWHERE.test(t) || Q_START.test(t)) return "question";
  if (t.split(/\s+/).length <= 3) return "unclear";
  return "note";
}

/** `/note <text>` or `/link <address>` (`/url` still works) typed in Ask mode. */
export function parseCommand(text: string): { type: "note" | "url"; content: string } | null {
  const m = text.trim().match(/^\/(note|url|link)\s+([\s\S]+)$/i);
  return m ? { type: m[1].toLowerCase() === "note" ? "note" : "url", content: m[2].trim() } : null;
}
