import { describe, expect, it, vi } from "vitest";

import { deduplicateFeedItems, discoverM1Feeds, parseFeed } from "@/server/discovery/feeds";

describe("RSS discovery", () => {
  it("returns metadata only and removes duplicate canonical URLs", () => {
    const xml = "<rss><channel><item><guid>a</guid><title>One</title><link>https://example.com/a</link><description>Summary</description><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item><item><guid>b</guid><title>Duplicate</title><link>https://example.com/a</link></item></channel></rss>";
    const items = deduplicateFeedItems(parseFeed(xml, { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news"));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "One", primaryCategory: "cybersecurity_news", contentType: "article" });
  });

  it("converts feed-provided HTML summaries to short plain text", () => {
    const [item] = parseFeed("<rss><channel><item><guid>a</guid><title>One</title><description><![CDATA[<p>Useful <strong>English</strong>.</p><script>alert(1)</script>]]></description></item></channel></rss>", { id: "test", name: "Test", kind: "rss", endpoint: "https://example.com/feed", enabled: true }, "cybersecurity_news");
    expect(item.summary).toBe("Useful English.");
  });

  it("performs metadata-only feed requests without an AI action path", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("<rss><channel><item><guid>a</guid><title>One</title><link>https://example.com/a</link></item></channel></rss>", { status: 200 }));
    await expect(discoverM1Feeds(fetcher)).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://www.cisa.gov/cybersecurity-advisories/all.xml",
      "https://huggingface.co/blog/feed.xml",
    ]);
  });

  it("keeps a healthy source visible when another source fails", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).includes("cisa.gov")) throw new Error("CISA unavailable");
      return new Response("<rss><channel><item><guid>a</guid><title>AI item</title><link>https://example.com/ai</link></item></channel></rss>", { status: 200 });
    });
    await expect(discoverM1Feeds(fetcher)).resolves.toMatchObject([{ title: "AI item", primaryCategory: "artificial_intelligence" }]);
  });
});
