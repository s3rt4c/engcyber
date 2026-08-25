import type { PhraseStore, VocabularyReviewStore } from "@/domain/boundaries";
import {
  applyVocabularyReviewOutcome,
  enrollVocabularyPhrase,
  type VocabularyReviewOutcome,
} from "@/domain/vocabulary-review";

export type VocabularyEnrollmentResult = "enrolled" | "already_enrolled" | "limit_reached" | "missing_phrase" | "unavailable";
export type VocabularyRecordResult = "recorded" | "missing_item" | "unavailable";
export type PhraseDeletionResult = "deleted" | "not_found" | "cleanup_unavailable" | "phrase_unavailable_after_cleanup";

const maximumItems = 200;

export async function enrollPhraseForVocabularyReview(input: {
  readonly phraseId: string;
  readonly phraseStore: PhraseStore;
  readonly reviewStore: VocabularyReviewStore;
  readonly now: string;
}): Promise<VocabularyEnrollmentResult> {
  const phrases = await input.phraseStore.list();
  if (!phrases.some((phrase) => phrase.id === input.phraseId)) {
    return "missing_phrase";
  }

  const snapshot = await input.reviewStore.snapshot();
  if (snapshot.items.some((item) => item.phraseId === input.phraseId)) {
    return "already_enrolled";
  }

  if (snapshot.items.length >= maximumItems) {
    return "limit_reached";
  }

  const enrolled = enrollVocabularyPhrase(input.phraseId, input.now);
  return (await input.reviewStore.save([...snapshot.items, enrolled], snapshot.events)) ? "enrolled" : "unavailable";
}

export async function recordVocabularyReviewOutcome(input: {
  readonly phraseId: string;
  readonly outcome: VocabularyReviewOutcome;
  readonly reviewStore: VocabularyReviewStore;
  readonly reviewedAt: string;
  readonly eventId: string;
}): Promise<VocabularyRecordResult> {
  const snapshot = await input.reviewStore.snapshot();
  const item = snapshot.items.find((candidate) => candidate.phraseId === input.phraseId);
  if (!item) {
    return "missing_item";
  }

  const result = applyVocabularyReviewOutcome(item, input.outcome, input.reviewedAt, input.eventId);
  const items = snapshot.items.map((candidate) => candidate.phraseId === item.phraseId ? result.item : candidate);
  return (await input.reviewStore.save(items, [...snapshot.events, result.event])) ? "recorded" : "unavailable";
}

export async function deletePhraseWithVocabularyCleanup(input: {
  readonly phraseId: string;
  readonly phraseStore: PhraseStore;
  readonly reviewStore: VocabularyReviewStore;
}): Promise<PhraseDeletionResult> {
  const cleanup = await input.reviewStore.removePhrase(input.phraseId);
  if (cleanup === "unavailable") {
    return "cleanup_unavailable";
  }

  const deleted = await input.phraseStore.delete(input.phraseId);
  if (deleted === "deleted") {
    return "deleted";
  }

  if (deleted === "not_found") {
    return "not_found";
  }

  return "phrase_unavailable_after_cleanup";
}
