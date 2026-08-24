import { z } from "zod";

import type { StoredLesson } from "@/domain/lesson";

export const listeningPlaybackRates = [0.75, 0.9, 1, 1.15] as const;
export const defaultListeningPlaybackRate = 1;
export const maximumListeningExercises = 5;
export const maximumListeningSessions = 20;
export const maximumListeningEvents = 200;

export type ListeningExerciseSourceType = "difficult_sentence" | "phrase_example" | "source_sentence";
export type DictationResultStatus = "correct" | "nearly_there" | "try_again";
export type DictationDifference = { readonly kind: "missing" | "extra" | "substitution"; readonly target: string | null; readonly learner: string | null };

const isoDate = z.string().datetime();
const sourceType = z.enum(["difficult_sentence", "phrase_example", "source_sentence"]);

export const listeningExerciseSchema = z.object({
  id: z.string().trim().min(1).max(240), lessonId: z.string().trim().min(1).max(160), sourceType,
  sourceReference: z.string().trim().min(1).max(160), text: z.string().trim().min(8).max(420), createdAt: isoDate,
}).strict();
export type ListeningExercise = z.infer<typeof listeningExerciseSchema>;

export const listeningAttemptSchema = z.object({
  id: z.string().trim().min(1).max(160), exerciseId: z.string().trim().min(1).max(240), attemptedAt: isoDate,
  accuracy: z.number().int().min(0).max(100), matchedCount: z.number().int().min(0), missingCount: z.number().int().min(0), extraCount: z.number().int().min(0), substitutionCount: z.number().int().min(0),
  status: z.enum(["correct", "nearly_there", "try_again"]),
}).strict();
export type ListeningAttempt = z.infer<typeof listeningAttemptSchema>;

export const shadowingEventSchema = z.object({
  id: z.string().trim().min(1).max(160), exerciseId: z.string().trim().min(1).max(240), repeatedAt: isoDate,
}).strict();
export type ShadowingEvent = z.infer<typeof shadowingEventSchema>;

export const listeningSessionSchema = z.object({
  id: z.string().trim().min(1).max(160), lessonId: z.string().trim().min(1).max(160), lessonGenerationFingerprint: z.string().trim().min(1).max(240),
  exercises: z.array(listeningExerciseSchema).min(1).max(maximumListeningExercises), createdAt: isoDate, updatedAt: isoDate, completedExerciseIds: z.array(z.string().trim().min(1).max(240)).max(maximumListeningExercises),
  gradedAttemptCount: z.number().int().min(0), accuracyTotal: z.number().int().min(0), shadowingRepetitionCount: z.number().int().min(0), completedAt: isoDate.nullable(),
}).strict().superRefine((session, context) => {
  const exerciseIds = new Set(session.exercises.map((exercise) => exercise.id));
  if (new Set(session.completedExerciseIds).size !== session.completedExerciseIds.length || session.completedExerciseIds.some((id) => !exerciseIds.has(id))) {
    context.addIssue({ code: "custom", path: ["completedExerciseIds"], message: "Completed exercises must be unique session exercises." });
  }
});
export type ListeningSession = z.infer<typeof listeningSessionSchema>;

export interface DictationResult {
  readonly totalTargetWords: number;
  readonly matchedCount: number;
  readonly missingCount: number;
  readonly extraCount: number;
  readonly substitutionCount: number;
  readonly editDistance: number;
  readonly accuracy: number;
  readonly status: DictationResultStatus;
  readonly differences: readonly DictationDifference[];
}

function normalizeQuotes(value: string): string {
  return value.replace(/[\u2018\u2019\u201B]/gu, "'").replace(/[\u201C\u201D\u201F]/gu, '"');
}

export function normalizeDictation(value: string): string {
  return normalizeQuotes(value.normalize("NFKC")).replace(/\s+/gu, " ").trim().replace(/[.!?]+$/u, "").trim().toLocaleLowerCase();
}

function tokens(value: string): string[] {
  const normalized = normalizeDictation(value);
  return normalized ? normalized.split(" ") : [];
}

