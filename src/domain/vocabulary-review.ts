import { z } from "zod";

import type { SavedPhrase } from "@/domain/boundaries";

export const vocabularyReviewStatuses = ["learning", "reviewing", "mastered", "returned"] as const;
export type VocabularyReviewStatus = (typeof vocabularyReviewStatuses)[number];

export const vocabularyReviewOutcomes = ["correct", "incorrect"] as const;
export type VocabularyReviewOutcome = (typeof vocabularyReviewOutcomes)[number];

export const vocabularyReviewKinds = ["scheduled", "practice_now"] as const;
export type VocabularyReviewKind = (typeof vocabularyReviewKinds)[number];

const isoTimestamp = z.string().datetime({ offset: true });

export const vocabularyReviewItemSchema = z.object({
  phraseId: z.string().min(1),
  status: z.enum(vocabularyReviewStatuses),
  stage: z.number().int().min(0).max(5),
  dueAt: isoTimestamp,
  createdAt: isoTimestamp,
  lastReviewedAt: isoTimestamp.nullable(),
  successfulReviews: z.number().int().min(0),
  failedReviews: z.number().int().min(0),
  lapseCount: z.number().int().min(0),
  updatedAt: isoTimestamp,
}).strict();

export type VocabularyReviewItem = z.infer<typeof vocabularyReviewItemSchema>;

export const vocabularyReviewEventSchema = z.object({
  id: z.string().min(1),
  phraseId: z.string().min(1),
  reviewedAt: isoTimestamp,
  reviewKind: z.enum(vocabularyReviewKinds),
  outcome: z.enum(vocabularyReviewOutcomes),
  stageBefore: z.number().int().min(0).max(5),
  stageAfter: z.number().int().min(0).max(5),
  statusBefore: z.enum(vocabularyReviewStatuses),
  statusAfter: z.enum(vocabularyReviewStatuses),
  scheduleChanged: z.boolean(),
}).strict();

export type VocabularyReviewEvent = z.infer<typeof vocabularyReviewEventSchema>;

export type VocabularyReviewCurrentState = {
  enrolled: number;
  dueNow: number;
  overdue: number;
  mastered: number;
  returned: number;
};

export type VocabularyExercise =
  | { type: "context_cloze"; prompt: string; context: string }
  | { type: "source_recall"; prompt: string; context: null };

export const VOCABULARY_REVIEW_SESSION_LIMIT = 10;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const stageIntervalsInDays = [3, 7, 14, 30, 60] as const;

function addDays(timestamp: string, days: number): string {
  return new Date(new Date(timestamp).getTime() + days * ONE_DAY_MS).toISOString();
}

function isDue(item: VocabularyReviewItem, now: string): boolean {
  return new Date(item.dueAt).getTime() <= new Date(now).getTime();
}

function normalStatusForStage(stage: number): VocabularyReviewStatus {
  if (stage <= 1) {
    return "learning";
  }

  if (stage === 5) {
    return "mastered";
  }

  return "reviewing";
}

function nextStatusAfterSuccess(item: VocabularyReviewItem, stage: number): VocabularyReviewStatus {
  if (stage === 5) {
    return "mastered";
  }

  return item.status === "returned" ? "returned" : normalStatusForStage(stage);
}

function eventFor(
  item: VocabularyReviewItem,
  nextItem: VocabularyReviewItem,
  eventId: string,
  reviewedAt: string,
  reviewKind: VocabularyReviewKind,
  outcome: VocabularyReviewOutcome,
  scheduleChanged: boolean,
): VocabularyReviewEvent {
  return {
    id: eventId,
    phraseId: item.phraseId,
    reviewedAt,
    reviewKind,
    outcome,
    stageBefore: item.stage,
    stageAfter: nextItem.stage,
    statusBefore: item.status,
    statusAfter: nextItem.status,
    scheduleChanged,
  };
}

export function enrollVocabularyPhrase(phraseId: string, enrolledAt: string): VocabularyReviewItem {
  return {
    phraseId,
    status: "learning",
    stage: 0,
    dueAt: addDays(enrolledAt, 1),
    createdAt: enrolledAt,
    lastReviewedAt: null,
    successfulReviews: 0,
    failedReviews: 0,
    lapseCount: 0,
    updatedAt: enrolledAt,
  };
}

