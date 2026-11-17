import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { AppError } from "./errors.js";
import { log } from "./logger.js";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

// NOTE: no SSRF protection (private IP ranges are not blocked). Needed in production.
async function download(url: string): Promise<{ body: string; isHtml: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "AIKnowledgeInbox/1.0 (+personal project)" },
    });
    if (!res.ok) {
      log.warn({ url, status: res.status }, "ingest.url_fetch_failed");
      throw new AppError("URL_FETCH_FAILED", 422, `Server responded with ${res.status}`);
    }
    const type = res.headers.get("content-type") ?? "";
    const isHtml = type.includes("text/html");
    if (!isHtml && !type.includes("text/plain")) {
      throw new AppError("URL_FETCH_FAILED", 422, `Unsupported content type: ${type || "unknown"}`);
    }
    // Read at most MAX_BYTES, then stop (truncate rather than reject).
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const c of res.body as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(c);
      size += c.length;
      if (size >= MAX_BYTES) break;
    }
    return { body: Buffer.concat(chunks).subarray(0, MAX_BYTES).toString("utf8"), isHtml };
  } catch (e) {
    if (e instanceof AppError) throw e;
    log.warn({ url, err: (e as Error).name }, "ingest.url_fetch_failed");
    const why = (e as Error).name === "AbortError" ? "timed out after 10s" : "could not be reached";
    throw new AppError("URL_FETCH_FAILED", 422, `URL ${why}`, e);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPage(url: string): Promise<{ title: string; text: string }> {
  const { body, isHtml } = await download(url);
  let title = "";
  let text = body;
  if (isHtml) {
    const article = new Readability(new JSDOM(body, { url }).window.document).parse();
    title = article?.title?.trim() ?? "";
    text = article?.textContent ?? "";
  }
  text = text.trim();
  if (text.length < 100) throw new AppError("NO_EXTRACTABLE_TEXT", 422, "Page had no readable text");
  return { title: title || new URL(url).hostname, text };
}
