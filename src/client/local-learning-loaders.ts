import { findResumableListeningLesson } from "@/client/listening-flow";
import type { ErrorMemoryStore, IeltsPracticeStore, LessonStore, ListeningStore, PhraseStore, ReviewStore, SavedPhrase, VocabularyReviewStore, WritingSessionStore } from "@/domain/boundaries";
import type { StoredLesson } from "@/domain/lesson";
import { buildProgressSnapshot, type FocusAction, type ProgressSnapshot } from "@/domain/progress";
import { selectIeltsContinuations, type IeltsContinuationItem } from "@/domain/ielts-continuity";
import type { ListeningSnapshot } from "@/client/local-listening-store";
import type { PersonalErrorPattern, WritingSession } from "@/domain/writing";
import type { ReviewEvent, ReviewItem } from "@/domain/review";
import type { VocabularyReviewEvent, VocabularyReviewItem } from "@/domain/vocabulary-review";
import type { IeltsReadingPractice, IeltsWritingSession } from "@/domain/ielts";
import type { IeltsListeningSession } from "@/domain/ielts-listening";

export interface LocalLearningData {
  readonly lessons: readonly StoredLesson[];
  readonly phrases: readonly SavedPhrase[];
  readonly writingSessions: readonly WritingSession[];
  readonly errorPatterns: readonly PersonalErrorPattern[];
  readonly reviewItems: readonly ReviewItem[];
  readonly reviewEvents: readonly ReviewEvent[];
  readonly vocabularyReviewItems: readonly VocabularyReviewItem[];
  readonly vocabularyReviewEvents: readonly VocabularyReviewEvent[];
  readonly listening: ListeningSnapshot;
  readonly ielts: { readonly reading: readonly IeltsReadingPractice[]; readonly writing: readonly IeltsWritingSession[]; readonly listening: readonly IeltsListeningSession[] };
}

export interface LocalLearningReaders {
  readonly lessonStore: Pick<LessonStore, "list">;
  readonly phraseStore: Pick<PhraseStore, "list">;
  readonly writingSessionStore: Pick<WritingSessionStore, "list">;
  readonly errorMemoryStore: Pick<ErrorMemoryStore, "snapshot">;
  readonly reviewStore: Pick<ReviewStore, "snapshot">;
  readonly vocabularyReviewStore: Pick<VocabularyReviewStore, "snapshot">;
  readonly listeningStore: Pick<ListeningStore, "snapshot">;
  readonly ieltsPracticeStore?: Pick<IeltsPracticeStore, "listReading" | "listWriting" | "listListening">;
}

async function settled<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  const result = await Promise.allSettled([operation()]);
  return result[0]?.status === "fulfilled" ? result[0].value : fallback;
}

/** Reads only existing browser-local stores; it never fetches, generates, or synchronizes. */
export async function loadLocalLearningData(readers: LocalLearningReaders): Promise<LocalLearningData> {
  const [lessons, phrases, writingSessions, errorMemory, review, vocabularyReview, listening, ieltsReading, ieltsWriting, ieltsListening] = await Promise.all([
    settled(() => readers.lessonStore.list(), []),
    settled(() => readers.phraseStore.list(), []),
    settled(() => readers.writingSessionStore.list(), []),
    settled(() => readers.errorMemoryStore.snapshot(), { occurrences: [], patterns: [] }),
    settled(() => readers.reviewStore.snapshot(), { items: [], events: [] }),
    settled(() => readers.vocabularyReviewStore.snapshot(), { items: [], events: [] }),
    settled(() => readers.listeningStore.snapshot(), { sessions: [], attempts: [], shadowingEvents: [], playbackRate: 1 }),
    readers.ieltsPracticeStore ? settled(() => readers.ieltsPracticeStore!.listReading(), []) : Promise.resolve([]),
    readers.ieltsPracticeStore ? settled(() => readers.ieltsPracticeStore!.listWriting(), []) : Promise.resolve([]),
    readers.ieltsPracticeStore ? settled(() => readers.ieltsPracticeStore!.listListening(), []) : Promise.resolve([]),
  ]);
  return { lessons, phrases, writingSessions, errorPatterns: errorMemory.patterns, reviewItems: review.items, reviewEvents: review.events, vocabularyReviewItems: vocabularyReview.items, vocabularyReviewEvents: vocabularyReview.events, listening: { sessions: [...listening.sessions], attempts: [...listening.attempts], shadowingEvents: [...listening.shadowingEvents], playbackRate: listening.playbackRate }, ielts: { reading: ieltsReading, writing: ieltsWriting, listening: ieltsListening } };
}

export type WritingResumeAction = { readonly label: "Revise writing" | "Review revision feedback" | "Writing feedback available"; readonly enabled: boolean };
export interface LibraryLesson {
  readonly lesson: StoredLesson;
  readonly title: string;
  readonly sourceLabel: string | null;
  readonly category: string | null;
  readonly contextAvailable: boolean;
  readonly writingAction: WritingResumeAction | null;
  readonly label?: never;
}

