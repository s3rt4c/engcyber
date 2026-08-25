import type { Content } from "@/domain/models";
import type { PodcastEpisode, StudyPassage, TranscriptDocument } from "@/domain/podcast";

function digestHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPassageContent(episode: PodcastEpisode, transcript: TranscriptDocument, passage: StudyPassage): Promise<Content> {
  const fingerprint = `sha256:${digestHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passage.text)))}`;
  return { id: `podcast-passage:${passage.id}`, feedItemId: episode.id, title: `${episode.title} — study passage ${passage.index + 1}`, canonicalUrl: transcript.transcriptUrl, publishedAt: episode.publishedAt, author: episode.publisher, primaryCategory: "cybersecurity_news", tags: [], contentType: "transcript", sanitizedText: passage.text, contentFingerprint: fingerprint, sanitizationStatus: "sanitized" };
}
