import { describe, expect, it } from "vitest";

import { filterDiscoverItems } from "@/domain/discovery";
import type { FeedItem } from "@/domain/models";

const items: FeedItem[] = [
  { id: "cisa", sourceId: "cisa-advisories", sourceName: "CISA", title: "CISA", canonicalUrl: "https://example.com/cisa", publishedAt: new Date("2024-03-01T00:00:00Z"), author: null, summary: null, primaryCategory: "cybersecurity_news", tags: [], contentType: "article" },
  { id: "hf", sourceId: "hugging-face-blog", sourceName: "Hugging Face", title: "Hugging Face", canonicalUrl: "https://example.com/hf", publishedAt: new Date("2024-02-01T00:00:00Z"), author: null, summary: null, primaryCategory: "artificial_intelligence", tags: [], contentType: "article" },
  { id: "sans", sourceId: "sans-isc-handlers-diary", sourceName: "SANS ISC", title: "SANS", canonicalUrl: "https://example.com/sans", publishedAt: null, author: null, summary: null, primaryCategory: "cybersecurity_news", tags: [], contentType: "article" },
];

describe("Discover filtering", () => {
  it("intersects category and stable source ID filters locally", () => {
    expect(filterDiscoverItems(items, { category: "cybersecurity_news", sourceId: "sans-isc-handlers-diary", sort: "newest" }).map((item) => item.id)).toEqual(["sans"]);
  });

  it("sorts dated items first and makes undated ties deterministic", () => {
    expect(filterDiscoverItems(items, { category: "all", sourceId: "all", sort: "newest" }).map((item) => item.id)).toEqual(["cisa", "hf", "sans"]);
    expect(filterDiscoverItems(items, { category: "all", sourceId: "all", sort: "oldest" }).map((item) => item.id)).toEqual(["hf", "cisa", "sans"]);
  });
});
