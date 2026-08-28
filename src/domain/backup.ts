import { z } from "zod";
import { storedLessonSchema } from "@/domain/lesson";
import { errorOccurrenceSchema, personalErrorPatternSchema, writingSessionSchema } from "@/domain/writing";
import { reviewEventSchema, reviewItemSchema } from "@/domain/review";
import { vocabularyReviewEventSchema, vocabularyReviewItemSchema } from "@/domain/vocabulary-review";
import { listeningAttemptSchema, listeningSessionSchema, shadowingEventSchema } from "@/domain/listening";
import { ieltsReadingPracticeSchema, ieltsWritingSessionSchema } from "@/domain/ielts";
import { ieltsListeningSessionSchema } from "@/domain/ielts-listening";
import { ieltsListeningPracticeBank } from "@/domain/ielts-listening-bank";

export const backupFormat = "engcyber-backup" as const;
export const backupFormatVersion = 1 as const;
export const backupAppDataVersion = "m13-local-backup-v1" as const;
export const backupMaximumBytes = 16 * 1024 * 1024;

const phraseSchema = z.object({ id: z.string().trim().min(1), phrase: z.string().trim().min(1), context: z.string().trim().min(1), sourceTitle: z.string().trim().min(1), sourceUrl: z.string().url().nullable(), contentId: z.string().nullable(), savedAt: z.string().datetime() }).strict();
const storesSchema = z.object({
  lessons: z.object({ lessons: z.array(storedLessonSchema).max(20) }).strict(),
  phrases: z.object({ phrases: z.array(phraseSchema) }).strict(),
  writing: z.object({ sessions: z.array(writingSessionSchema).max(50) }).strict(),
  errorMemory: z.object({ occurrences: z.array(errorOccurrenceSchema).max(200), patterns: z.array(personalErrorPatternSchema).max(100) }).strict(),
  errorReview: z.object({ items: z.array(reviewItemSchema).max(100), events: z.array(reviewEventSchema).max(500) }).strict(),
  vocabularyReview: z.object({ items: z.array(vocabularyReviewItemSchema).max(200), events: z.array(vocabularyReviewEventSchema).max(1000) }).strict(),
  listening: z.object({ sessions: z.array(listeningSessionSchema).max(20), attempts: z.array(listeningAttemptSchema).max(200), shadowingEvents: z.array(shadowingEventSchema).max(200), playbackRate: z.number() }).strict(),
  ielts: z.object({ reading: z.array(ieltsReadingPracticeSchema).max(30), writing: z.array(ieltsWritingSessionSchema).max(30), listening: z.array(ieltsListeningSessionSchema).max(30) }).strict(),
}).strict();

export const backupManifestSchema = z.object({ format: z.literal(backupFormat), version: z.literal(backupFormatVersion), createdAt: z.string().datetime(), appDataVersion: z.literal(backupAppDataVersion), stores: storesSchema }).strict();
export type BackupManifest = z.infer<typeof backupManifestSchema>;

function unique(values: readonly string[]) { return new Set(values).size === values.length; }

export function validateBackupManifest(value: unknown) {
  const parsed = backupManifestSchema.safeParse(value);
  if (!parsed.success) return parsed;
  const data = parsed.data;
  const phraseIds = new Set(data.stores.phrases.phrases.map((phrase) => phrase.id));
  const vocabularyIds = [...data.stores.vocabularyReview.items.map((item) => item.phraseId), ...data.stores.vocabularyReview.events.map((event) => event.phraseId)];
  const exerciseIds = new Set(data.stores.listening.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.id)));
  const knownListening = new Set(ieltsListeningPracticeBank.map((item) => item.id));
  const issue = !unique(data.stores.phrases.phrases.map((phrase) => phrase.id)) ? "Phrase IDs must be unique."
    : !vocabularyIds.every((id) => phraseIds.has(id)) ? "Vocabulary records must reference exported phrases."
    : ![...data.stores.listening.attempts, ...data.stores.listening.shadowingEvents].every((event) => exerciseIds.has(event.exerciseId)) ? "Listening events must reference retained exercises."
    : !data.stores.ielts.listening.every((session) => knownListening.has(session.practiceDefinitionId)) ? "IELTS Listening sessions must reference current practice definitions."
    : null;
  return issue ? { success: false as const, error: new z.ZodError([{ code: "custom", path: ["stores"], message: issue }]) } : parsed;
}

export function backupPreview(manifest: BackupManifest) {
  const { stores } = manifest;
  return { createdAt: manifest.createdAt, formatVersion: manifest.version, lessons: stores.lessons.lessons.length, phrases: stores.phrases.phrases.length, writingSessions: stores.writing.sessions.length, errorOccurrences: stores.errorMemory.occurrences.length, errorPatterns: stores.errorMemory.patterns.length, reviewItems: stores.errorReview.items.length, reviewEvents: stores.errorReview.events.length, vocabularyItems: stores.vocabularyReview.items.length, vocabularyEvents: stores.vocabularyReview.events.length, listeningSessions: stores.listening.sessions.length, listeningAttempts: stores.listening.attempts.length, shadowingEvents: stores.listening.shadowingEvents.length, ieltsReading: stores.ielts.reading.length, ieltsWriting: stores.ielts.writing.length, ieltsListening: stores.ielts.listening.length };
}

export function backupFileName(createdAt: string) { return `engcyber-backup-${createdAt.slice(0, 10)}.json`; }
