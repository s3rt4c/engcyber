import "server-only";

import { createHash } from "node:crypto";
import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import type { PodcastEpisode } from "@/domain/podcast";
import { fetchValidatedFeedText, type SafeFetchOptions } from "@/server/security/safe-fetch";
import { darknetDiariesPodcastSource } from "@/server/podcasts/source-registry";

export const podcastEpisodeLimit = 75;
export const podcastTitleMaximumCharacters = 300;
export const podcastSummaryMaximumCharacters = 500;
export const podcastGuidMaximumCharacters = 300;

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true, processEntities: false, htmlEntities: false });
const asArray = <T,>(value: T | T[] | undefined): T[] => value ? (Array.isArray(value) ? value : [value]) : [];
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : null;

function bounded(value: string | null, maximum: number): string | null {
  return value ? [...value].slice(0, maximum).join("").trim() || null : null;
}

function opaqueGuid(value: unknown): string | null {
  const guid = text(value);
  return guid && [...guid].length <= podcastGuidMaximumCharacters ? guid : null;
}

function canonicalOfficialEpisodeUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password || url.hostname !== darknetDiariesPodcastSource.websiteHost) return null;
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return darknetDiariesPodcastSource.episodePath.test(url.pathname) ? url.toString() : null;
  } catch { return null; }
}

function safeAudioUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

function durationSeconds(value: unknown): number | null {
  const valueText = text(value);
  if (!valueText || !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(valueText)) return null;
  const parts = valueText.split(":").map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0) || parts.slice(1).some((part) => part > 59)) return null;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function cleanSummary(value: unknown): string | null {
  const source = text(value);
  if (!source) return null;
  const $ = load(source);
  $("script,style,iframe,form,nav,aside,footer,header,noscript,template").remove();
  return bounded($.text().replace(/\s+/g, " ").trim(), podcastSummaryMaximumCharacters);
}

export function parseDarknetDiariesFeed(xml: string): PodcastEpisode[] {
  if (/<!\s*(doctype|entity)\b/i.test(xml)) throw new Error("Podcast feed contains a prohibited XML declaration");
  const root = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const entries = asArray(root.rss?.channel?.item as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return entries.flatMap((entry) => {
    const episodeUrl = canonicalOfficialEpisodeUrl(entry.link);
    if (!episodeUrl) return [];
    const guid = opaqueGuid(entry.guid);
    const identity = guid ?? episodeUrl;
    const enclosure = entry.enclosure as Record<string, unknown> | undefined;
    const publishedText = text(entry.pubDate);
    return [{
      id: createHash("sha256").update(`${darknetDiariesPodcastSource.id}:${identity}`).digest("hex").slice(0, 24),
      sourceId: darknetDiariesPodcastSource.id,
      sourceName: darknetDiariesPodcastSource.displayName,
      publisher: darknetDiariesPodcastSource.publisher,
      title: bounded(text(entry.title), podcastTitleMaximumCharacters) ?? "Untitled episode",
      episodeUrl,
      audioUrl: safeAudioUrl(enclosure?.["@_url"]),
      publishedAt: publishedText && !Number.isNaN(Date.parse(publishedText)) ? new Date(publishedText) : null,
      durationSeconds: durationSeconds(entry["itunes:duration"]),
      summary: cleanSummary(entry.description),
      feedGuid: guid,
      transcriptAvailability: "unknown" as const,
      contentKind: "podcast" as const,
    }];
  }).slice(0, podcastEpisodeLimit);
}

export async function discoverDarknetDiariesEpisodes(options: SafeFetchOptions = {}): Promise<readonly PodcastEpisode[]> {
  const { xml } = await fetchValidatedFeedText(darknetDiariesPodcastSource.feedUrl, options);
  return parseDarknetDiariesFeed(xml);
}
