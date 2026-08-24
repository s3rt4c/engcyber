import { describe, expect, it } from "vitest";

import {
  buildListeningExercises,
  chunkForShadowing,
  createListeningSession,
  defaultListeningPlaybackRate,
  gradeDictation,
  isSupportedListeningPlaybackRate,
  listeningSessionAverageAccuracy,
  listeningPlaybackRates,
  recordDictationAttempt,
} from "@/domain/listening";
import type { StoredLesson } from "@/domain/lesson";

function lesson(overrides: Partial<StoredLesson["lesson"]> = {}): StoredLesson {
  return {
    id: "lesson-1", contentId: "content-1", contentFingerprint: "sha256:content", generationFingerprint: "sha256:lesson",
    schemaVersion: "m2-schema-v1", learnerProfileVersion: "m2-profile-v1", lessonPromptVersion: "m2-prompt-v1", aiProvider: "gemini", model: "configured-model",
    createdAt: "2026-08-25T00:00:00.000Z", lastAccessedAt: "2026-08-25T00:00:00.000Z", sourceTruncated: false,
    lesson: {
      overview: "A concise overview of a security incident and the controls that followed.",
      difficultSentences: [
        { original: "Attackers exploited the vulnerability before administrators applied the patch.", simplifiedEnglish: "Attackers used a weakness before the fix was installed.", importantVocabulary: ["vulnerability"], languageNote: "Notice the sequence marker before." },
        { original: "The vulnerability requires immediate remediation by the security team.", simplifiedEnglish: "The security team must fix the weakness now.", importantVocabulary: ["remediation"], languageNote: "Requires takes a third-person singular verb." },
        { original: "The organization enabled phishing-resistant MFA after the incident.", simplifiedEnglish: "The organization added stronger sign-in protection after the event.", importantVocabulary: ["enabled"], languageNote: "After introduces a completed event." },
      ],
      keyPhrases: [
        { phrase: "apply the patch", meaningSimpleEnglish: "Install a fix for software.", meaningTurkish: "Yamayı uygulamak.", articleContext: "Administrators applied the patch.", exampleSentence: "Administrators should apply the patch quickly after a critical alert.", whyUseful: "It is useful in security incident reports." },
        { phrase: "reduce the risk", meaningSimpleEnglish: "Make danger less likely.", meaningTurkish: "Riski azaltmak.", articleContext: "The control reduced the risk.", exampleSentence: "Multi-factor authentication can reduce the risk of account takeover.", whyUseful: "It is a common technical collocation." },
        { phrase: "source fallback", meaningSimpleEnglish: "Use remaining source material.", meaningTurkish: "Kaynak yedeği.", articleContext: "A fallback remains available.", exampleSentence: "https://example.test/not-a-listening-sentence", whyUseful: "This fixture exercises filtering." },
        { phrase: "code fixture", meaningSimpleEnglish: "A code-like example.", meaningTurkish: "Kod örneği.", articleContext: "The sample is code-like.", exampleSentence: "const token = await client.fetch();", whyUseful: "This fixture exercises filtering." },
        { phrase: "duplicate fixture", meaningSimpleEnglish: "A repeated sentence.", meaningTurkish: "Tekrarlanan cümle.", articleContext: "The sentence repeats an existing one.", exampleSentence: "The vulnerability requires immediate remediation by the security team.", whyUseful: "This fixture exercises deduplication." },
      ],
      readingQuestions: Array.from({ length: 5 }, (_, index) => ({ id: `q-${index}`, type: "multiple_choice" as const, question: "Which response is supported by the source?", options: [{ id: "a", text: "Supported" }, { id: "b", text: "Unsupported" }, { id: "c", text: "Other" }], correctOptionId: "a", explanation: "The source supports this answer.", skill: "specific_detail" as const })),
      speaking: { mainTask: "Explain the incident to a non-technical colleague.", followUps: ["What happened first?", "What should happen next?"], chatGptVoiceInstruction: "Treat me as B1 aiming for IELTS 7. Ask one question at a time and correct important mistakes." },
      writing: { task: "Write 80 to 150 words explaining the technical cause and effect of the incident.", minWords: 80, maxWords: 150 },
      ...overrides,
    },
  };
}