export function applyVocabularyReviewOutcome(
  item: VocabularyReviewItem,
  outcome: VocabularyReviewOutcome,
  reviewedAt: string,
  eventId: string,
): { item: VocabularyReviewItem; event: VocabularyReviewEvent } {
  const reviewKind: VocabularyReviewKind = isDue(item, reviewedAt) ? "scheduled" : "practice_now";

  if (outcome === "correct" && reviewKind === "practice_now") {
    return {
      item,
      event: eventFor(item, item, eventId, reviewedAt, reviewKind, outcome, false),
    };
  }

  if (outcome === "correct") {
    const nextStage = Math.min(5, item.stage + 1);
    const nextItem: VocabularyReviewItem = {
      ...item,
      stage: nextStage,
      status: nextStatusAfterSuccess(item, nextStage),
      dueAt: addDays(reviewedAt, stageIntervalsInDays[nextStage - 1]),
      lastReviewedAt: reviewedAt,
      successfulReviews: item.successfulReviews + 1,
      updatedAt: reviewedAt,
    };

    return {
      item: nextItem,
      event: eventFor(item, nextItem, eventId, reviewedAt, reviewKind, outcome, true),
    };
  }

  const becameReturned = item.status === "mastered";
  const nextStage = becameReturned ? 2 : Math.max(0, item.stage - 1);
  const nextStatus: VocabularyReviewStatus = becameReturned
    ? "returned"
    : item.status === "returned"
      ? "returned"
      : normalStatusForStage(nextStage);
  const countsAsLapse = item.status === "reviewing" || item.status === "mastered" || item.status === "returned";
  const nextItem: VocabularyReviewItem = {
    ...item,
    stage: nextStage,
    status: nextStatus,
    dueAt: addDays(reviewedAt, 1),
    lastReviewedAt: reviewedAt,
    failedReviews: item.failedReviews + 1,
    lapseCount: item.lapseCount + (countsAsLapse ? 1 : 0),
    updatedAt: reviewedAt,
  };

  return {
    item: nextItem,
    event: eventFor(item, nextItem, eventId, reviewedAt, reviewKind, outcome, true),
  };
}

export function queueVocabularyReviewItems(
  items: readonly VocabularyReviewItem[],
  phrases: readonly Pick<SavedPhrase, "id">[],
  now: string,
): VocabularyReviewItem[] {
  const phraseIds = new Set(phrases.map((phrase) => phrase.id));

  return items
    .filter((item) => phraseIds.has(item.phraseId) && isDue(item, now))
    .sort((left, right) => {
      const dueDifference = new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
      return dueDifference === 0 ? left.phraseId.localeCompare(right.phraseId) : dueDifference;
    })
    .slice(0, VOCABULARY_REVIEW_SESSION_LIMIT);
}

export function vocabularyReviewCurrentState(
  items: readonly VocabularyReviewItem[],
  phrases: readonly Pick<SavedPhrase, "id">[],
  now: string,
  timeZone: string,
): VocabularyReviewCurrentState {
  const phraseIds = new Set(phrases.map((phrase) => phrase.id));
  const validItems = items.filter((item) => phraseIds.has(item.phraseId));
  const today = localDay(now, timeZone);

  return validItems.reduce<VocabularyReviewCurrentState>((state, item) => {
    const due = isDue(item, now);
    const itemDay = localDay(item.dueAt, timeZone);

    return {
      enrolled: state.enrolled + 1,
      dueNow: state.dueNow + (due ? 1 : 0),
      overdue: state.overdue + (due && itemDay < today ? 1 : 0),
      mastered: state.mastered + (item.status === "mastered" ? 1 : 0),
      returned: state.returned + (item.status === "returned" ? 1 : 0),
    };
  }, { enrolled: 0, dueNow: 0, overdue: 0, mastered: 0, returned: 0 });
}

function localDay(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && /[\p{L}\p{N}_]/u.test(value);
}

function maskExactPhrase(context: string, target: string): string | null {
  const normalizedTarget = target.trim();
  if (!normalizedTarget) {
    return null;
  }

  const lowerContext = context.toLocaleLowerCase("en-US");
  const lowerTarget = normalizedTarget.toLocaleLowerCase("en-US");
  let position = 0;
  let lastPosition = 0;
  let found = false;
  let masked = "";

  while (position < lowerContext.length) {
    const index = lowerContext.indexOf(lowerTarget, position);
    if (index === -1) {
      break;
    }

    const end = index + lowerTarget.length;
    if (!isWordCharacter(context[index - 1]) && !isWordCharacter(context[end])) {
      masked += context.slice(lastPosition, index);
      masked += "[____]";
      lastPosition = end;
      found = true;
    }

    position = end;
  }

  return found ? `${masked}${context.slice(lastPosition)}` : null;
}

export function buildVocabularyExercise(phrase: Pick<SavedPhrase, "phrase" | "context" | "sourceTitle">): VocabularyExercise {
  const maskedContext = maskExactPhrase(phrase.context, phrase.phrase);
  if (maskedContext) {
    return {
      type: "context_cloze",
      prompt: "Complete the saved phrase in this authentic context.",
      context: maskedContext,
    };
  }

  return {
    type: "source_recall",
    prompt: `Recall the saved phrase from ${phrase.sourceTitle}.`,
    context: null,
  };
}

function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/[.!?…]+$/gu, "")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function gradeVocabularyAnswer(answer: string, phrase: string): boolean {
  const normalizedPhrase = normalizeAnswer(phrase);
  return normalizedPhrase.length > 0 && normalizeAnswer(answer) === normalizedPhrase;
}
