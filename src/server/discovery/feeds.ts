import "server-only";

import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";
import { createHash, randomUUID } from "node:crypto";
import type { SourceAdapter } from "@/domain/boundaries";
import type { FeedItem, Source } from "@/domain/models";

const MAX_ITEMS_PER_SOURCE = 24;

export const m1Sources: readonly Source[] = [
  { id: "cisa-advisories", name: "CISA Cybersecurity Advisories", kind: "rss", endpoint: "https://www.cisa.gov/cybersecurity-advisories/all.xml", enabled: true },
  { id: "hugging-face-blog", name: "Hugging Face Blog", kind: "rss", endpoint: "https://huggingface.co/blog/feed.xml", enabled: true },
];

type Category = FeedItem["primaryCategory"];
const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
const asArray = <T,>(value: T | T[] | undefined): T[] => value ? (Array.isArray(value) ? value : [value]) : [];
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

function cleanFeedSummary(value: unknown): string | null {
  const source = text(value);
  if (!source) return null;
  const $ = load(source);
  $("script,style,iframe,form,nav,aside,footer,header,noscript,template").remove();
  const cleaned = $.text().replace(/\s+/g, " ").trim();
  return cleaned.length > 360 ? `${cleaned.slice(0, 357).trimEnd()}…` : cleaned || null;
}

function sortByDate(items: readonly FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
}

export function parseFeed(xml: string, source: Source, category: Category): FeedItem[] {
  const root = parser.parse(xml);
  const rss = asArray(root?.rss?.channel?.item);
  const atom = asArray(root?.feed?.entry);
  return [...rss, ...atom].map((entry: Record<string, unknown>) => {
    const linkValue = entry.link;
    const link = typeof linkValue === "string" ? linkValue : Array.isArray(linkValue) ? linkValue.find((item) => typeof item?.["@_href"] === "string")?.["@_href"] : (linkValue as Record<string, unknown>)?.["@_href"];
    const canonicalUrl = text(link);
    const identity = text(entry.guid) ?? text(entry.id) ?? canonicalUrl ?? text(entry.title) ?? randomUUID();
    const date = text(entry.pubDate) ?? text(entry.published) ?? text(entry.updated);
    return { id: createHash("sha256").update(`${source.id}:${identity}`).digest("hex").slice(0, 24), sourceId: source.id, title: text(entry.title) ?? "Untitled item", canonicalUrl, publishedAt: date && !Number.isNaN(Date.parse(date)) ? new Date(date) : null, author: text((entry.author as Record<string, unknown>)?.name) ?? null, summary: cleanFeedSummary(entry.description) ?? cleanFeedSummary(entry.summary) ?? cleanFeedSummary(entry.content), primaryCategory: category, tags: [], contentType: "article" };
  });
}

class RssSourceAdapter implements SourceAdapter {
  constructor(readonly source: Source, private readonly category: Category, private readonly fetcher: typeof fetch) {}

  async discover(): Promise<readonly FeedItem[]> {
    const response = await this.fetcher(this.source.endpoint!, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml" }, signal: AbortSignal.timeout(10_000), next: { revalidate: 900 } } as RequestInit);
    if (!response.ok) throw new Error(`${this.source.name} feed request failed`);
    return sortByDate(parseFeed(await response.text(), this.source, this.category)).slice(0, MAX_ITEMS_PER_SOURCE);
  }
}

export function deduplicateFeedItems(items: readonly FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => { const key = item.canonicalUrl ?? item.id; if (seen.has(key)) return false; seen.add(key); return true; });
}

export async function discoverM1Feeds(fetcher: typeof fetch = fetch): Promise<FeedItem[]> {
  const categories: Category[] = ["cybersecurity_news", "artificial_intelligence"];
  const adapters = m1Sources.map((source, index) => new RssSourceAdapter(source, categories[index], fetcher));
  const results = await Promise.allSettled(adapters.map((adapter) => adapter.discover()));
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!items.length) throw new Error("All M1 discovery sources failed");
  return sortByDate(deduplicateFeedItems(items));
}
