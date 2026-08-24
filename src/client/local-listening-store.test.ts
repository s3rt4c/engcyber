import { describe, expect, it } from "vitest";

import { LocalListeningStore } from "@/client/local-listening-store";
import { createListeningSession, type ListeningAttempt, type ListeningSession, type ShadowingEvent } from "@/domain/listening";
import type { StoredLesson } from "@/domain/lesson";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function lesson(): StoredLesson {
  return {
    id: "lesson-1", contentId: "content-1", contentFingerprint: "sha256:content", generationFingerprint: "sha256:lesson", schemaVersion: "m2-schema-v1", learnerProfileVersion: "m2-profile-v1", lessonPromptVersion: "m2-prompt-v1", aiProvider: "gemini", model: "configured-model", createdAt: "2026-08-25T00:00:00.000Z", lastAccessedAt: "2026-08-25T00:00:00.000Z", sourceTruncated: false,
    lesson: {
      overview: "A concise overview for the listening-store fixture.",
      difficultSentences: [{ original: "The organization enabled phishing-resistant MFA after the incident.", simplifiedEnglish: "The organization added stronger protection.", importantVocabulary: ["enabled"], languageNote: "This sentence names a completed action." }],
      keyPhrases: [{ phrase: "apply the patch", meaningSimpleEnglish: "Install the fix.", meaningTurkish: "Yamayı uygula.", articleContext: "Administrators applied the patch.", exampleSentence: "Administrators should apply the patch quickly after a critical alert.", whyUseful: "It is useful in incident reports." }, { phrase: "reduce the risk", meaningSimpleEnglish: "Make danger less likely.", meaningTurkish: "Riski azalt.", articleContext: "The control reduced risk.", exampleSentence: "Multi-factor authentication can reduce the risk of account takeover.", whyUseful: "It is a common collocation." }, { phrase: "monitor access", meaningSimpleEnglish: "Watch sign-in activity.", meaningTurkish: "Erişimi izle.", articleContext: "The team monitored access.", exampleSentence: "Security teams should monitor access after a serious incident.", whyUseful: "It is useful technical English." }, { phrase: "report the issue", meaningSimpleEnglish: "Tell the responsible team.", meaningTurkish: "Sorunu bildir.", articleContext: "The issue was reported.", exampleSentence: "Staff should report the issue to the security team immediately.", whyUseful: "It supports clear communication." }, { phrase: "check the logs", meaningSimpleEnglish: "Inspect event records.", meaningTurkish: "Günlükleri kontrol et.", articleContext: "The team checked logs.", exampleSentence: "Analysts should check the logs before closing an incident.", whyUseful: "It is a common investigation phrase." }],
      readingQuestions: Array.from({ length: 5 }, (_, index) => ({ id: `q-${index}`, type: "multiple_choice" as const, question: "Which answer is supported by the source?", options: [{ id: "a", text: "Supported" }, { id: "b", text: "Unsupported" }, { id: "c", text: "Other" }], correctOptionId: "a", explanation: "The source supports this answer.", skill: "specific_detail" as const })),
      speaking: { mainTask: "Explain the security incident to a colleague.", followUps: ["What happened?", "What changed?"], chatGptVoiceInstruction: "Treat me as B1 aiming for IELTS 7. Ask one question at a time and correct important mistakes." },
      writing: { task: "Write 80 to 150 words about the security incident and the response.", minWords: 80, maxWords: 150 },
    },
  };
}

function session(id = "session-1", updatedAt = "2026-08-25T00:00:00.000Z"): ListeningSession {
  return { ...createListeningSession({ id, lesson: lesson(), createdAt: updatedAt }), updatedAt };
}

function attempt(id = "attempt-1", exerciseId = session().exercises[0].id): ListeningAttempt {
  return { id, exerciseId, attemptedAt: "2026-08-25T00:01:00.000Z", accuracy: 80, matchedCount: 4, missingCount: 0, extraCount: 0, substitutionCount: 1, status: "nearly_there" };
}

function shadow(id = "shadow-1", exerciseId = session().exercises[0].id): ShadowingEvent {
  return { id, exerciseId, repeatedAt: "2026-08-25T00:02:00.000Z" };
}

describe("M5 local listening persistence", () => {
  it("persists compact listening evidence and a validated playback preference without learner dictation", async () => {
    const storage = new MemoryStorage();
    const snapshot = { sessions: [session()], attempts: [attempt()], shadowingEvents: [shadow()], playbackRate: 0.9 as const };
    await expect(new LocalListeningStore(storage).save(snapshot)).resolves.toBe(true);
    await expect(new LocalListeningStore(storage).snapshot()).resolves.toEqual(snapshot);
    expect(storage.values.get("engcyber.listening.v1")).not.toContain("learnerText");
  });

  it("resets corrupt storage and falls back to the default rate", async () => {
    const storage = new MemoryStorage();
    storage.setItem("engcyber.listening.v1", "not-json");
    await expect(new LocalListeningStore(storage).snapshot()).resolves.toEqual({ sessions: [], attempts: [], shadowingEvents: [], playbackRate: 1 });
    expect(storage.values.has("engcyber.listening.v1")).toBe(false);
  });

  it("falls back from a corrupted persisted rate and rejects attempts that try to retain typed dictation", async () => {
    const storage = new MemoryStorage();
    storage.setItem("engcyber.listening.v1", JSON.stringify({ version: "m5-listening-v1", sessions: [], attempts: [], shadowingEvents: [], playbackRate: 0.8 }));
    await expect(new LocalListeningStore(storage).snapshot()).resolves.toMatchObject({ playbackRate: 1 });
    const unsafeAttempt = { ...attempt(), learnerText: "This must not be retained." };
    await expect(new LocalListeningStore(storage).save({ sessions: [session()], attempts: [unsafeAttempt] as ListeningAttempt[], shadowingEvents: [], playbackRate: 1 })).resolves.toBe(false);
  });

  it("keeps the twenty newest sessions and at most two hundred combined compact events", async () => {
    const storage = new MemoryStorage();
    const sessions = Array.from({ length: 21 }, (_, index) => session(`session-${index}`, `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`));
    const retainedExerciseId = sessions[20].exercises[0].id;
    const attempts = Array.from({ length: 201 }, (_, index) => attempt(`attempt-${index}`, retainedExerciseId));
    await expect(new LocalListeningStore(storage).save({ sessions, attempts, shadowingEvents: [shadow("shadow-final", retainedExerciseId)], playbackRate: 1 })).resolves.toBe(true);
    const snapshot = await new LocalListeningStore(storage).snapshot();
    expect(snapshot.sessions).toHaveLength(20);
    expect(snapshot.sessions.some((entry) => entry.id === "session-0")).toBe(false);
    expect(snapshot.attempts.length + snapshot.shadowingEvents.length).toBeLessThanOrEqual(200);
  });

  it("fails safely when browser storage is unavailable", async () => {
    const store = new LocalListeningStore(null);
    await expect(store.save({ sessions: [session()], attempts: [], shadowingEvents: [], playbackRate: 1 })).resolves.toBe(false);
    await expect(store.snapshot()).resolves.toEqual({ sessions: [], attempts: [], shadowingEvents: [], playbackRate: 1 });
  });
});
