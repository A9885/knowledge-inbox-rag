import { vi } from "vitest";

// Fake embeddings: hashed bag-of-words, so overlapping words → similar vectors.
export const fakeLlm = {
  embed: async (texts: string[]) =>
    texts.map((t) => {
      const v = new Array(256).fill(0);
      for (const w of t.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        let h = 0;
        for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) % 256;
        v[h] += 1;
      }
      return v;
    }),
  chat: vi.fn(async () => "Pinned fact. [1]"),
  chatStream: async function* () {},
};
