import { describe, expect, it } from "vitest";

import { createStudyPassages, type TranscriptDocument } from "@/domain/podcast";

const sentence = (word: string, count: number) => `${Array.from({ length: count }, () => word).join(" ")}.`;

describe("podcast study passages", () => {
  it("creates stable sentence-aligned passages from an unchanged transcript", () => {
    const turns = [
      { speaker: "JACK", text: sentence("alpha", 110) },
      { speaker: "GUEST", text: sentence("bravo", 110) },
      { speaker: "JACK", text: sentence("charlie", 110) },
    ];
    const transcript: TranscriptDocument = {
      id: "darknet-diaries:episode-178:transcript",
      episodeId: "darknet-diaries:episode-178",
      sourceId: "darknet-diaries",
      sourceName: "Darknet Diaries",
      title: "EP 178: Ubiquiti",
      transcriptUrl: "https://darknetdiaries.com/transcript/178/",
      turns,
      text: turns.map((turn) => `${turn.speaker}: ${turn.text}`).join("\n\n"),
      characterCount: turns.reduce((total, turn) => total + turn.text.length, 0),
      contentFingerprint: "sha256:unchanged-transcript",
      fetchedAt: "2026-08-25T00:00:00.000Z",
    };

    const first = createStudyPassages(transcript);
    const second = createStudyPassages(transcript);

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first.every((passage) => passage.wordCount <= 300 && /[.!?]$/.test(passage.text))).toBe(true);
  });

  it("splits an oversized speaker turn only at a sentence boundary", () => {
    const firstSentence = sentence("network", 180);
    const secondSentence = sentence("security", 140);
    const transcript: TranscriptDocument = {
      id: "episode:oversized:transcript", episodeId: "episode:oversized", sourceId: "darknet-diaries", sourceName: "Darknet Diaries", title: "Oversized", transcriptUrl: "https://darknetdiaries.com/transcript/1/",
      turns: [{ speaker: "JACK", text: `${firstSentence} ${secondSentence}` }], text: `JACK: ${firstSentence} ${secondSentence}`, characterCount: firstSentence.length + secondSentence.length + 1, contentFingerprint: "sha256:oversized", fetchedAt: "2026-08-25T00:00:00.000Z",
    };

    const passages = createStudyPassages(transcript);

    expect(passages.map((passage) => passage.text)).toEqual([firstSentence, secondSentence]);
    expect(passages.every((passage) => passage.wordCount <= 300)).toBe(true);
  });

  it("does not split an ordinary sentence after a common abbreviation", () => {
    const transcript: TranscriptDocument = {
      id: "episode:abbreviation:transcript", episodeId: "episode:abbreviation", sourceId: "darknet-diaries", sourceName: "Darknet Diaries", title: "Abbreviation", transcriptUrl: "https://darknetdiaries.com/transcript/1/",
      turns: [{ speaker: "JACK", text: "Dr. Smith reviewed the CISA advisory. The incident response team acted." }], text: "JACK: Dr. Smith reviewed the CISA advisory. The incident response team acted.", characterCount: 70, contentFingerprint: "sha256:abbreviation", fetchedAt: "2026-08-25T00:00:00.000Z",
    };

    expect(createStudyPassages(transcript)).toMatchObject([{ text: "Dr. Smith reviewed the CISA advisory. The incident response team acted." }]);
  });

  it("merges a natural short final tail when it stays below the hard maximum", () => {
    const transcript: TranscriptDocument = {
      id: "episode:tail:transcript", episodeId: "episode:tail", sourceId: "darknet-diaries", sourceName: "Darknet Diaries", title: "Tail", transcriptUrl: "https://darknetdiaries.com/transcript/1/",
      turns: [{ speaker: "JACK", text: sentence("incident", 227) }, { speaker: "GUEST", text: sentence("response", 36) }], text: "", characterCount: 0, contentFingerprint: "sha256:tail", fetchedAt: "2026-08-25T00:00:00.000Z",
    };

    expect(createStudyPassages(transcript)).toMatchObject([{ wordCount: 263 }]);
  });
});
