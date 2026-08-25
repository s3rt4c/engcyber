import { describe, expect, it } from "vitest";

import {
  deletePhraseWithVocabularyCleanup,
  enrollPhraseForVocabularyReview,
  recordVocabularyReviewOutcome,
} from "@/client/vocabulary-review-flow";
import type { PhraseStore, VocabularyReviewStore } from "@/domain/boundaries";
import { enrollVocabularyPhrase, type VocabularyReviewEvent, type VocabularyReviewItem } from "@/domain/vocabulary-review";

const now = "2026-08-26T09:00:00.000Z";

function phraseStore(phrases = [{ id: "phrase-1", phrase: "carry out an assessment", context: "Teams must carry out an assessment.", sourceTitle: "Report", sourceUrl: null, contentId: null, savedAt: now }]): PhraseStore & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    list: async () => phrases,
    save: async () => "saved",
    delete: async (id) => { deleted.push(id); return "deleted"; },
  };
}

function reviewStore(items: VocabularyReviewItem[] = [], events: VocabularyReviewEvent[] = []): VocabularyReviewStore & { saved: Array<{ items: readonly VocabularyReviewItem[]; events: readonly VocabularyReviewEvent[] }> } {
  const saved: Array<{ items: readonly VocabularyReviewItem[]; events: readonly VocabularyReviewEvent[] }> = [];
  return {
    saved,
    snapshot: async () => ({ items, events }),
    save: async (nextItems, nextEvents) => { saved.push({ items: nextItems, events: nextEvents }); return true; },
    removePhrase: async () => "removed",
  };
}

describe("vocabulary review flow", () => {
  it("enrols only an existing saved phrase and never enrols it twice", async () => {
    const phrases = phraseStore();
    const reviews = reviewStore();

    expect(await enrollPhraseForVocabularyReview({ phraseId: "phrase-1", phraseStore: phrases, reviewStore: reviews, now })).toBe("enrolled");
    expect(reviews.saved[0]?.items[0]).toEqual(enrollVocabularyPhrase("phrase-1", now));

    const already = reviewStore([enrollVocabularyPhrase("phrase-1", now)]);
    expect(await enrollPhraseForVocabularyReview({ phraseId: "phrase-1", phraseStore: phrases, reviewStore: already, now })).toBe("already_enrolled");
    expect(already.saved).toEqual([]);
  });

  it("does not evict another phrase when the explicit enrollment limit is reached", async () => {
    const phrases = phraseStore([{ id: "phrase-extra", phrase: "carry out an assessment", context: "Teams must carry out an assessment.", sourceTitle: "Report", sourceUrl: null, contentId: null, savedAt: now }]);
    const reviews = reviewStore(Array.from({ length: 200 }, (_, index) => enrollVocabularyPhrase(`phrase-${index}`, now)));

    expect(await enrollPhraseForVocabularyReview({ phraseId: "phrase-extra", phraseStore: phrases, reviewStore: reviews, now })).toBe("limit_reached");
    expect(reviews.saved).toEqual([]);
  });

  it("records only metadata while applying scheduled review semantics", async () => {
    const reviews = reviewStore([enrollVocabularyPhrase("phrase-1", "2026-08-25T09:00:00.000Z")]);

    expect(await recordVocabularyReviewOutcome({ phraseId: "phrase-1", outcome: "correct", reviewStore: reviews, reviewedAt: now, eventId: "event-1" })).toBe("recorded");
    expect(reviews.saved[0]?.events[0]).toEqual(expect.objectContaining({ id: "event-1", phraseId: "phrase-1", reviewKind: "scheduled", outcome: "correct" }));
    expect(Object.keys(reviews.saved[0]?.events[0] ?? {}).sort()).toEqual(["id", "outcome", "phraseId", "reviewKind", "reviewedAt", "scheduleChanged", "stageAfter", "stageBefore", "statusAfter", "statusBefore"]);
  });

  it("blocks phrase deletion when vocabulary cleanup is unavailable", async () => {
    const phrases = phraseStore();
    const reviews = { ...reviewStore(), removePhrase: async () => "unavailable" as const };

    expect(await deletePhraseWithVocabularyCleanup({ phraseId: "phrase-1", phraseStore: phrases, reviewStore: reviews })).toBe("cleanup_unavailable");
    expect(phrases.deleted).toEqual([]);
  });

  it("cleans vocabulary state before deleting the phrase and reports a later phrase-store failure honestly", async () => {
    const phrases = { ...phraseStore(), delete: async () => "unavailable" as const };
    const reviews = reviewStore();
    const removals: string[] = [];
    reviews.removePhrase = async (id) => { removals.push(id); return "removed"; };

    expect(await deletePhraseWithVocabularyCleanup({ phraseId: "phrase-1", phraseStore: phrases, reviewStore: reviews })).toBe("phrase_unavailable_after_cleanup");
    expect(removals).toEqual(["phrase-1"]);
  });
});
