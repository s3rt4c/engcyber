import { describe, expect, it, vi } from "vitest";

import { buildDailyHub, buildLibrary, loadLocalLearningData, type LocalLearningData } from "@/client/local-learning-loaders";
import type { StoredLesson } from "@/domain/lesson";
import type { ListeningSession } from "@/domain/listening";
import type { WritingSession } from "@/domain/writing";
import { enrollVocabularyPhrase } from "@/domain/vocabulary-review";

function lesson(id: string, createdAt: string, context = true): StoredLesson {
  return {
    id, contentId: `content-${id}`, contentFingerprint: `sha256:content-${id}`, generationFingerprint: `sha256:lesson-${id}`, schemaVersion: "m2-schema-v1", learnerProfileVersion: "m2-profile-v1", lessonPromptVersion: "m2-prompt-v1", aiProvider: "gemini", model: "model", createdAt, lastAccessedAt: createdAt, sourceTruncated: false,
    ...(context ? { context: { version: "m9-lesson-context-v1" as const, title: `Lesson ${id}`, canonicalUrl: "https://example.com/source", contentId: `content-${id}`, contentFingerprint: `sha256:content-${id}`, primaryCategory: "cybersecurity_news" as const, contentType: "article" as const, sourceText: `Title: Lesson ${id}\n\nA bounded sanitized source sentence.`, sourceTruncated: false } } : {}),
    lesson: { overview: "A concise lesson overview that meets the minimum length.", keyPhrases: Array.from({ length: 5 }, (_, index) => ({ phrase: `phrase ${index}`, meaningSimpleEnglish: "A simple English explanation for this useful phrase.", meaningTurkish: "Yararlı ifade açıklaması", articleContext: "This phrase appears in the authentic source.", exampleSentence: "This is an example sentence that uses the phrase naturally.", whyUseful: "It is useful for clear cybersecurity communication." })), difficultSentences: Array.from({ length: 3 }, (_, index) => ({ original: `This difficult sentence number ${index} comes from the authentic source text.`, simplifiedEnglish: "This is a simpler explanation of the source sentence.", importantVocabulary: ["source"], languageNote: "It uses a clear subject and a verb." })), readingQuestions: Array.from({ length: 5 }, (_, index) => ({ id: `question-${index}`, type: "multiple_choice" as const, question: "Which answer is supported by the source material?", options: [{ id: "a", text: "Supported" }, { id: "b", text: "Not supported" }, { id: "c", text: "Other" }], correctOptionId: "a", explanation: "The source supports this answer directly.", skill: "specific_detail" as const })), speaking: { mainTask: "Explain the security issue to a colleague in clear English.", followUps: ["What happened in the incident?", "What should happen next?"], chatGptVoiceInstruction: "Ask one question at a time and help me communicate clearly about the technical topic." }, writing: { task: "Write 80 to 150 words about the security response and its effects.", minWords: 80, maxWords: 150 } },
  };
}

function writingSession(lessonId: string, revision = false): WritingSession {
  return { id: "writing-1", lessonId, contentId: "content-one", contentFingerprint: "sha256:content-one", task: "Write 80 to 150 words about the security response and its effects.", minWords: 80, maxWords: 150, firstDraft: "The organisation should improve its security process after the incident.", initialFeedback: { stage: "initial", overallFeedback: "Focus on one article and one verb agreement issue in the next draft.", priorityErrors: [], vocabularySuggestions: [], technicalAccuracy: null, revisionFocus: ["Check articles before vowel sounds."] }, revisedDraft: revision ? "The organisation should improve its security processes after the incident." : null, revisionFeedback: revision ? { stage: "revision", improvements: ["The article use is improved."], resolvedErrorIds: [], remainingErrors: [], newErrors: [], improvedExample: null, technicalAccuracy: null } : null, createdAt: "2026-08-24T10:00:00.000Z", updatedAt: "2026-08-24T11:00:00.000Z" };
}

function listening(lessonFingerprint: string, completedAt: string | null): ListeningSession {
  return { id: "listening-1", lessonId: "active", lessonGenerationFingerprint: lessonFingerprint, exercises: [{ id: "exercise-1", lessonId: "active", sourceType: "difficult_sentence", sourceReference: "sentence-1", text: "A long enough sentence for a valid listening exercise.", createdAt: "2026-08-24T09:00:00.000Z" }], completedExerciseIds: [], gradedAttemptCount: 0, accuracyTotal: 0, shadowingRepetitionCount: 0, createdAt: "2026-08-24T09:00:00.000Z", updatedAt: "2026-08-24T12:00:00.000Z", completedAt };
}

