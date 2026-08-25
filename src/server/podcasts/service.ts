import "server-only";

import type { PodcastEpisode, TranscriptAvailability } from "@/domain/podcast";
import { discoverDarknetDiariesEpisodes } from "@/server/podcasts/feeds";
import { fetchValidatedTranscriptHtml, type SafeFetchOptions } from "@/server/security/safe-fetch";
import { extractDarknetTranscript, findDarknetTranscriptUrl } from "@/server/podcasts/transcript";

export type PodcastListResult = { readonly episodes: readonly PodcastEpisode[] };
export type TranscriptLoadResult =
  | { readonly status: "available"; readonly episode: PodcastEpisode; readonly transcript: ReturnType<typeof extractDarknetTranscript> }
  | { readonly status: "unavailable"; readonly episode: PodcastEpisode }
  | { readonly status: "rejected"; readonly episode: PodcastEpisode }
  | { readonly status: "failed"; readonly episode: PodcastEpisode | null };

function isSafetyRejection(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return ["too large", "unsafe", "not an approved publisher", "not readable text", "content root", "content was not found"].some((phrase) => error.message.toLowerCase().includes(phrase));
}

export async function listPodcasts(options: SafeFetchOptions = {}): Promise<PodcastListResult> {
  return { episodes: await discoverDarknetDiariesEpisodes(options) };
}

export async function loadPodcastTranscript(episodeId: string, options: SafeFetchOptions = {}): Promise<TranscriptLoadResult> {
  const episodes = await discoverDarknetDiariesEpisodes(options);
  const episode = episodes.find((candidate) => candidate.id === episodeId) ?? null;
  if (!episode) return { status: "failed", episode: null };
  try {
    const episodePage = await fetchValidatedTranscriptHtml(episode.episodeUrl, options);
    const transcriptUrl = findDarknetTranscriptUrl(episodePage.html, episodePage.url);
    if (!transcriptUrl) return { status: "unavailable", episode: { ...episode, transcriptAvailability: "unavailable" as TranscriptAvailability } };
    const transcriptPage = await fetchValidatedTranscriptHtml(transcriptUrl, options);
    return { status: "available", episode: { ...episode, transcriptAvailability: "available" as TranscriptAvailability }, transcript: extractDarknetTranscript({ episode, transcriptUrl: transcriptPage.url, html: transcriptPage.html, fetchedAt: new Date().toISOString() }) };
  } catch (error) { return isSafetyRejection(error) ? { status: "rejected", episode } : { status: "failed", episode }; }
}
