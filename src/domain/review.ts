import { z } from "zod";

import { errorMemoryConfidenceMinimum, type ErrorOccurrence, type PersonalErrorPattern, type WritingErrorCategory, type WritingErrorSubcategory } from "@/domain/writing";

export const reviewInitialIntervalDays = 1;
export const reviewStageIntervalsDays = [3, 7, 14] as const;
export const maximumReviewSessionItems = 5;

export type ReviewSourceType = "error_pattern";
export type ReviewItemStatus = "scheduled" | "mastered";
export type ReviewKind = "scheduled" | "practice_now";
export type ReviewVerdict = "correct" | "incorrect" | "uncertain";
export type ReviewExerciseType = "correction" | "free_production";

const categorySchema = z.enum(["grammar", "vocabulary", "coherence", "technical_accuracy"]);
const subcategorySchema = z.string().min(1).max(120);
const isoDateSchema = z.string().datetime();

export const reviewItemSchema = z.object({
  id: z.string().min(1).max(120), sourceType: z.literal("error_pattern"), patternKey: z.string().min(3).max(160), category: categorySchema, subcategory: subcategorySchema,
  status: z.enum(["scheduled", "mastered"]), stage: z.number().int().min(0).max(3), dueAt: isoDateSchema, createdAt: isoDateSchema, lastReviewedAt: isoDateSchema.nullable(),
  successfulReviews: z.number().int().min(0), failedReviews: z.number().int().min(0), lapseCount: z.number().int().min(0), representativeOccurrenceId: z.string().min(1).max(120), updatedAt: isoDateSchema,
}).strict();
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const reviewEventSchema = z.object({
  id: z.string().min(1).max(120), reviewItemId: z.string().min(1).max(120), patternKey: z.string().min(3).max(160), exerciseType: z.enum(["correction", "free_production"]), reviewKind: z.enum(["scheduled", "practice_now"]),
  reviewedAt: isoDateSchema, verdict: z.enum(["correct", "incorrect", "uncertain"]), stageBefore: z.number().int().min(0).max(3), stageAfter: z.number().int().min(0).max(3),
  dueAtBefore: isoDateSchema, dueAtAfter: isoDateSchema, providerUsed: z.boolean(), providerId: z.enum(["gemini", "openai"]).nullable(), providerModel: z.string().min(1).max(160).nullable(), reviewSessionId: z.string().min(1).max(120),
}).strict();
export type ReviewEvent = z.infer<typeof reviewEventSchema>;

export const reviewEvaluationSchema = z.object({
  verdict: z.enum(["correct", "incorrect", "uncertain"]), feedback: z.string().trim().min(8).max(500), demonstratesTargetPattern: z.boolean(), optionalCorrection: z.string().trim().min(1).max(600).nullable(),
}).strict().superRefine((value, context) => {
  if (value.verdict === "correct" && !value.demonstratesTargetPattern) context.addIssue({ code: "custom", path: ["demonstratesTargetPattern"], message: "A correct verdict must demonstrate the target pattern." });
});
export type ReviewEvaluation = z.infer<typeof reviewEvaluationSchema>;

export type ReviewExercise =
  | { readonly type: "correction"; readonly prompt: string; readonly patternLabel: string }
  | { readonly type: "free_production"; readonly prompt: string; readonly patternLabel: string };

