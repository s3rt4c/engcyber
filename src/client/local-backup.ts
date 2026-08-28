import { backupAppDataVersion, backupFileName, backupFormat, backupFormatVersion, backupMaximumBytes, type BackupManifest, validateBackupManifest } from "@/domain/backup";
import { learnerStorageKeys, type BackupStorage, type SerializedRestore } from "@/client/backup-storage";

const versions = ["m2-lesson-cache-v1", "m9-phrases-v2", "m3-writing-sessions-v1", "m3-error-memory-v1", "m4-review-store-v1", "m10-vocabulary-review-v1", "m5-listening-v1", "m12-ielts-practice-v2"] as const;
function raw(storage: BackupStorage, key: string) { try { return storage.getItem(key); } catch { throw new Error("Browser storage is unavailable."); } }
function json(value: string | null, category: string): Record<string, unknown> | null { if (value === null) return null; try { const parsed: unknown = JSON.parse(value); if (!parsed || typeof parsed !== "object") throw new Error(); return parsed as Record<string, unknown>; } catch { throw new Error(`${category} data is malformed and cannot be backed up.`); } }
function list(value: Record<string, unknown> | null, version: string, name: string, category: string): unknown[] { if (value === null) return []; if (value.version !== version || !Array.isArray(value[name])) throw new Error(`${category} data is malformed and cannot be backed up.`); return value[name] as unknown[]; }
function legacyId(index: number, phrase: Record<string, unknown>) { return `legacy-phrase-${index}-${String(phrase.phrase ?? "phrase").trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").slice(0, 40) || "item"}`; }

export function createBackupFromStorage(storage: BackupStorage, createdAt = new Date().toISOString()): BackupManifest {
  const lesson = json(raw(storage, learnerStorageKeys[0]), "Lessons");
  const phraseParsed = json(raw(storage, learnerStorageKeys[1]), "Phrases");
  const writing = json(raw(storage, learnerStorageKeys[2]), "Writing"); const memory = json(raw(storage, learnerStorageKeys[3]), "Error Memory"); const review = json(raw(storage, learnerStorageKeys[4]), "Error Review"); const vocabulary = json(raw(storage, learnerStorageKeys[5]), "Vocabulary"); const listening = json(raw(storage, learnerStorageKeys[6]), "Listening"); const ielts = json(raw(storage, learnerStorageKeys[7]), "IELTS");
  const phrases = Array.isArray(phraseParsed) ? phraseParsed.map((value, index) => ({ ...(value as Record<string, unknown>), id: legacyId(index, value as Record<string, unknown>) })) : list(phraseParsed as Record<string, unknown> | null, versions[1], "phrases", "Phrases");
  const manifest = { format: backupFormat, version: backupFormatVersion, createdAt, appDataVersion: backupAppDataVersion, stores: {
    lessons: { lessons: list(lesson, versions[0], "lessons", "Lessons") }, phrases: { phrases }, writing: { sessions: list(writing, versions[2], "sessions", "Writing") }, errorMemory: { occurrences: list(memory, versions[3], "occurrences", "Error Memory"), patterns: list(memory, versions[3], "patterns", "Error Memory") }, errorReview: { items: list(review, versions[4], "items", "Error Review"), events: list(review, versions[4], "events", "Error Review") }, vocabularyReview: { items: list(vocabulary, versions[5], "items", "Vocabulary"), events: list(vocabulary, versions[5], "events", "Vocabulary") }, listening: { sessions: list(listening, versions[6], "sessions", "Listening"), attempts: list(listening, versions[6], "attempts", "Listening"), shadowingEvents: list(listening, versions[6], "shadowingEvents", "Listening"), playbackRate: listening?.playbackRate ?? 1 }, ielts: { reading: list(ielts, ielts?.version === "m11-ielts-practice-v1" ? "m11-ielts-practice-v1" : versions[7], "reading", "IELTS"), writing: list(ielts, ielts?.version === "m11-ielts-practice-v1" ? "m11-ielts-practice-v1" : versions[7], "writing", "IELTS"), listening: ielts?.version === "m11-ielts-practice-v1" ? [] : list(ielts, versions[7], "listening", "IELTS") }
  } };
  const valid = validateBackupManifest(manifest); if (!valid.success) throw new Error("Current learner data cannot form a complete valid backup."); return valid.data;
}

export function serializeBackup(manifest: BackupManifest) { const text = JSON.stringify(manifest, null, 2); if (new TextEncoder().encode(text).byteLength > backupMaximumBytes) throw new Error("Current local data exceeds the supported backup size."); return { text, filename: backupFileName(manifest.createdAt) }; }
export function parseBackupText(text: string) {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("The selected file is not valid JSON."); }
  const valid = validateBackupManifest(value);
  if (!valid.success) throw new Error("The selected file is not a complete supported EngCyber backup.");
  return valid.data;
}
export function serializeRestore(manifest: BackupManifest): SerializedRestore { const s = manifest.stores; return { "engcyber.lessons.v1": JSON.stringify({ version: versions[0], lessons: s.lessons.lessons }), "engcyber.saved-phrases.v1": JSON.stringify({ version: versions[1], phrases: s.phrases.phrases }), "engcyber.writing-sessions.v1": JSON.stringify({ version: versions[2], sessions: s.writing.sessions }), "engcyber.error-memory.v1": JSON.stringify({ version: versions[3], occurrences: s.errorMemory.occurrences, patterns: s.errorMemory.patterns }), "engcyber.review-items.v1": JSON.stringify({ version: versions[4], items: s.errorReview.items, events: s.errorReview.events }), "engcyber.vocabulary-review.v1": JSON.stringify({ version: versions[5], items: s.vocabularyReview.items, events: s.vocabularyReview.events }), "engcyber.listening.v1": JSON.stringify({ version: versions[6], ...s.listening }), "engcyber.ielts-practice.v1": JSON.stringify({ version: versions[7], ...s.ielts }) }; }