export interface LibraryData {
  readonly lessons: readonly LibraryLesson[];
  readonly phrases: readonly (SavedPhrase & { readonly reviewStatus: VocabularyReviewItem["status"] | null; readonly reviewDueAt: string | null })[];
}

function writingAction(session: WritingSession | undefined, contextAvailable: boolean): WritingResumeAction | null {
  if (!session?.initialFeedback) return null;
  if (!contextAvailable) return { label: "Writing feedback available", enabled: false };
  return session.revisionFeedback ? { label: "Review revision feedback", enabled: true } : { label: "Revise writing", enabled: true };
}

function byCreatedAt(left: StoredLesson, right: StoredLesson): number {
  return right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);
}

export function buildLibrary(data: LocalLearningData): LibraryData {
  const writingByLesson = new Map(data.writingSessions.map((session) => [session.lessonId, session]));
  return {
    lessons: [...data.lessons].sort(byCreatedAt).map((lesson) => ({
      lesson,
      title: lesson.context?.title ?? "Saved lesson",
      sourceLabel: lesson.context?.sourceLabel ?? null,
      category: lesson.context?.primaryCategory ?? null,
      contextAvailable: Boolean(lesson.context),
      writingAction: writingAction(writingByLesson.get(lesson.id), Boolean(lesson.context)),
    })),
    phrases: [...data.phrases].sort((left, right) => right.savedAt.localeCompare(left.savedAt) || right.id.localeCompare(left.id)).map((phrase) => {
      const reviewItem = data.vocabularyReviewItems.find((item) => item.phraseId === phrase.id);
      return { ...phrase, reviewStatus: reviewItem?.status ?? null, reviewDueAt: reviewItem?.dueAt ?? null };
    }),
  };
}

export function focusHref(action: FocusAction): "/review" | "/vocabulary" | "/listening" | "/discover" | "/library" {
  const routes: Readonly<Record<FocusAction, "/review" | "/vocabulary" | "/listening" | "/discover" | "/library">> = { review: "/review", vocabulary: "/vocabulary", listening: "/listening", discover: "/discover", library: "/library" };
  return routes[action];
}

export interface DailyHub {
  readonly continueItems: readonly { readonly kind: "listening" | "writing"; readonly label: string; readonly href: string }[];
  readonly ieltsContinuations: readonly IeltsContinuationItem[];
  readonly review: { readonly dueNow: number; readonly overdue: number };
  readonly vocabulary: { readonly dueNow: number; readonly overdue: number };
  readonly focus: readonly { readonly kind: ProgressSnapshot["focus"][number]["kind"]; readonly message: string; readonly href: ReturnType<typeof focusHref> }[];
  readonly recentLessons: readonly LibraryLesson[];
}

export function buildDailyHub(data: LocalLearningData, options: { readonly now: string; readonly timeZone: string }): DailyHub {
  const snapshot = buildProgressSnapshot({ lessons: data.lessons, writingSessions: data.writingSessions, errorPatterns: data.errorPatterns, reviewItems: data.reviewItems, reviewEvents: data.reviewEvents, vocabularyReviewItems: data.vocabularyReviewItems, vocabularyReviewEvents: data.vocabularyReviewEvents, vocabularyPhraseIds: data.phrases.map((phrase) => phrase.id), listeningAttempts: data.listening.attempts, shadowingEvents: data.listening.shadowingEvents, ieltsReadingPractices: data.ielts.reading, ieltsWritingSessions: data.ielts.writing, ieltsListeningSessions: data.ielts.listening }, { range: "all", ...options });
  const library = buildLibrary(data);
  const resumeLesson = findResumableListeningLesson({ sessions: data.listening.sessions, lessons: data.lessons });
  const continuations: Array<{ readonly kind: "listening" | "writing"; readonly label: string; readonly href: string }> = [];
  if (resumeLesson) continuations.push({ kind: "listening", label: "Continue listening", href: `/listening?lesson=${encodeURIComponent(resumeLesson.generationFingerprint)}` });
  for (const entry of library.lessons) {
    if (entry.writingAction?.enabled) continuations.push({ kind: "writing", label: entry.writingAction.label, href: `/library/lessons/${encodeURIComponent(entry.lesson.id)}` });
  }
  return {
    continueItems: continuations,
    ieltsContinuations: selectIeltsContinuations(data.ielts, 3),
    review: { dueNow: snapshot.review.current.dueNow, overdue: snapshot.review.current.overdue },
    vocabulary: { dueNow: snapshot.vocabulary.current.dueNow, overdue: snapshot.vocabulary.current.overdue },
    focus: snapshot.focus.map((entry) => ({ kind: entry.kind, message: entry.message, href: focusHref(entry.action) })),
    recentLessons: library.lessons.slice(0, 3),
  };
}