describe("M5 listening contracts", () => {
  it("selects up to five stable, deduplicated exercises with difficult sentences first", () => {
    const first = buildListeningExercises({ lesson: lesson(), sourceText: "Fallback source sentence remains available for listening practice.\n\nAnother fallback sentence is available if required.", createdAt: "2026-08-25T00:00:00.000Z" });
    const second = buildListeningExercises({ lesson: lesson(), sourceText: "Fallback source sentence remains available for listening practice.\n\nAnother fallback sentence is available if required.", createdAt: "2026-08-25T00:00:00.000Z" });
    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(first.slice(0, 3).map((exercise) => exercise.sourceType)).toEqual(["difficult_sentence", "difficult_sentence", "difficult_sentence"]);
    expect(new Set(first.map((exercise) => exercise.text.toLocaleLowerCase())).size).toBe(5);
  });

  it("uses good phrase examples when there are too few difficult sentences and does not force five", () => {
    const selected = buildListeningExercises({ lesson: lesson({ difficultSentences: [lesson().lesson.difficultSentences[0]], keyPhrases: [lesson().lesson.keyPhrases[0], lesson().lesson.keyPhrases[1]] }), createdAt: "2026-08-25T00:00:00.000Z" });
    expect(selected.map((exercise) => exercise.sourceType)).toEqual(["difficult_sentence", "phrase_example", "phrase_example"]);
    expect(selected).toHaveLength(3);
  });

  it("uses bounded source sentences only as the final fallback when they are already available", () => {
    const selected = buildListeningExercises({ lesson: lesson({ difficultSentences: [lesson().lesson.difficultSentences[0]], keyPhrases: [] }), sourceText: "The incident required an immediate response from the technical team.\n\nAdministrators applied the patch before attackers returned.", createdAt: "2026-08-25T00:00:00.000Z" });
    expect(selected.map((exercise) => exercise.sourceType)).toEqual(["difficult_sentence", "source_sentence", "source_sentence"]);
  });

  it("filters URL-like, code-like, and huge candidates while accepting useful boundary-length sentences", () => {
    const selected = buildListeningExercises({ lesson: lesson({ difficultSentences: [
      { ...lesson().lesson.difficultSentences[0], original: "Short but useful sentence now." },
      { ...lesson().lesson.difficultSentences[1], original: `A legitimate sentence ${"with useful context ".repeat(80)}ends here.` },
      { ...lesson().lesson.difficultSentences[2], original: "Visit https://example.test for the patch." },
    ], keyPhrases: [] }), createdAt: "2026-08-25T00:00:00.000Z" });
    expect(selected.map((exercise) => exercise.text)).toEqual(["Short but useful sentence now."]);
  });

  it("grades harmless case, Unicode, quote, and terminal punctuation variation as exact", () => {
    const result = gradeDictation("The organization’s patch requires immediate remediation.", "  the organization's patch requires immediate remediation! ");
    expect(result).toMatchObject({ accuracy: 100, status: "correct", matchedCount: 6, missingCount: 0, extraCount: 0, substitutionCount: 0, differences: [] });
  });

  it("reports deterministic substitutions, missing words, and extra words without broad fuzzy acceptance", () => {
    expect(gradeDictation("The vulnerability requires immediate remediation.", "The vulnerability require immediate remediation.")).toMatchObject({ accuracy: 80, status: "nearly_there", substitutionCount: 1, differences: [{ kind: "substitution", target: "requires", learner: "require" }] });
    expect(gradeDictation("The team applied the patch.", "The team applied patch.")).toMatchObject({ missingCount: 1, differences: [{ kind: "missing", target: "the", learner: null }] });
    expect(gradeDictation("The team applied the patch.", "The team quickly applied the patch.")).toMatchObject({ extraCount: 1, differences: [{ kind: "extra", target: null, learner: "quickly" }] });
    expect(gradeDictation("The team applied the patch.", "The team installed the patch.")).toMatchObject({ accuracy: 80, status: "nearly_there", substitutionCount: 1 });
  });

  it("uses the same stable alignment on every run and maps below-eighty accuracy to Try again", () => {
    const target = "The vulnerability requires immediate remediation.";
    const learner = "The issue require remediation.";
    expect(gradeDictation(target, learner)).toEqual(gradeDictation(target, learner));
    expect(gradeDictation(target, learner)).toMatchObject({ status: "try_again", accuracy: 40 });
    expect(gradeDictation(target, "The vulnerability require immediate remediation.").status).not.toBe("correct");
  });

  it("uses fixed rate policy and preserves text exactly when chunking shadowing practice", () => {
    expect(listeningPlaybackRates).toEqual([0.75, 0.9, 1, 1.15]);
    expect(defaultListeningPlaybackRate).toBe(1);
    expect(isSupportedListeningPlaybackRate(0.9)).toBe(true);
    expect(isSupportedListeningPlaybackRate(0.8)).toBe(false);
    const text = "Attackers exploited the vulnerability, before administrators applied the patch.";
    const chunks = chunkForShadowing(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.trim().split(/\s+/).length > 1)).toBe(true);
    expect(chunkForShadowing("The security team patched.")).toEqual(["The security team patched."]);
  });

  it("completes sessions from checked dictation and derives the exact average without retaining learner text", () => {
    const session = createListeningSession({ id: "session-1", lesson: lesson(), createdAt: "2026-08-25T00:00:00.000Z" });
    const scored = gradeDictation(session.exercises[0].text, session.exercises[0].text);
    const updated = recordDictationAttempt(session, { id: "attempt-1", exerciseId: session.exercises[0].id, attemptedAt: "2026-08-25T00:05:00.000Z", ...scored });
    expect(updated).toMatchObject({ completedExerciseIds: [session.exercises[0].id], gradedAttemptCount: 1, accuracyTotal: 100 });
    expect(JSON.stringify(updated)).not.toContain("learnerText");
  });

  it("creates distinct exercise identities when a learner explicitly starts a fresh session", () => {
    const first = createListeningSession({ id: "session-1", lesson: lesson(), createdAt: "2026-08-25T00:00:00.000Z" });
    const second = createListeningSession({ id: "session-2", lesson: lesson(), createdAt: "2026-08-25T00:00:00.000Z" });
    expect(first.exercises.map((exercise) => exercise.id)).not.toEqual(second.exercises.map((exercise) => exercise.id));
  });

  it("accumulates only checked local accuracy for the compact session summary", () => {
    const session = createListeningSession({ id: "session-1", lesson: lesson(), createdAt: "2026-08-25T00:00:00.000Z" });
    const first = recordDictationAttempt(session, { id: "first", exerciseId: session.exercises[0].id, attemptedAt: "2026-08-25T00:01:00.000Z", accuracy: 100, matchedCount: 8, missingCount: 0, extraCount: 0, substitutionCount: 0, status: "correct" });
    const second = recordDictationAttempt(first, { id: "second", exerciseId: session.exercises[1].id, attemptedAt: "2026-08-25T00:02:00.000Z", accuracy: 80, matchedCount: 4, missingCount: 0, extraCount: 0, substitutionCount: 1, status: "nearly_there" });
    expect(second).toMatchObject({ gradedAttemptCount: 2, accuracyTotal: 180, shadowingRepetitionCount: 0 });
    expect(listeningSessionAverageAccuracy(second)).toBe(90);
  });
});
