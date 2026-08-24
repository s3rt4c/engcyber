import "server-only";

import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { SourceAdapter } from "@/domain/boundaries";
import type { DiscoverResult, SourceHealthReason } from "@/domain/discovery";
import type { ContentType, FeedItem, Source } from "@/domain/models";
import { fetchValidatedFeedText, type SafeFetchOptions } from "@/server/security/safe-fetch";
import { curatedSources, type CuratedSource } from "@/server/discovery/source-registry";

export const MAX_ITEMS_PER_SOURCE = 25;
export const MAX_TITLE_LENGTH = 300;
export const MAX_SUMMARY_LENGTH = 500;
export const MAX_AUTHOR_LENGTH = 150;
type Category = FeedItem["primaryCategory"];

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true, processEntities: false, htmlEntities: false });
const asArray = <T,>(value: T | T[] | undefined): T[] => value ? (Array.isArray(value) ? value : [value]) : [];
const text = (value: unknown): string | null => {
  const candidate = typeof value === "string" ? value : value && typeof value === "object" && typeof (value as Record<string, unknown>)["#text"] === "string" ? (value as Record<string, unknown>)["#text"] : null;
  return typeof candidate === "string" && candidate.trim() ? candidate.replace(/\s+/g, " ").trim() : null;
};

function canonicalizeFeedUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) url.port = "";
    for (const parameter of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) url.searchParams.delete(parameter);
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch { return null; }
}

function bounded(value: string | null, maximum: number): string | null {
  if (!value) return null;
  return [...value].slice(0, maximum).join("").trim() || null;
}

function parseDate(value: unknown): Date | null {
  const candidate = text(value);
  if (!candidate || Number.isNaN(Date.parse(candidate))) return null;
  return new Date(candidate);
}

function feedLink(value: unknown): string | null {
  if (typeof value === "string") return value;
  const links = asArray(value as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const href = (link: Record<string, unknown>) => typeof link["@_href"] === "string" ? link["@_href"] : null;
  const preferred = links.find((link) => link["@_rel"] === "alternate" && href(link));
  return href(preferred ?? links.find((link) => href(link)) ?? {});
}

function cleanFeedSummary(value: unknown): string | null {
  const source = text(value);
  if (!source) return null;
  let cleaned = source;
  for (let pass = 0; pass < 3; pass += 1) {
    const $ = load(cleaned);
    $("script,style,iframe,form,nav,aside,footer,header,noscript,template").remove();
    cleaned = $.text();
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return bounded(cleaned, MAX_SUMMARY_LENGTH);
}

function sortByDate(items: readonly FeedItem[]): FeedItem[] {
  return [...items].sort((left, right) => {
    const leftTime = left.publishedAt?.getTime();
    const rightTime = right.publishedAt?.getTime();
    if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime) return rightTime - leftTime;
    if (leftTime !== undefined && rightTime === undefined) return -1;
    if (leftTime === undefined && rightTime !== undefined) return 1;
    return left.id.localeCompare(right.id);
  });
}

export function parseFeed(xml: string, source: Source, category: Category, contentKind: ContentType = "article"): FeedItem[] {
  if (/<!\s*(doctype|entity)\b/i.test(xml)) throw new Error("Feed contains a prohibited XML declaration");
  const root = parser.parse(xml);
  if (!root || typeof root !== "object" || (!root.rss && !root.feed)) throw new Error("Feed XML is malformed");
  const rss = asArray(root?.rss?.channel?.item);
  const atom = asArray(root?.feed?.entry);
  return [...rss, ...atom].flatMap((entry: Record<string, unknown>) => {
    const link = feedLink(entry.link);
    const guid = text(entry.guid);
    const guidPermalink = (entry.guid as Record<string, unknown> | undefined)?.["@_isPermaLink"];
    const canonicalUrl = canonicalizeFeedUrl(link) ?? (guidPermalink !== "false" ? canonicalizeFeedUrl(guid) : null);
    if (!canonicalUrl) return [];
    const identity = text(entry.guid) ?? text(entry.id) ?? canonicalUrl;
    const date = text(entry.pubDate) ?? text(entry.published) ?? text(entry.updated);
    const title = bounded(text(entry.title), MAX_TITLE_LENGTH) ?? "Untitled item";
    const author = bounded(text((entry.author as Record<string, unknown>)?.name) ?? text(entry.author), MAX_AUTHOR_LENGTH);
    return [{ id: createHash("sha256").update(`${source.id}:${canonicalUrl ?? identity}`).digest("hex").slice(0, 24), sourceId: source.id, sourceName: source.name, title, canonicalUrl, publishedAt: parseDate(date), author, summary: cleanFeedSummary(entry.description) ?? cleanFeedSummary(entry.summary), primaryCategory: category, tags: [], contentType: contentKind }];
  });
}

class RssSourceAdapter implements SourceAdapter {
  readonly source: Source;
  constructor(private readonly definition: CuratedSource, private readonly options: SafeFetchOptions) {
    this.source = { id: definition.id, name: definition.displayName, kind: definition.feedType, endpoint: definition.feedUrl, enabled: true };
  }

  async discover(): Promise<readonly FeedItem[]> {
    const { xml } = await fetchValidatedFeedText(this.definition.feedUrl, this.options);
    return sortByDate(parseFeed(xml, this.source, this.definition.category, this.definition.contentKind)).slice(0, MAX_ITEMS_PER_SOURCE);
  }
}

export function deduplicateFeedItems(items: readonly FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => { const key = item.canonicalUrl ?? item.id; if (seen.has(key)) return false; seen.add(key); return true; });
}

function failureReason(error: unknown): SourceHealthReason {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (error instanceof DOMException && error.name === "TimeoutError" || /timeout|abort/.test(message)) return "timeout";
  if (/not xml/.test(message)) return "invalid_content_type";
  if (/too large/.test(message)) return "response_too_large";
  if (/redirect/.test(message)) return "redirect_error";
  if (/xml|declaration/.test(message)) return "invalid_xml";
  return "network_error";
}

function prioritizeSources(items: readonly FeedItem[]): FeedItem[] {
  const priority = new Map(curatedSources.map((source) => [source.id, source.priority]));
  return [...items].sort((left, right) => (priority.get(left.sourceId) ?? Number.MAX_SAFE_INTEGER) - (priority.get(right.sourceId) ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
}

export async function discoverCuratedFeeds(options: SafeFetchOptions = {}): Promise<DiscoverResult> {
  const outcomes = await Promise.all(curatedSources.map(async (source) => {
    const adapter = new RssSourceAdapter(source, options);
    try {
      const items = await adapter.discover();
      return { items, health: { sourceId: source.id, sourceName: source.displayName, state: "available" as const } };
    } catch (error) {
      return { items: [], health: { sourceId: source.id, sourceName: source.displayName, state: "temporarily_unavailable" as const, reason: failureReason(error) } };
    }
  }));
  return { items: sortByDate(deduplicateFeedItems(prioritizeSources(outcomes.flatMap((outcome) => outcome.items)))), sources: outcomes.map((outcome) => outcome.health) };
}
