import "server-only";

import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { PodcastEpisode, TranscriptDocument, TranscriptTurn } from "@/domain/podcast";
import { darknetDiariesPodcastSource } from "@/server/podcasts/source-registry";

export const transcriptTextMaximumCharacters = 250_000;
const standaloneNoise = new Set(["[MUSIC]", "[INTRO MUSIC]", "[CROSSTALK]"]);

function approvedTranscriptUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password || url.hostname !== darknetDiariesPodcastSource.websiteHost) return null;
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return darknetDiariesPodcastSource.transcriptPath.test(url.pathname) ? url.toString() : null;
  } catch { return null; }
}

export function findDarknetTranscriptUrl(episodeHtml: string, episodeUrl: string): string | null {
  const $ = load(episodeHtml);
  const candidate = $("a").filter((_, element) => /^(read )?full transcript$/i.test($(element).text().replace(/\s+/g, " ").trim())).first().attr("href");
  return candidate ? approvedTranscriptUrl(candidate, episodeUrl) : null;
}

function turnFromText(value: string): TranscriptTurn | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || standaloneNoise.has(normalized)) return null;
  const match = normalized.match(/^([A-Z][A-Z0-9 ()-]{0,40}):\s+(.+)$/);
  return match ? { speaker: match[1].trim(), text: match[2].trim() } : { speaker: null, text: normalized };
}

export function extractDarknetTranscript(input: { episode: PodcastEpisode; transcriptUrl: string; html: string; fetchedAt: string }): TranscriptDocument {
  const $ = load(input.html);
  const root = $("article.single-post").first();
  if (!root.length) throw new Error("Transcript content root was not found");
  const turns = root.find("p").map((_, element) => turnFromText($(element).text())).get().filter((turn): turn is TranscriptTurn => turn !== null).filter((turn) => turn.text !== "Episode Show Notes");
  if (!turns.length) throw new Error("Transcript content was not found");
  const text = turns.map((turn) => turn.speaker ? `${turn.speaker}: ${turn.text}` : turn.text).join("\n\n");
  if (text.length > transcriptTextMaximumCharacters) throw new Error("Transcript extracted text is too large");
  return {
    id: `${input.episode.id}:transcript`, episodeId: input.episode.id, sourceId: input.episode.sourceId, sourceName: input.episode.sourceName, title: input.episode.title,
    transcriptUrl: input.transcriptUrl, turns, text, characterCount: text.length,
    contentFingerprint: `sha256:${createHash("sha256").update(text).digest("hex")}`,
    fetchedAt: input.fetchedAt,
  };
}
