import type { IeltsReadingPractice, IeltsWritingSession } from "@/domain/ielts";
import type { IeltsListeningSession } from "@/domain/ielts-listening";

export type IeltsContinuationDomain = "ielts_reading" | "ielts_writing" | "ielts_listening";
export type IeltsContinuationState = "unfinished_reading" | "unfinished_listening" | "draft" | "revision";

export interface IeltsContinuationItem {
  readonly id: string;
  readonly domain: IeltsContinuationDomain;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly updatedAt: string;
  readonly state: IeltsContinuationState;
}

export type IeltsActivityKind = "reading_completed" | "writing_initial_feedback" | "writing_revision_review" | "listening_completed";

export interface IeltsActivityItem {
  readonly id: string;
  readonly kind: IeltsActivityKind;
  readonly occurredAt: string;
  readonly title: string;
  readonly href: string;
  readonly evidence: string;
}

export interface IeltsContinuityInput {
  readonly reading: readonly IeltsReadingPractice[];
  readonly writing: readonly IeltsWritingSession[];
  readonly listening: readonly IeltsListeningSession[];
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function newestFirst<T extends { readonly id: string }>(items: readonly T[], value: (item: T) => string): T[] {
  return [...items].sort((left, right) => timestamp(value(right))! - timestamp(value(left))! || left.id.localeCompare(right.id));
}

function isNonblank(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function readingCorrect(practice: IeltsReadingPractice): number {
  return practice.questions.filter((question) => practice.answers[question.id] === (question.type === "multiple_choice" ? question.correctOptionId : question.answer)).length;
}

export function selectIeltsContinuations(input: IeltsContinuityInput, limit = Number.POSITIVE_INFINITY): IeltsContinuationItem[] {
  const items: IeltsContinuationItem[] = [];
  for (const practice of input.reading) {
    if (practice.completedAt !== null || timestamp(practice.updatedAt) === null) continue;
    items.push({ id: `ielts-reading:${practice.id}:unfinished`, domain: "ielts_reading", title: "Continue Reading", subtitle: practice.sourceTitle, href: `/ielts/reading/${encodeURIComponent(practice.id)}`, updatedAt: practice.updatedAt, state: "unfinished_reading" });
  }
  for (const session of input.writing) {
    if (timestamp(session.updatedAt) === null) continue;
    if (session.initialFeedback !== null && session.revisionReviewedAt === null) {
      items.push({ id: `ielts-writing:${session.id}:revision`, domain: "ielts_writing", title: "Revise Task 2", subtitle: "Initial feedback is ready", href: `/ielts/writing/${encodeURIComponent(session.id)}`, updatedAt: session.updatedAt, state: "revision" });
    } else if (session.initialFeedback === null && isNonblank(session.draft)) {
      items.push({ id: `ielts-writing:${session.id}:draft`, domain: "ielts_writing", title: "Continue Task 2 draft", subtitle: "Saved Task 2 draft", href: `/ielts/writing/${encodeURIComponent(session.id)}`, updatedAt: session.updatedAt, state: "draft" });
    }
  }
  for (const session of input.listening) {
    if (session.completedAt !== null || timestamp(session.updatedAt) === null) continue;
    items.push({ id: `ielts-listening:${session.id}:unfinished`, domain: "ielts_listening", title: "Continue Listening", subtitle: "Unfinished IELTS Listening practice", href: `/ielts/listening/${encodeURIComponent(session.id)}`, updatedAt: session.updatedAt, state: "unfinished_listening" });
  }
  return newestFirst(items, (item) => item.updatedAt).slice(0, Math.max(0, limit));
}

export function selectIeltsActivity(input: IeltsContinuityInput, limit = Number.POSITIVE_INFINITY): IeltsActivityItem[] {
  const items: IeltsActivityItem[] = [];
  for (const practice of input.reading) {
    if (timestamp(practice.completedAt) === null) continue;
    items.push({ id: `ielts-reading:${practice.id}:completed`, kind: "reading_completed", occurredAt: practice.completedAt!, title: "IELTS Reading completed", href: `/ielts/reading/${encodeURIComponent(practice.id)}`, evidence: `${readingCorrect(practice)} / ${practice.questions.length} correct` });
  }
  for (const session of input.writing) {
    if (session.initialFeedback !== null && timestamp(session.initialAnalyzedAt) !== null) {
      items.push({ id: `ielts-writing:${session.id}:initial`, kind: "writing_initial_feedback", occurredAt: session.initialAnalyzedAt!, title: "Task 2 initial feedback completed", href: `/ielts/writing/${encodeURIComponent(session.id)}`, evidence: "Initial feedback completed" });
    }
    if (session.revisionFeedback !== null && timestamp(session.revisionReviewedAt) !== null) {
      items.push({ id: `ielts-writing:${session.id}:revision`, kind: "writing_revision_review", occurredAt: session.revisionReviewedAt!, title: "Task 2 revision reviewed", href: `/ielts/writing/${encodeURIComponent(session.id)}`, evidence: "Revision reviewed" });
    }
  }
  for (const session of input.listening) {
    if (timestamp(session.completedAt) === null || session.correctCount === null || session.totalCount === null) continue;
    items.push({ id: `ielts-listening:${session.id}:completed`, kind: "listening_completed", occurredAt: session.completedAt!, title: "IELTS Listening completed", href: `/ielts/listening/${encodeURIComponent(session.id)}`, evidence: `${session.correctCount} / ${session.totalCount} correct` });
  }
  return newestFirst(items, (item) => item.occurredAt).slice(0, Math.max(0, limit));
}