export interface ReviewEvaluationInput {
  readonly patternKey: string;
  readonly category: WritingErrorCategory;
  readonly subcategory: WritingErrorSubcategory;
  readonly exerciseType: ReviewExerciseType;
  readonly learnerAnswer: string;
  readonly originalText?: string;
  readonly canonicalCorrection?: string;
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

function isSchedulable(pattern: PersonalErrorPattern): boolean {
  return pattern.status === "needs_practice" || pattern.status === "improving" || pattern.status === "returned";
}

function eligibleFor(patternKey: string, occurrences: readonly ErrorOccurrence[]): ErrorOccurrence[] {
  return occurrences.filter((occurrence) => occurrence.patternKey === patternKey && !occurrence.dismissed && occurrence.confidence >= errorMemoryConfidenceMinimum)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

export function reviewPatternLabel(patternKey: string): string {
  const labels: Record<string, string> = {
    "grammar.article": "Articles", "grammar.subject_verb_agreement": "Subject–verb agreement", "grammar.auxiliary_verb": "Modal and auxiliary verbs", "grammar.passive_voice": "Passive voice",
    "vocabulary.collocation": "Collocations", "coherence.missing_connector": "Linking ideas",
  };
  return labels[patternKey] ?? patternKey.split(".").map((part) => part.replaceAll("_", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase())).join(" · ");
}

export function synchronizeReviewItems(patterns: readonly PersonalErrorPattern[], occurrences: readonly ErrorOccurrence[], current: readonly ReviewItem[], input: { readonly now: string; readonly createId: () => string }): ReviewItem[] {
  const patternsByKey = new Map(patterns.map((pattern) => [pattern.patternKey, pattern]));
  const onePerPattern = new Map<string, ReviewItem>();
  for (const reviewItem of [...current].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))) {
    if (!onePerPattern.has(reviewItem.patternKey)) onePerPattern.set(reviewItem.patternKey, reviewItem);
  }

