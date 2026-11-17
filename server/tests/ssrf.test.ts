import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup }));
const { fetchPage } = await import("../src/lib/fetchUrl.js");

const PAGE = `<html><head><title>Hi</title></head><body><article><p>${"Public page text. ".repeat(20)}</p></article></body></html>`;
const html = () => new Response(PAGE, { headers: { "content-type": "text/html" } });
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const rejects = (url: string) => expect(fetchPage(url)).rejects.toMatchObject({ code: "URL_NOT_ALLOWED", status: 422 });

beforeEach(() => {
  lookup.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  fetchMock.mockReset().mockImplementation(async () => html());
});

describe("SSRF guard", () => {
  it.each(["http://localhost", "http://127.0.0.1", "http://192.168.1.1", "http://[::1]/", "http://[::ffff:10.0.0.1]/", "http://0.0.0.0", "ftp://example.com"])(
    "blocks %s",
    async (url) => {
      await rejects(url);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("blocks a hostname that resolves to a private address (any of several)", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "169.254.169.254", family: 4 }]);
    await rejects("http://evil.example.com");
  });

  it("allows a public URL", async () => {
    expect((await fetchPage("https://example.com/a")).title).toBe("Hi");
  });

  it("re-checks redirect targets", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    await rejects("https://example.com/redir");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a public redirect but gives up after 3", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/b" } }));
    expect((await fetchPage("https://example.com/a")).title).toBe("Hi");
    fetchMock.mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/loop" } }));
    await expect(fetchPage("https://example.com/a")).rejects.toMatchObject({ code: "URL_FETCH_FAILED" });
  });
});

describe("page text", () => {
  it("keeps h1-h3 as '# heading' lines for the chunker", async () => {
    const body = `<html><head><title>T</title></head><body><article><h2>Getting started</h2><p>${"First section text here. ".repeat(6)}</p><h3>Next steps</h3><p>${"Second section text here. ".repeat(6)}</p></article></body></html>`;
    fetchMock.mockImplementationOnce(async () => new Response(body, { headers: { "content-type": "text/html" } }));
    const { text } = await fetchPage("https://example.com/doc");
    expect(text).toMatch(/^# Getting started\s*\n/m);
    expect(text).toMatch(/^# Next steps\s*\n/m);
  });
});