function normalizedCandidate(value: string): string {
  return normalizeDictation(value).replace(/[,:;]+$/u, "").trim();
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function suitableExerciseText(value: string): boolean {
  const text = value.replace(/\s+/gu, " ").trim();
  if (text.length < 12 || text.length > 420 || wordCount(text) < 4 || wordCount(text) > 45) return false;
  if (/(?:https?:\/\/|www\.)/iu.test(text) || /(?:`|\{\}|=>|\bconst\b|\bfunction\b|\bawait\b)/iu.test(text)) return false;
  const letters = (text.match(/[\p{L}]/gu) ?? []).length;
  return letters / text.length >= 0.55;
}

function sourceSentences(sourceText: string): string[] {
  return sourceText.replace(/\s+/gu, " ").trim().split(/(?<=[.!?])\s+/u).filter(Boolean);
}

export function buildListeningExercises(input: { readonly lesson: StoredLesson; readonly sourceText?: string; readonly createdAt: string }): ListeningExercise[] {
  const candidates: Array<{ sourceType: ListeningExerciseSourceType; sourceReference: string; text: string }> = [
    ...input.lesson.lesson.difficultSentences.map((sentence, index) => ({ sourceType: "difficult_sentence" as const, sourceReference: `difficult-sentence:${index}`, text: sentence.original })),
    ...input.lesson.lesson.keyPhrases.map((phrase, index) => ({ sourceType: "phrase_example" as const, sourceReference: `phrase-example:${index}`, text: phrase.exampleSentence })),
    ...(input.sourceText ? sourceSentences(input.sourceText).map((text, index) => ({ sourceType: "source_sentence" as const, sourceReference: `source-sentence:${index}`, text })) : []),
  ];
  const seen = new Set<string>();
  const selected: ListeningExercise[] = [];
  for (const candidate of candidates) {
    const text = candidate.text.replace(/\s+/gu, " ").trim();
    const dedupeKey = normalizedCandidate(text);
    if (!dedupeKey || seen.has(dedupeKey) || !suitableExerciseText(text)) continue;
    seen.add(dedupeKey);
    selected.push({ id: `${input.lesson.id}:${candidate.sourceReference}`, lessonId: input.lesson.id, sourceType: candidate.sourceType, sourceReference: candidate.sourceReference, text, createdAt: input.createdAt });
    if (selected.length === maximumListeningExercises) break;
  }
  return selected;
}

function alignment(target: readonly string[], learner: readonly string[]): { readonly matchedCount: number; readonly differences: DictationDifference[]; readonly editDistance: number } {
  const matrix = Array.from({ length: target.length + 1 }, () => Array<number>(learner.length + 1).fill(0));
  for (let row = 0; row <= target.length; row += 1) matrix[row][0] = row;
  for (let column = 0; column <= learner.length; column += 1) matrix[0][column] = column;
  for (let row = 1; row <= target.length; row += 1) for (let column = 1; column <= learner.length; column += 1) {
    matrix[row][column] = target[row - 1] === learner[column - 1] ? matrix[row - 1][column - 1] : Math.min(matrix[row - 1][column - 1], matrix[row - 1][column], matrix[row][column - 1]) + 1;
  }
  const differences: DictationDifference[] = [];
  let matchedCount = 0;
  let row = target.length;
  let column = learner.length;
  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && target[row - 1] === learner[column - 1] && matrix[row][column] === matrix[row - 1][column - 1]) { matchedCount += 1; row -= 1; column -= 1; continue; }
    if (row > 0 && column > 0 && matrix[row][column] === matrix[row - 1][column - 1] + 1) { differences.unshift({ kind: "substitution", target: target[row - 1], learner: learner[column - 1] }); row -= 1; column -= 1; continue; }
    if (row > 0 && matrix[row][column] === matrix[row - 1][column] + 1) { differences.unshift({ kind: "missing", target: target[row - 1], learner: null }); row -= 1; continue; }
    differences.unshift({ kind: "extra", target: null, learner: learner[column - 1] }); column -= 1;
  }
  return { matchedCount, differences, editDistance: matrix[target.length][learner.length] };
}

export function gradeDictation(targetText: string, learnerText: string): DictationResult {
  const target = tokens(targetText);
  const learner = tokens(learnerText);
  const result = alignment(target, learner);
  const accuracy = Math.round(Math.max(0, 1 - result.editDistance / Math.max(1, target.length)) * 100);
  const missingCount = result.differences.filter((difference) => difference.kind === "missing").length;
  const extraCount = result.differences.filter((difference) => difference.kind === "extra").length;
  const substitutionCount = result.differences.filter((difference) => difference.kind === "substitution").length;
  return { totalTargetWords: target.length, matchedCount: result.matchedCount, missingCount, extraCount, substitutionCount, editDistance: result.editDistance, accuracy: Math.min(100, accuracy), status: accuracy === 100 ? "correct" : accuracy >= 80 ? "nearly_there" : "try_again", differences: result.differences };
}

function wordsIn(value: string): number {
  return (value.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

export function chunkForShadowing(text: string): string[] {
  const spans = text.match(/\S+\s*/gu) ?? [text];
  const boundaries: number[] = [];
  for (let index = 0; index < spans.length - 1; index += 1) {
    const before = spans.slice(0, index + 1).join("");
    const after = spans.slice(index + 1).join("");
    const current = spans[index].trim();
    const next = spans[index + 1].trim().replace(/^[,;:]+/u, "").toLocaleLowerCase();
    const punctuationBoundary = /[,;:]$/u.test(current);
    const conjunctionBoundary = /^(and|but|so|because|while|although|before|after)$/u.test(next);
    if ((punctuationBoundary || conjunctionBoundary) && wordsIn(before) >= 3 && wordsIn(after) >= 3) boundaries.push(index + 1);
  }
  if (!boundaries.length) return [text];
  const chunks: string[] = [];
  let start = 0;
  for (const boundary of boundaries) { chunks.push(spans.slice(start, boundary).join("")); start = boundary; }
  chunks.push(spans.slice(start).join(""));
  return chunks.every((chunk) => wordsIn(chunk) > 1) ? chunks : [text];
}

export function isSupportedListeningPlaybackRate(value: unknown): value is (typeof listeningPlaybackRates)[number] {
  return typeof value === "number" && listeningPlaybackRates.some((rate) => rate === value);
}

export function createListeningSession(input: { readonly id: string; readonly lesson: StoredLesson; readonly createdAt: string; readonly sourceText?: string }): ListeningSession {
  const exercises = buildListeningExercises(input).map((exercise) => ({ ...exercise, id: `${input.id}:${exercise.sourceReference}` }));
  if (!exercises.length) throw new Error("No suitable listening exercises are available for this lesson.");
  return { id: input.id, lessonId: input.lesson.id, lessonGenerationFingerprint: input.lesson.generationFingerprint, exercises, createdAt: input.createdAt, updatedAt: input.createdAt, completedExerciseIds: [], gradedAttemptCount: 0, accuracyTotal: 0, shadowingRepetitionCount: 0, completedAt: null };
}

export function recordDictationAttempt(session: ListeningSession, attempt: ListeningAttempt): ListeningSession {
  if (!session.exercises.some((exercise) => exercise.id === attempt.exerciseId)) return session;
  const completedExerciseIds = session.completedExerciseIds.includes(attempt.exerciseId) ? session.completedExerciseIds : [...session.completedExerciseIds, attempt.exerciseId];
  return { ...session, completedExerciseIds, gradedAttemptCount: session.gradedAttemptCount + 1, accuracyTotal: session.accuracyTotal + attempt.accuracy, updatedAt: attempt.attemptedAt, completedAt: completedExerciseIds.length === session.exercises.length ? attempt.attemptedAt : null };
}

export function listeningSessionAverageAccuracy(session: ListeningSession): number {
  return session.gradedAttemptCount ? Math.round(session.accuracyTotal / session.gradedAttemptCount) : 0;
}
