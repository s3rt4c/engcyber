import { describe, expect, it, vi } from "vitest";

import { curatedSources } from "@/server/discovery/source-registry";
import { deduplicateFeedItems, discoverCuratedFeeds, parseFeed } from "@/server/discovery/feeds";

describe("RSS discovery", () => {
  it("declares exactly four stable HTTPS curated sources", async () => {
    expect(curatedSources.map((source) => source.id)).toEqual([
      "cisa-advisories",
      "hugging-face-blog",
      "sans-isc-handlers-diary",
      "google-cloud-threat-intelligence",
    ]);
    expect(new Set(curatedSources.map((source) => source.id)).size).toBe(4);
    expect(curatedSources.every((source) => source.feedUrl.startsWith("https://"))).toBe(true);
  });

  it("returns metadata only and removes duplicate canonical URLs", () => {
    const xml = "<rss><channel><item><guid>a</guid><title>One</title><link>https://example.com/a</link><description>Summary</description><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item><item><guid>b</guid><title>Duplicate</title><link>https://example.com/a</link></item></channel></rss>";
    const items = deduplicateFeedItems(parseFeed(xml, { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news"));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "One", primaryCategory: "cybersecurity_news", contentType: "article" });
  });

  it("converts feed-provided HTML summaries to short plain text", () => {
    const [item] = parseFeed("<rss><channel><item><guid>a</guid><title>One</title><link>https://example.com/article</link><description><![CDATA[<p>Useful <strong>English</strong>.</p><script>alert(1)</script>]]></description></item></channel></rss>", { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(item.summary).toBe("Useful English.");
  });

  it("converts entity-escaped feed HTML to plain text without retaining script content", () => {
    const [item] = parseFeed("<rss><channel><item><guid>a</guid><title>One</title><link>https://example.com/article</link><description><![CDATA[&lt;p&gt;Useful &lt;strong&gt;English&lt;/strong&gt;.&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;]]></description></item></channel></rss>", { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(item.summary).toBe("Useful English.");
  });

  it("decodes bounded numeric entities in a feed summary", () => {
    const [item] = parseFeed("<rss><channel><item><guid>a</guid><title>One</title><link>https://example.com/article</link><description><![CDATA[It doesn&amp;#x27;t execute markup.]]></description></item></channel></rss>", { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(item.summary).toBe("It doesn't execute markup.");
  });

  it("handles a second layer of entity encoding without preserving markup", () => {
    const [item] = parseFeed("<rss><channel><item><guid>a</guid><title>One</title><link>https://example.com/article</link><description><![CDATA[It doesn&amp;amp;#x27;t execute markup.]]></description></item></channel></rss>", { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(item.summary).toBe("It doesn't execute markup.");
  });

  it("uses an explicit HTTP GUID permalink and preserves registry-controlled provenance", () => {
    const [item] = parseFeed("<rss><channel><item><guid isPermaLink='true'>https://example.com/article#fragment</guid><title>One</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>", { id: "test", name: "Trusted source", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(item).toMatchObject({
      sourceId: "test",
      sourceName: "Trusted source",
      canonicalUrl: "https://example.com/article",
    });
  });

  it("skips entries without a safe HTTP(S) article URL", () => {
    const items = parseFeed("<rss><channel><item><title>No link</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item><item><title>Unsafe link</title><link>javascript:alert(1)</link></item><item><title>Safe</title><link>https://example.com/safe</link></item></channel></rss>", { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(items.map((item) => item.title)).toEqual(["Safe"]);
  });

  it("rejects XML entity declarations before parsing", () => {
    expect(() => parseFeed("<!DOCTYPE rss [<!ENTITY injected 'unsafe'>]><rss><channel><item><title>&injected;</title><link>https://example.com/article</link></item></channel></rss>", { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news")).toThrow("declaration");
  });

  it("bounds title, summary, and author metadata while leaving malformed dates undated", () => {
    const [item] = parseFeed(`<rss><channel><item><title>${"T".repeat(400)}</title><link>https://example.com/article</link><description>${"Summary ".repeat(200)}</description><author>${"A".repeat(200)}</author><pubDate>not a date</pubDate></item></channel></rss>`, { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(item.title).toHaveLength(300);
    expect(item.summary?.length).toBeLessThanOrEqual(500);
    expect(item.author).toHaveLength(150);
    expect(item.publishedAt).toBeNull();
  });

  it("normalizes metadata whitespace before applying bounds", () => {
    const [item] = parseFeed("<rss><channel><item><title>  A\n  clear\t title  </title><link>https://example.com/article</link><author>  An\n Author  </author></item></channel></rss>", { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(item.title).toBe("A clear title");
    expect(item.author).toBe("An Author");
  });

  it("normalizes Atom metadata through the same actionable item contract", () => {
    const [item] = parseFeed("<feed><entry><id>entry-1</id><title>Atom item</title><link rel='alternate' href='https://example.com/atom#top'/><published>2024-01-01T00:00:00Z</published><summary>Short summary</summary><author><name>Author</name></author></entry></feed>", { id: "atom", name: "Atom source", kind: "atom", endpoint: "https://example.com/feed", enabled: true }, "artificial_intelligence");
    expect(item).toMatchObject({ sourceId: "atom", sourceName: "Atom source", canonicalUrl: "https://example.com/atom", primaryCategory: "artificial_intelligence", author: "Author", summary: "Short summary" });
  });

  it("prefers an Atom alternate article link over a self link", () => {
    const [item] = parseFeed("<feed><entry><id>entry-1</id><title>Atom item</title><link rel='self' href='https://example.com/feed-entry'/><link rel='alternate' href='https://example.com/article'/></entry></feed>", { id: "atom", name: "Atom source", kind: "atom", endpoint: "https://example.com/feed", enabled: true }, "artificial_intelligence");
    expect(item.canonicalUrl).toBe("https://example.com/article");
  });

  it("performs metadata-only feed requests without an AI action path", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("<rss><channel><item><guid>a</guid><title>One</title><link>https://example.com/a</link></item></channel></rss>", { status: 200, headers: { "content-type": "application/rss+xml" } }));
    await expect(discoverCuratedFeeds({ fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] }).then((result) => result.items)).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://www.cisa.gov/cybersecurity-advisories/all.xml",
      "https://huggingface.co/blog/feed.xml",
      "https://isc.sans.edu/rssfeed.xml",
      "https://feeds.feedburner.com/threatintelligence/pvexyqv7v0v",
    ]);
  });

  it("keeps a healthy source visible when another source fails", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).includes("cisa.gov")) throw new Error("CISA unavailable");
      return new Response("<rss><channel><item><guid>a</guid><title>AI item</title><link>https://example.com/ai</link></item></channel></rss>", { status: 200, headers: { "content-type": "application/rss+xml" } });
    });
    await expect(discoverCuratedFeeds({ fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] }).then((result) => result.items)).resolves.toMatchObject([{ title: "AI item", primaryCategory: "artificial_intelligence" }]);
  });

  it("returns source-local health when one curated feed fails", async () => {
    const { discoverCuratedFeeds } = await import("@/server/discovery/feeds");
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).includes("isc.sans.edu")) throw new Error("offline");
      return new Response("<rss><channel><item><guid>a</guid><title>Healthy</title><link>https://example.com/healthy</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>", { status: 200, headers: { "content-type": "application/rss+xml" } });
    });
    const result = await discoverCuratedFeeds({ fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] });
    expect(result.items).toHaveLength(1);
    expect(result.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "sans-isc-handlers-diary", state: "temporarily_unavailable", reason: "network_error" }),
      expect.objectContaining({ sourceId: "cisa-advisories", state: "available" }),
    ]));
  });

  it("isolates malformed XML to its source", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => String(url).includes("huggingface")
      ? new Response("not an RSS or Atom document", { status: 200, headers: { "content-type": "application/rss+xml" } })
      : new Response("<rss><channel><item><guid>a</guid><title>Healthy</title><link>https://example.com/healthy</link></item></channel></rss>", { status: 200, headers: { "content-type": "application/rss+xml" } }));
    const result = await discoverCuratedFeeds({ fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] });
    expect(result.items).toHaveLength(1);
    expect(result.sources).toContainEqual(expect.objectContaining({ sourceId: "hugging-face-blog", state: "temporarily_unavailable", reason: "invalid_xml" }));
  });

  it("classifies a timed-out source without suppressing other metadata", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).includes("isc.sans.edu")) throw new DOMException("Timed out", "TimeoutError");
      return new Response("<rss><channel><item><guid>a</guid><title>Healthy</title><link>https://example.com/healthy</link></item></channel></rss>", { status: 200, headers: { "content-type": "application/rss+xml" } });
    });
    const result = await discoverCuratedFeeds({ fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] });
    expect(result.items).toHaveLength(1);
    expect(result.sources).toContainEqual(expect.objectContaining({ sourceId: "sans-isc-handlers-diary", state: "temporarily_unavailable", reason: "timeout" }));
  });

  it("deduplicates an exact canonical URL across sources but retains different URLs with the same title", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      const source = String(url).includes("cisa") ? "cisa" : String(url).includes("huggingface") ? "huggingface" : String(url).includes("sans") ? "sans" : "google";
      const link = source === "cisa" || source === "sans" ? "https://example.com/shared?utm_source=feed#fragment" : `https://example.com/${source}`;
      return new Response(`<rss><channel><item><guid>${source}</guid><title>Same title</title><link>${link}</link></item></channel></rss>`, { status: 200, headers: { "content-type": "application/rss+xml" } });
    });
    const result = await discoverCuratedFeeds({ fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] });
    expect(result.items).toHaveLength(3);
    expect(result.items.find((item) => item.canonicalUrl === "https://example.com/shared")?.sourceId).toBe("cisa-advisories");
  });

  it("takes source identity and category from the registry after concurrent discovery", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      const source = String(url).includes("cisa") ? "cisa" : String(url).includes("huggingface") ? "huggingface" : String(url).includes("sans") ? "sans" : "google";
      return new Response(`<rss><channel><item><guid>${source}</guid><title>${source}</title><link>https://example.com/${source}</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`, { status: 200, headers: { "content-type": "application/rss+xml" } });
    });
    await expect(discoverCuratedFeeds({ fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] }).then((result) => result.items)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "cisa-advisories", sourceName: "CISA Cybersecurity Advisories", primaryCategory: "cybersecurity_news" }),
      expect.objectContaining({ sourceId: "hugging-face-blog", sourceName: "Hugging Face Blog", primaryCategory: "artificial_intelligence" }),
      expect.objectContaining({ sourceId: "sans-isc-handlers-diary", sourceName: "SANS ISC Handler's Diary", primaryCategory: "cybersecurity_news" }),
      expect.objectContaining({ sourceId: "google-cloud-threat-intelligence", sourceName: "Google Cloud Threat Intelligence", primaryCategory: "cybersecurity_news" }),
    ]));
  });
});
