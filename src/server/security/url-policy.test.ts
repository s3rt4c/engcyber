import { describe, expect, it } from "vitest";

import { assertPublicHttpUrl, fetchValidatedFeedText, fetchValidatedText, fetchValidatedTranscriptHtml } from "@/server/security/safe-fetch";

describe("external URL policy", () => {
  it.each(["ftp://example.com/file", "http://localhost/a", "http://127.0.0.1/a", "http://10.0.0.1/a", "http://100.64.0.1/a", "http://169.254.1.1/a", "http://[::1]/a", "http://[fe90::1]/a", "http://[ff02::1]/a", "http://[::ffff:172.16.0.1]/a", "http://user:pass@example.com/a"])
  ("rejects unsafe target %s", (target) => expect(() => assertPublicHttpUrl(target)).toThrow());

  it("revalidates a redirect target before following it", async () => {
    const fetcher = async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
    await expect(fetchValidatedText("https://example.com/article", { fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] })).rejects.toThrow("unsafe");
  });

  it("enforces the body cap even without a content-length header", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(2_000_001))); controller.close(); } });
    const fetcher = async () => new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    await expect(fetchValidatedText("https://example.com/article", { fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] })).rejects.toThrow("too large");
  });

  it("accepts a bounded XML feed but rejects an HTML page at a curated feed URL", async () => {
    const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
    const xmlFetcher = async () => new Response("<rss><channel /></rss>", { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });
    await expect(fetchValidatedFeedText("https://example.com/feed", { fetcher: xmlFetcher, lookup })).resolves.toMatchObject({ xml: "<rss><channel /></rss>" });
    const htmlFetcher = async () => new Response("<html />", { status: 200, headers: { "content-type": "text/html" } });
    await expect(fetchValidatedFeedText("https://example.com/feed", { fetcher: htmlFetcher, lookup })).rejects.toThrow("not XML");
  });

  it("rejects oversized feeds and HTTPS-to-HTTP feed redirects", async () => {
    const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
    const oversized = async () => new Response("x", { status: 200, headers: { "content-type": "application/rss+xml", "content-length": "2000001" } });
    await expect(fetchValidatedFeedText("https://example.com/feed", { fetcher: oversized, lookup })).rejects.toThrow("too large");
    const redirect = async () => new Response(null, { status: 302, headers: { location: "http://example.com/feed" } });
    await expect(fetchValidatedFeedText("https://example.com/feed", { fetcher: redirect, lookup })).rejects.toThrow("HTTPS");
  });

  it("accepts only bounded HTML from an approved transcript publisher", async () => {
    const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
    const html = async () => new Response("<article class=\"single-post\"><p>JACK: Hello.</p></article>", { status: 200, headers: { "content-type": "text/html" } });
    await expect(fetchValidatedTranscriptHtml("https://darknetdiaries.com/transcript/178/", { fetcher: html, lookup })).resolves.toMatchObject({ html: expect.stringContaining("single-post") });
    const huge = async () => new Response("x", { status: 200, headers: { "content-type": "text/html", "content-length": "524289" } });
    await expect(fetchValidatedTranscriptHtml("https://darknetdiaries.com/transcript/178/", { fetcher: huge, lookup })).rejects.toThrow("too large");
    await expect(fetchValidatedTranscriptHtml("https://example.com/transcript/178/", { fetcher: html, lookup })).rejects.toThrow("approved publisher");
  });
});