  const synced: ReviewItem[] = [];
  for (const [patternKey, pattern] of [...patternsByKey.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const candidates = eligibleFor(patternKey, occurrences);
    if (!candidates.length) continue;
    const existing = onePerPattern.get(patternKey);
    if (!existing && !isSchedulable(pattern)) continue;
    const representative = candidates.some((occurrence) => occurrence.id === existing?.representativeOccurrenceId) ? existing!.representativeOccurrenceId : candidates[0].id;
    if (!existing) {
      synced.push({ id: input.createId(), sourceType: "error_pattern", patternKey, category: pattern.category, subcategory: pattern.subcategory, status: "scheduled", stage: 0, dueAt: addDays(input.now, reviewInitialIntervalDays), createdAt: input.now, lastReviewedAt: null, successfulReviews: 0, failedReviews: 0, lapseCount: 0, representativeOccurrenceId: representative, updatedAt: input.now });
      continue;
    }
    if (pattern.status === "mastered") {
      synced.push(existing.status === "mastered" && representative === existing.representativeOccurrenceId && existing.category === pattern.category && existing.subcategory === pattern.subcategory ? existing : { ...existing, category: pattern.category, subcategory: pattern.subcategory, status: "mastered", representativeOccurrenceId: representative, updatedAt: input.now });
      continue;
    }
    if (pattern.status === "returned" && existing.status === "mastered") {
      synced.push({ ...existing, category: pattern.category, subcategory: pattern.subcategory, status: "scheduled", stage: 0, dueAt: addDays(input.now, reviewInitialIntervalDays), lapseCount: existing.lapseCount + 1, representativeOccurrenceId: representative, updatedAt: input.now });
      continue;
    }
    synced.push(representative === existing.representativeOccurrenceId && existing.category === pattern.category && existing.subcategory === pattern.subcategory ? existing : { ...existing, category: pattern.category, subcategory: pattern.subcategory, representativeOccurrenceId: representative, updatedAt: input.now });
  }
  return synced.sort((left, right) => left.patternKey.localeCompare(right.patternKey));
}

export function queueReviewItems(items: readonly ReviewItem[], patterns: readonly PersonalErrorPattern[], now: string, maximum = maximumReviewSessionItems): ReviewItem[] {
  const patternByKey = new Map(patterns.map((pattern) => [pattern.patternKey, pattern]));
  return items.filter((item) => item.status === "scheduled" && item.dueAt <= now && patternByKey.has(item.patternKey)).sort((left, right) => {
    const leftPattern = patternByKey.get(left.patternKey)!;
    const rightPattern = patternByKey.get(right.patternKey)!;
    const returned = Number(rightPattern.status === "returned") - Number(leftPattern.status === "returned");
    if (returned) return returned;
    const priority = rightPattern.priority - leftPattern.priority;
    if (priority) return priority;
    return left.dueAt.localeCompare(right.dueAt) || left.patternKey.localeCompare(right.patternKey);
  }).slice(0, maximum);
}

function freeProductionPrompt(category: WritingErrorCategory, subcategory: WritingErrorSubcategory, label: string): string {
  if (category === "grammar" && subcategory === "subject_verb_agreement") return "Write one cybersecurity sentence with a singular subject and a correct present-simple verb.";
  if (category === "grammar" && subcategory === "article") return "Write one AI-related sentence using a, an, or the correctly.";
  return `Write one concise cybersecurity or AI sentence that demonstrates ${label.toLowerCase()} correctly.`;
}

export function buildReviewExercise(reviewItem: ReviewItem, occurrence: ErrorOccurrence): ReviewExercise {
  const patternLabel = reviewPatternLabel(reviewItem.patternKey);
  if (reviewItem.stage < 2) return { type: "correction", patternLabel, prompt: `Fix this sentence: ${occurrence.originalText}` };
  return { type: "free_production", patternLabel, prompt: freeProductionPrompt(reviewItem.category, reviewItem.subcategory as WritingErrorSubcategory, patternLabel) };
}

function normalizeCorrection(value: string): string {
  return value.normalize("NFKD").replace(/[’‘`]/gu, "'").replace(/[–—]/gu, "-").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

export function gradeLocalCorrection(answer: string, canonicalCorrection: string): { readonly verdict: "correct" } | { readonly verdict: "needs_provider" } {
  return normalizeCorrection(answer) === normalizeCorrection(canonicalCorrection) ? { verdict: "correct" } : { verdict: "needs_provider" };
}

export function applyReviewVerdict(item: ReviewItem, verdict: ReviewVerdict, reviewKind: ReviewKind, now: string, eventId: string, reviewSessionId: string, metadata: { readonly providerUsed?: boolean; readonly providerId?: "gemini" | "openai" | null; readonly providerModel?: string | null } = {}): { readonly item: ReviewItem; readonly event: ReviewEvent; readonly masteredPatternKey: string | null } {
  const exerciseType: ReviewExerciseType = item.stage < 2 ? "correction" : "free_production";
  const due = item.dueAt <= now;
  let next = item;
  let masteredPatternKey: string | null = null;
  if (verdict === "incorrect") {
    next = { ...item, stage: Math.max(0, item.stage - 1), dueAt: addDays(now, 1), lastReviewedAt: now, failedReviews: item.failedReviews + 1, lapseCount: item.lapseCount + 1, updatedAt: now };
  } else if (verdict === "correct" && reviewKind === "scheduled" && due) {
    if (item.stage === 3) {
      next = { ...item, status: "mastered", lastReviewedAt: now, successfulReviews: item.successfulReviews + 1, updatedAt: now };
      masteredPatternKey = item.patternKey;
    } else {
      next = { ...item, stage: item.stage + 1, dueAt: addDays(now, reviewStageIntervalsDays[item.stage]), lastReviewedAt: now, successfulReviews: item.successfulReviews + 1, updatedAt: now };
    }
  }
  return {
    item: next,
    event: { id: eventId, reviewItemId: item.id, patternKey: item.patternKey, exerciseType, reviewKind, reviewedAt: now, verdict, stageBefore: item.stage, stageAfter: next.stage, dueAtBefore: item.dueAt, dueAtAfter: next.dueAt, providerUsed: metadata.providerUsed ?? false, providerId: metadata.providerId ?? null, providerModel: metadata.providerModel ?? null, reviewSessionId },
    masteredPatternKey,
  };
}
