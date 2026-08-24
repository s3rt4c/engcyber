import { describe, expect, it, vi } from "vitest";

import { checkListeningDictation, createOrResumeListeningSession, findResumableListeningLesson, recordShadowingRepetition, transcriptAfterCheck } from "@/client/listening-flow";
import { createListeningSession } from "@/domain/listening";
import type { StoredLesson } from "@/domain/lesson";

function lesson(): StoredLesson {
  return {
    id: "lesson-1", contentId: "content-1", contentFingerprint: "sha256:content", generationFingerprint: "sha256:lesson", schemaVersion: "m2-schema-v1", learnerProfileVersion: "m2-profile-v1", lessonPromptVersion: "m2-prompt-v1", aiProvider: "gemini", model: "configured-model", createdAt: "2026-08-25T00:00:00.000Z", lastAccessedAt: "2026-08-25T00:00:00.000Z", sourceTruncated: false,
    lesson: {
      overview: "A concise overview for the listening-flow fixture.",
      difficultSentences: [{ original: "The organization enabled phishing-resistant MFA after the incident.", simplifiedEnglish: "The organization added stronger protection.", importantVocabulary: ["enabled"], languageNote: "This sentence names a completed action." }],
      keyPhrases: [{ phrase: "apply the patch", meaningSimpleEnglish: "Install the fix.", meaningTurkish: "Yamayı uygula.", articleContext: "Administrators applied the patch.", exampleSentence: "Administrators should apply the patch quickly after a critical alert.", whyUseful: "It is useful in incident reports." }, { phrase: "reduce the risk", meaningSimpleEnglish: "Make danger less likely.", meaningTurkish: "Riski azalt.", articleContext: "The control reduced risk.", exampleSentence: "Multi-factor authentication can reduce the risk of account takeover.", whyUseful: "It is a common collocation." }, { phrase: "monitor access", meaningSimpleEnglish: "Watch sign-in activity.", meaningTurkish: "Erişimi izle.", articleContext: "The team monitored access.", exampleSentence: "Security teams should monitor access after a serious incident.", whyUseful: "It is useful technical English." }, { phrase: "report the issue", meaningSimpleEnglish: "Tell the responsible team.", meaningTurkish: "Sorunu bildir.", articleContext: "The issue was reported.", exampleSentence: "Staff should report the issue to the security team immediately.", whyUseful: "It supports clear communication." }, { phrase: "check the logs", meaningSimpleEnglish: "Inspect event records.", meaningTurkish: "Günlükleri kontrol et.", articleContext: "The team checked logs.", exampleSentence: "Analysts should check the logs before closing an incident.", whyUseful: "It is a common investigation phrase." }],
      readingQuestions: Array.from({ length: 5 }, (_, index) => ({ id: `q-${index}`, type: "multiple_choice" as const, question: "Which answer is supported by the source?", options: [{ id: "a", text: "Supported" }, { id: "b", text: "Unsupported" }, { id: "c", text: "Other" }], correctOptionId: "a", explanation: "The source supports this answer.", skill: "specific_detail" as const })),
      speaking: { mainTask: "Explain the security incident to a colleague.", followUps: ["What happened?", "What changed?"], chatGptVoiceInstruction: "Treat me as B1 aiming for IELTS 7. Ask one question at a time and correct important mistakes." },
      writing: { task: "Write 80 to 150 words about the security incident and the response.", minWords: 80, maxWords: 150 },
    },
  };
}

describe("M5 local listening flow", () => {
  it("resumes an unfinished session instead of flooding local storage, unless a fresh session is explicit", () => {
    const existing = createListeningSession({ id: "existing", lesson: lesson(), createdAt: "2026-08-25T00:00:00.000Z" });
    expect(createOrResumeListeningSession({ sessions: [existing], lesson: lesson(), now: "2026-08-25T01:00:00.000Z", createId: () => "new" })).toMatchObject({ resumed: true, session: { id: "existing" } });
    expect(createOrResumeListeningSession({ sessions: [existing], lesson: lesson(), now: "2026-08-25T01:00:00.000Z", createId: () => "new", fresh: true })).toMatchObject({ resumed: false, session: { id: "new" } });
  });

  it("finds a saved lesson for the most recently updated unfinished session after a reload", () => {
    const olderLesson = lesson();
    const newerLesson = { ...lesson(), id: "lesson-2", generationFingerprint: "sha256:newer" };
    const older = createListeningSession({ id: "older", lesson: olderLesson, createdAt: "2026-08-25T00:00:00.000Z" });
    const newer = { ...createListeningSession({ id: "newer", lesson: newerLesson, createdAt: "2026-08-25T02:00:00.000Z" }), updatedAt: "2026-08-25T02:00:00.000Z" };
    expect(findResumableListeningLesson({ sessions: [older, newer], lessons: [olderLesson, newerLesson] })?.generationFingerprint).toBe("sha256:newer");
  });

  it("keeps the transcript unavailable until explicit local checking, which does not call fetch", () => {
    const session = createListeningSession({ id: "session", lesson: lesson(), createdAt: "2026-08-25T00:00:00.000Z" });
    const exercise = session.exercises[0];
    const fetcher = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetcher as typeof fetch;
    try {
      expect(transcriptAfterCheck(exercise, false)).toBeNull();
      const checked = checkListeningDictation({ id: "attempt", exercise, learnerText: exercise.text, attemptedAt: "2026-08-25T00:01:00.000Z" });
      expect(checked.attempt).toMatchObject({ accuracy: 100, status: "correct" });
      expect(transcriptAfterCheck(exercise, true)).toBe(exercise.text);
      expect(fetcher).not.toHaveBeenCalled();
      expect(JSON.stringify(checked.attempt)).not.toContain(exercise.text);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("records shadowing only as local practice evidence without pronunciation correctness", () => {
    const session = createListeningSession({ id: "session", lesson: lesson(), createdAt: "2026-08-25T00:00:00.000Z" });
    const result = recordShadowingRepetition(session, { id: "shadow", exerciseId: session.exercises[0].id, repeatedAt: "2026-08-25T00:02:00.000Z" });
    expect(result.session.shadowingRepetitionCount).toBe(1);
    expect(result.event).toEqual({ id: "shadow", exerciseId: session.exercises[0].id, repeatedAt: "2026-08-25T00:02:00.000Z" });
    expect(JSON.stringify(result)).not.toContain("pronunciation");
  });
});
