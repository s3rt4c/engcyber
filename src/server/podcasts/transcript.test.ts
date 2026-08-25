import { describe, expect, it } from "vitest";

import { extractDarknetTranscript, findDarknetTranscriptUrl } from "@/server/podcasts/transcript";

const episode = { id: "darknet-diaries:178", sourceId: "darknet-diaries", sourceName: "Darknet Diaries", publisher: "Darknet Diaries", title: "178: Ubiquiti", episodeUrl: "https://darknetdiaries.com/episode/178/", audioUrl: null, publishedAt: new Date("2026-08-04T07:00:00Z"), durationSeconds: 2172, summary: null, feedGuid: "prx_178", transcriptAvailability: "unknown" as const, contentKind: "podcast" as const };

describe("Darknet Diaries transcript extraction", () => {
  it("accepts only the official HTTPS transcript relationship", () => {
    expect(findDarknetTranscriptUrl('<article><a href="/transcript/178/">Read Full Transcript</a></article>', episode.episodeUrl)).toBe("https://darknetdiaries.com/transcript/178/");
    expect(findDarknetTranscriptUrl('<article><a href="https://elsewhere.example/transcript/178/">Read Full Transcript</a></article>', episode.episodeUrl)).toBeNull();
    expect(findDarknetTranscriptUrl('<article><a href="http://darknetdiaries.com/transcript/178/">Read Full Transcript</a></article>', episode.episodeUrl)).toBeNull();
  });

  it("uses article.single-post only, preserves speakers, and removes whole-turn music", () => {
    const document = extractDarknetTranscript({ episode, transcriptUrl: "https://darknetdiaries.com/transcript/178/", html: '<article class="single-post"><p>Episode Show Notes</p><pre><p>[MUSIC]</p><p>JACK: The security team found a breach.</p><p>This paragraph has no reliable speaker.</p></pre></article>', fetchedAt: "2026-08-25T00:00:00.000Z" });
    expect(document.turns).toEqual([{ speaker: "JACK", text: "The security team found a breach." }, { speaker: null, text: "This paragraph has no reliable speaker." }]);
    expect(document.text).toBe("JACK: The security team found a breach.\n\nThis paragraph has no reliable speaker.");
  });

  it("fails safely when the approved transcript root is missing", () => {
    expect(() => extractDarknetTranscript({ episode, transcriptUrl: "https://darknetdiaries.com/transcript/178/", html: "<main><p>Do not ingest navigation.</p></main>", fetchedAt: "2026-08-25T00:00:00.000Z" })).toThrow("Transcript content root");
  });

  it("rejects extracted transcript text above its cap rather than truncating it", () => {
    const html = `<article class="single-post"><p>JACK: ${"security ".repeat(31_251)}</p></article>`;

    expect(() => extractDarknetTranscript({ episode, transcriptUrl: "https://darknetdiaries.com/transcript/178/", html, fetchedAt: "2026-08-25T00:00:00.000Z" })).toThrow("too large");
  });
});
