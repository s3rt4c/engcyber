import { describe, expect, it } from "vitest";

import { loadProgressSourceData, type ProgressReaders } from "@/client/progress-loader";

const emptyReaders: ProgressReaders = {
  lessonStore: { list: async () => [] },
  writingSessionStore: { list: async () => [] },
  errorMemoryStore: { snapshot: async () => ({ occurrences: [], patterns: [] }) },
  reviewStore: { snapshot: async () => ({ items: [], events: [] }) },
  phraseStore: { list: async () => [] },
  vocabularyReviewStore: { snapshot: async () => ({ items: [], events: [] }) },
  listeningStore: { snapshot: async () => ({ sessions: [], attempts: [], shadowingEvents: [], playbackRate: 1 }) },
};

describe("M8 local progress loader", () => {
  it("reads only existing store interfaces into source data", async () => {
    await expect(loadProgressSourceData(emptyReaders)).resolves.toEqual({ lessons: [], writingSessions: [], errorPatterns: [], reviewItems: [], reviewEvents: [], vocabularyReviewItems: [], vocabularyReviewEvents: [], vocabularyPhraseIds: [], listeningAttempts: [], shadowingEvents: [], ieltsReadingPractices: [], ieltsWritingSessions: [] });
  });

  it("keeps other evidence when one local store is unavailable", async () => {
    const result = await loadProgressSourceData({ ...emptyReaders, reviewStore: { snapshot: async () => { throw new Error("storage unavailable"); } } });
    expect(result).toMatchObject({ lessons: [], writingSessions: [], errorPatterns: [], reviewItems: [], reviewEvents: [], vocabularyReviewItems: [], vocabularyReviewEvents: [], vocabularyPhraseIds: [], listeningAttempts: [], shadowingEvents: [], ieltsReadingPractices: [], ieltsWritingSessions: [] });
  });
});
