import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { AppError } from "./errors.js";
import { log } from "./logger.js";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

const MAX_REDIRECTS = 3;

const blocked = new BlockList();
for (const [net, bits] of [["127.0.0.0", 8], ["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["169.254.0.0", 16], ["0.0.0.0", 8]] as const)
  blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10]] as const) blocked.addSubnet(net, bits, "ipv6");

/** Checks an IP literal; IPv4-mapped IPv6 (::ffff:a.b.c.d or ::ffff:hhhh:hhhh) is unwrapped to its IPv4 first. */
function isPrivate(ip: string): boolean {
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (hex) ip = [parseInt(hex[1], 16) >> 8, parseInt(hex[1], 16) & 255, parseInt(hex[2], 16) >> 8, parseInt(hex[2], 16) & 255].join(".");
  ip = ip.replace(/^::ffff:/i, "");
  return blocked.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6");
}

const notAllowed = (url: string) => {
  log.warn({ url }, "ingest.url_blocked");
  return new AppError("URL_NOT_ALLOWED", 422, "This address points to a private network and can't be fetched.");
};

/** Throws URL_NOT_ALLOWED unless the URL is http(s) and every address its host resolves to is public. */
// ponytail: fetch() resolves DNS again, so a DNS-rebinding host could still slip through; pin the IP via a custom dispatcher if that matters.
async function assertPublic(url: string): Promise<void> {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw notAllowed(url);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) throw notAllowed(url);
  let addrs: { address: string; family: number }[];
  try {
    addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  } catch {
    throw new AppError("URL_FETCH_FAILED", 422, "URL could not be reached");
  }
  if (addrs.some(({ address }) => isPrivate(address))) throw notAllowed(url);
}

async function download(url: string): Promise<{ body: string; isHtml: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let current = url;
    let res: Response;
    for (let hops = 0; ; hops++) {
      await assertPublic(current); // every hop, including redirect targets
      res = await fetch(current, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "User-Agent": "AIKnowledgeInbox/1.0 (+personal project)" },
      });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) break;
      if (hops >= MAX_REDIRECTS) throw new AppError("URL_FETCH_FAILED", 422, "Too many redirects");
      current = new URL(location, current).href;
    }
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
