import { gradeIeltsListeningAnswers, hasAllIeltsListeningAnswers, type IeltsListeningPracticeDefinition, type IeltsListeningSession } from "@/domain/ielts-listening";

export function canPersistIeltsListeningSession(current: IeltsListeningSession | null, next: IeltsListeningSession): boolean {
  return current?.id !== next.id || current.completedAt === null || next.completedAt !== null;
}

export function createOrResumeIeltsListeningSession(input: { readonly sessions: readonly IeltsListeningSession[]; readonly definition: IeltsListeningPracticeDefinition; readonly now: string; readonly createId: () => string }) {
  const existing = input.sessions.filter((session) => session.practiceDefinitionId === input.definition.id && session.completedAt === null).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))[0];
  if (existing) return { session: existing, resumed: true as const };
  return { session: { id: input.createId(), practiceDefinitionId: input.definition.id, answers: {}, playbackStartedAt: null, playbackCount: 0, correctCount: null, totalCount: null, createdAt: input.now, updatedAt: input.now, completedAt: null } satisfies IeltsListeningSession, resumed: false as const };
}

export function updateIeltsListeningAnswer(session: IeltsListeningSession, questionId: string, answer: string, now: string): IeltsListeningSession {
  if (session.completedAt !== null) return session;
  return { ...session, answers: { ...session.answers, [questionId]: answer }, updatedAt: now };
}

export function markIeltsListeningPlaybackStarted(session: IeltsListeningSession, started: boolean, now: string): IeltsListeningSession {
  if (!started || session.completedAt !== null) return session;
  return { ...session, playbackStartedAt: session.playbackStartedAt ?? now, playbackCount: Math.min(1_000, session.playbackCount + 1), updatedAt: now };
}

export function markCurrentIeltsListeningPlaybackStarted(current: IeltsListeningSession | null, expectedSessionId: string, now: string): IeltsListeningSession | null {
  if (!current || current.id !== expectedSessionId || current.completedAt !== null) return null;
  return markIeltsListeningPlaybackStarted(current, true, now);
}

export function submitIeltsListeningSession(input: { readonly session: IeltsListeningSession; readonly definition: IeltsListeningPracticeDefinition; readonly now: string }) {
  if (input.session.completedAt !== null) return { session: input.session, submitted: false as const, error: "This completed practice is read-only." };
  if (!hasAllIeltsListeningAnswers(input.definition, input.session.answers)) return { session: input.session, submitted: false as const, error: "Answer all six questions before submitting." };
  const result = gradeIeltsListeningAnswers(input.definition, input.session.answers);
  return { session: { ...input.session, correctCount: result.correct, totalCount: result.total as 6, completedAt: input.now, updatedAt: input.now }, submitted: true as const, error: null };
}
