import { describe, expect, it } from "vitest";

import { createPassageContent } from "@/client/podcast-passage-content";

describe("podcast lesson content", () => {
  it("contains only the selected passage, never the complete transcript", async () => {
    const episode = { id: "episode-178", sourceId: "darknet-diaries", sourceName: "Darknet Diaries", publisher: "Darknet Diaries", title: "178: Ubiquiti", episodeUrl: "https://darknetdiaries.com/episode/178/", audioUrl: null, publishedAt: new Date("2026-08-04T00:00:00Z"), durationSeconds: 2172, summary: null, feedGuid: "prx-178", transcriptAvailability: "available" as const, contentKind: "podcast" as const };
    const transcript = { id: "episode-178:transcript", episodeId: episode.id, sourceId: episode.sourceId, sourceName: episode.sourceName, title: episode.title, transcriptUrl: "https://darknetdiaries.com/transcript/178/", turns: [], text: "selected security sentence. Hidden full transcript sentence.", characterCount: 56, contentFingerprint: "sha256:transcript", fetchedAt: "2026-08-25T00:00:00.000Z" };
    const passage = { id: "passage-1", episodeId: episode.id, index: 0, text: "selected security sentence.", wordCount: 3, startTurn: 0, endTurn: 0, transcriptFingerprint: transcript.contentFingerprint };

    const content = await createPassageContent(episode, transcript, passage);

    expect(content.sanitizedText).toBe(passage.text);
    expect(content.sanitizedText).not.toContain("Hidden full transcript sentence.");
    expect(content.contentType).toBe("transcript");
  });
});
