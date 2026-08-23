import { describe, expect, it } from "vitest";

import { extractArticle, sanitizeExtractedContent } from "@/server/content/pipeline";

describe("content sanitization", () => {
  it("turns raw external HTML into safe readable content without a feed item", () => {
    const content = sanitizeExtractedContent({ feedItemId: null, title: "Note", canonicalUrl: null, publishedAt: null, author: null, primaryCategory: "my_content", tags: [], contentType: "manual", rawText: "<h1>Note</h1><script>alert(1)</script><p>Read this safely.</p>", externalInputTrust: "untrusted" });
    expect(content.feedItemId).toBeNull();
    expect(content.sanitizationStatus).toBe("sanitized");
    expect(content.sanitizedText).toContain("Read this safely.");
    expect(content.sanitizedText).not.toContain("alert");
  });

  it("keeps readable paragraphs while excluding page chrome", () => {
    const raw = extractArticle({ feedItemId: "item", title: "", canonicalUrl: "https://example.com", publishedAt: null, author: null, primaryCategory: "cybersecurity_news", tags: [], contentType: "article", html: "<header><p>Navigation</p></header><main><h2>Threat report</h2><p>Attackers used stolen credentials.</p><p>They maintained access.</p><h2>More articles</h2><p>Unrelated recommendation</p><div class='c-product-survey'><p>Take survey</p></div></main><footer><p>Footer</p></footer>" });
    const content = sanitizeExtractedContent(raw);
    expect(content.sanitizedText).toBe("Threat report\n\nAttackers used stolen credentials.\n\nThey maintained access.");
  });
});
