import type { ErrorMemoryStore, IeltsPracticeStore, LessonStore, ListeningStore, PhraseStore, ReviewStore, VocabularyReviewStore, WritingSessionStore } from "@/domain/boundaries";
import type { ProgressSourceData } from "@/domain/progress";

export interface ProgressReaders {
  readonly lessonStore: Pick<LessonStore, "list">;
  readonly writingSessionStore: Pick<WritingSessionStore, "list">;
  readonly errorMemoryStore: Pick<ErrorMemoryStore, "snapshot">;
  readonly reviewStore: Pick<ReviewStore, "snapshot">;
  readonly phraseStore: Pick<PhraseStore, "list">;
  readonly vocabularyReviewStore: Pick<VocabularyReviewStore, "snapshot">;
  readonly listeningStore: Pick<ListeningStore, "snapshot">;
  readonly ieltsPracticeStore?: Pick<IeltsPracticeStore, "listReading" | "listWriting" | "listListening">;
}

async function settled<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  const result = await Promise.allSettled([operation()]);
  return result[0]?.status === "fulfilled" ? result[0].value : fallback;
}

export async function loadProgressSourceData(readers: ProgressReaders): Promise<ProgressSourceData> {
  const [lessons, writingSessions, errorMemory, review, phrases, vocabularyReview, listening, ieltsReadingPractices, ieltsWritingSessions, ieltsListeningSessions] = await Promise.all([
    settled(() => readers.lessonStore.list(), []),
    settled(() => readers.writingSessionStore.list(), []),
    settled(() => readers.errorMemoryStore.snapshot(), { occurrences: [], patterns: [] }),
    settled(() => readers.reviewStore.snapshot(), { items: [], events: [] }),
    settled(() => readers.phraseStore.list(), []),
    settled(() => readers.vocabularyReviewStore.snapshot(), { items: [], events: [] }),
    settled(() => readers.listeningStore.snapshot(), { sessions: [], attempts: [], shadowingEvents: [], playbackRate: 1 }),
    readers.ieltsPracticeStore ? settled(() => readers.ieltsPracticeStore!.listReading(), []) : Promise.resolve([]),
    readers.ieltsPracticeStore ? settled(() => readers.ieltsPracticeStore!.listWriting(), []) : Promise.resolve([]),
    readers.ieltsPracticeStore ? settled(() => readers.ieltsPracticeStore!.listListening(), []) : Promise.resolve([]),
  ]);
  return { lessons, writingSessions, errorPatterns: errorMemory.patterns, reviewItems: review.items, reviewEvents: review.events, vocabularyReviewItems: vocabularyReview.items, vocabularyReviewEvents: vocabularyReview.events, vocabularyPhraseIds: phrases.map((phrase) => phrase.id), listeningAttempts: listening.attempts, shadowingEvents: listening.shadowingEvents, ieltsReadingPractices, ieltsWritingSessions, ieltsListeningSessions };
}
