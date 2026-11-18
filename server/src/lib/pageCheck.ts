/** "HTTPS://Example.com/a/?utm_source=x#top" → "https://example.com/a": the same page, whichever way it was typed. */
export function canonicalUrl(u: string): string {
  try {
    const x = new URL(u.trim());
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^utm_/i.test(k)) x.searchParams.delete(k);
    return `${x.protocol}//${x.host}${x.pathname.replace(/\/+$/, "")}${x.search}`;
  } catch {
    return u.trim();
  }
}

// Bot-check and error pages are not content: indexing them would answer questions with "Just a moment...".
const TITLE = /checking your browser|just a moment|access denied|attention required|are you a robot|verify you are (a )?human|^error\b/i;
const BODY = /checking your browser|just a moment|re-?captcha|captcha|access denied|enable javascript|javascript is (disabled|required)|unusual traffic|are you a robot|verify you are (a )?human|request blocked/i;
const SHORT = 1500; // a real article that mentions "captcha" is longer than a challenge page

export const looksBlocked = (title: string, text: string): boolean => TITLE.test(title) || (text.length < SHORT && BODY.test(`${title} ${text}`));
