export type TranscriptAvailability = "unknown" | "available" | "unavailable";

export type PodcastEpisode = {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly publisher: string;
  readonly title: string;
  readonly episodeUrl: string;
  readonly audioUrl: string | null;
  readonly publishedAt: Date | null;
  readonly durationSeconds: number | null;
  readonly summary: string | null;
  readonly feedGuid: string | null;
  readonly transcriptAvailability: TranscriptAvailability;
  readonly contentKind: "podcast";
};

export type TranscriptTurn = { readonly speaker: string | null; readonly text: string; };

export type TranscriptDocument = {
  readonly id: string;
  readonly episodeId: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly title: string;
  readonly transcriptUrl: string;
  readonly turns: readonly TranscriptTurn[];
  readonly text: string;
  readonly characterCount: number;
  readonly contentFingerprint: string;
  readonly fetchedAt: string;
};

export type StudyPassage = {
  readonly id: string;
  readonly episodeId: string;
  readonly index: number;
  readonly text: string;
  readonly wordCount: number;
  readonly startTurn: number;
  readonly endTurn: number;
  readonly transcriptFingerprint: string;
};

const targetWords = 220;
const maximumWords = 300;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stableId(parts: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const character of parts.join("\u001f")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `passage:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sentences(text: string): string[] {
  const protectedText = normalize(text).replace(/\b(?:dr\.|mr\.|mrs\.|ms\.|prof\.|sr\.|jr\.|e\.g\.|i\.e\.|u\.s\.|vs\.)/gi, (abbreviation) => abbreviation.replaceAll(".", "\uE000"));
  const matches = protectedText.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [];
  return matches.map((match) => normalize(match.replaceAll("\uE000", "."))).filter(Boolean);
}

export function createStudyPassages(transcript: TranscriptDocument): StudyPassage[] {
  const passages: StudyPassage[] = [];
  let selected: Array<{ readonly text: string; readonly turnIndex: number }> = [];
  let selectedWords = 0;
  let startTurn = 0;

  const flush = (endTurn: number) => {
    if (!selected.length) return;
    const text = selected.map((part, index) => `${index === 0 ? "" : selected[index - 1]?.turnIndex === part.turnIndex ? " " : "\n\n"}${part.text}`).join("");
    const index = passages.length;
    passages.push({ id: stableId([transcript.episodeId, transcript.contentFingerprint, String(index), String(startTurn), String(endTurn), normalize(text)]), episodeId: transcript.episodeId, index, text, wordCount: selectedWords, startTurn, endTurn, transcriptFingerprint: transcript.contentFingerprint });
    selected = [];
    selectedWords = 0;
  };

  transcript.turns.forEach((turn, index) => {
    const pieces = sentences(turn.text);
    for (const text of pieces) {
      const words = wordCount(text);
      if (!words) continue;
      if (selectedWords && selectedWords + words > maximumWords) {
        flush(index);
        startTurn = index;
      }
      if (!selected.length) startTurn = index;
      selected.push({ text, turnIndex: index });
      selectedWords += words;
      if (selectedWords >= targetWords) flush(index);
    }
  });
  flush(transcript.turns.length - 1);
  const finalPassage = passages.at(-1);
  const previousPassage = passages.at(-2);
  if (finalPassage && previousPassage && finalPassage.wordCount < 150 && previousPassage.wordCount + finalPassage.wordCount <= maximumWords) {
    const text = `${previousPassage.text}\n\n${finalPassage.text}`;
    passages[passages.length - 2] = {
      ...previousPassage,
      id: stableId([transcript.episodeId, transcript.contentFingerprint, String(previousPassage.index), String(previousPassage.startTurn), String(finalPassage.endTurn), normalize(text)]),
      text,
      wordCount: previousPassage.wordCount + finalPassage.wordCount,
      endTurn: finalPassage.endTurn,
    };
    passages.pop();
  }
  return passages;
}
