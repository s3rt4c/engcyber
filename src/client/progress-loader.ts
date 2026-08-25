import type { ErrorMemoryStore, LessonStore, ListeningStore, ReviewStore, WritingSessionStore } from "@/domain/boundaries";
import type { ProgressSourceData } from "@/domain/progress";

export interface ProgressReaders {
  readonly lessonStore: Pick<LessonStore, "list">;
  readonly writingSessionStore: Pick<WritingSessionStore, "list">;
  readonly errorMemoryStore: Pick<ErrorMemoryStore, "snapshot">;
  readonly reviewStore: Pick<ReviewStore, "snapshot">;
  readonly listeningStore: Pick<ListeningStore, "snapshot">;
}

async function settled<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  const result = await Promise.allSettled([operation()]);
  return result[0]?.status === "fulfilled" ? result[0].value : fallback;
}

export async function loadProgressSourceData(readers: ProgressReaders): Promise<ProgressSourceData> {
  const [lessons, writingSessions, errorMemory, review, listening] = await Promise.all([
    settled(() => readers.lessonStore.list(), []),
    settled(() => readers.writingSessionStore.list(), []),
    settled(() => readers.errorMemoryStore.snapshot(), { occurrences: [], patterns: [] }),
    settled(() => readers.reviewStore.snapshot(), { items: [], events: [] }),
    settled(() => readers.listeningStore.snapshot(), { sessions: [], attempts: [], shadowingEvents: [], playbackRate: 1 }),
  ]);
  return { lessons, writingSessions, errorPatterns: errorMemory.patterns, reviewItems: review.items, reviewEvents: review.events, listeningAttempts: listening.attempts, shadowingEvents: listening.shadowingEvents };
}