function data(overrides: Partial<LocalLearningData> = {}): LocalLearningData {
  return { lessons: [], phrases: [], writingSessions: [], errorPatterns: [], reviewItems: [], reviewEvents: [], vocabularyReviewItems: [], vocabularyReviewEvents: [], listening: { sessions: [], attempts: [], shadowingEvents: [], playbackRate: 1 }, ...overrides };
}

describe("M9 local learning loaders", () => {
  it("lists recent lessons by createdAt, leaves legacy lessons available, and only derives truthful writing actions", () => {
    const library = buildLibrary(data({ lessons: [lesson("legacy", "2026-08-23T10:00:00.000Z", false), lesson("new", "2026-08-24T10:00:00.000Z")], writingSessions: [writingSession("new")] }));

    expect(library.lessons.map((item) => [item.lesson.id, item.title, item.writingAction?.label ?? null, item.contextAvailable])).toEqual([["new", "Lesson new", "Revise writing", true], ["legacy", "Saved lesson", null, false]]);
    expect(library.lessons.some((item) => item.label === "Unfinished lesson")).toBe(false);
  });

  it("selects only a genuinely unfinished listening session and maps semantic focus actions at the application edge", () => {
    const savedLesson = lesson("active", "2026-08-24T10:00:00.000Z");
    const hub = buildDailyHub(data({ lessons: [savedLesson], listening: { sessions: [listening(savedLesson.generationFingerprint, null)], attempts: [], shadowingEvents: [], playbackRate: 1 } }), { now: "2026-08-25T12:00:00.000Z", timeZone: "UTC" });

    expect(hub.continueItems).toEqual([{ kind: "listening", label: "Continue listening", href: `/listening?lesson=${encodeURIComponent(savedLesson.generationFingerprint)}` }]);
    expect(hub.focus.every((entry) => ["/review", "/vocabulary", "/listening", "/discover", "/library"].includes(entry.href))).toBe(true);
  });

  it("does not offer completed listening as continuation and does not mutate review data while assembling Home", () => {
    const savedLesson = lesson("done", "2026-08-24T10:00:00.000Z");
    const reviewSave = vi.fn();
    const hub = buildDailyHub(data({ lessons: [savedLesson], listening: { sessions: [listening(savedLesson.generationFingerprint, "2026-08-24T12:00:00.000Z")], attempts: [], shadowingEvents: [], playbackRate: 1 } }), { now: "2026-08-25T12:00:00.000Z", timeZone: "UTC" });

    expect(hub.continueItems).toEqual([]);
    expect(reviewSave).not.toHaveBeenCalled();
    expect(hub.review).toEqual({ dueNow: 0, overdue: 0 });
  });

  it("surfaces phrase review state from the separate vocabulary store without enrolling or mutating a phrase", () => {
    const savedPhrase = { id: "phrase-1", phrase: "carry out an assessment", context: "Teams must carry out an assessment.", sourceTitle: "Report", sourceUrl: null, contentId: "content-one", savedAt: "2026-08-24T10:00:00.000Z" };
    const library = buildLibrary(data({ phrases: [savedPhrase], vocabularyReviewItems: [enrollVocabularyPhrase(savedPhrase.id, "2026-08-24T10:00:00.000Z")] }));

    expect(library.phrases).toEqual([expect.objectContaining({ id: "phrase-1", reviewStatus: "learning", reviewDueAt: "2026-08-25T10:00:00.000Z" })]);
  });

  it("reads only local store contracts without invoking browser fetch or a ReviewStore mutation", async () => {
    const fetch = vi.fn(() => { throw new Error("Home and Library must not fetch"); });
    vi.stubGlobal("fetch", fetch);
    const reviewSave = vi.fn();
    const reviewReader = { snapshot: async () => ({ items: [], events: [] }), save: reviewSave };
    const empty = data();
    const loaded = await loadLocalLearningData({
      lessonStore: { list: async () => empty.lessons }, phraseStore: { list: async () => empty.phrases }, writingSessionStore: { list: async () => empty.writingSessions },
      errorMemoryStore: { snapshot: async () => ({ occurrences: [], patterns: [] }) }, reviewStore: reviewReader, vocabularyReviewStore: { snapshot: async () => ({ items: [], events: [] }) },
      listeningStore: { snapshot: async () => empty.listening },
    });

    expect(loaded).toMatchObject({ lessons: [], phrases: [], reviewItems: [] });
    expect(fetch).not.toHaveBeenCalled();
    expect(reviewSave).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
