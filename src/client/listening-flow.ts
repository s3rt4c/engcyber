import { createListeningSession, gradeDictation, type ListeningAttempt, type ListeningExercise, type ListeningSession, type ShadowingEvent } from "@/domain/listening";
import type { StoredLesson } from "@/domain/lesson";

export function findResumableListeningLesson(input: { readonly sessions: readonly ListeningSession[]; readonly lessons: readonly StoredLesson[] }): StoredLesson | undefined {
  const unfinished = input.sessions.filter((session) => session.completedAt === null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
  for (const session of unfinished) {
    const lesson = input.lessons.find((entry) => entry.generationFingerprint === session.lessonGenerationFingerprint);
    if (lesson) return lesson;
  }
  return undefined;
}

export function createOrResumeListeningSession(input: { readonly sessions: readonly ListeningSession[]; readonly lesson: StoredLesson; readonly now: string; readonly createId: () => string; readonly sourceText?: string; readonly fresh?: boolean }): { readonly session: ListeningSession; readonly resumed: boolean } {
  const existing = input.sessions.filter((session) => session.lessonGenerationFingerprint === input.lesson.generationFingerprint && session.completedAt === null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))[0];
  if (existing && !input.fresh) return { session: existing, resumed: true };
  return { session: createListeningSession({ id: input.createId(), lesson: input.lesson, createdAt: input.now, sourceText: input.sourceText }), resumed: false };
}

export function transcriptAfterCheck(exercise: ListeningExercise, checked: boolean): string | null {
  return checked ? exercise.text : null;
}

export function checkListeningDictation(input: { readonly id: string; readonly exercise: ListeningExercise; readonly learnerText: string; readonly attemptedAt: string }): { readonly attempt: ListeningAttempt; readonly differences: ReturnType<typeof gradeDictation>["differences"] } {
  const graded = gradeDictation(input.exercise.text, input.learnerText);
  return {
    attempt: { id: input.id, exerciseId: input.exercise.id, attemptedAt: input.attemptedAt, accuracy: graded.accuracy, matchedCount: graded.matchedCount, missingCount: graded.missingCount, extraCount: graded.extraCount, substitutionCount: graded.substitutionCount, status: graded.status },
    differences: graded.differences,
  };
}

export function recordShadowingRepetition(session: ListeningSession, event: ShadowingEvent): { readonly session: ListeningSession; readonly event: ShadowingEvent } {
  if (!session.exercises.some((exercise) => exercise.id === event.exerciseId)) return { session, event };
  return { session: { ...session, shadowingRepetitionCount: session.shadowingRepetitionCount + 1, updatedAt: event.repeatedAt }, event };
}
