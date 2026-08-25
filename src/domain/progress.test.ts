import { describe, expect, it } from "vitest";

import { buildProgressSnapshot, type ProgressSourceData } from "@/domain/progress";
import type { StoredLesson } from "@/domain/lesson";
import type { ListeningAttempt, ShadowingEvent } from "@/domain/listening";
import type { ReviewEvent, ReviewItem } from "@/domain/review";
import type { PersonalErrorPattern, WritingSession } from "@/domain/writing";
import { enrollVocabularyPhrase, type VocabularyReviewEvent } from "@/domain/vocabulary-review";

const now = "2026-08-25T12:00:00.000Z";

function lesson(id: string, createdAt: string): StoredLesson {
  return {
    id, contentId: `content-${id}`, contentFingerprint: `sha256:content-${id}`, generationFingerprint: `sha256:lesson-${id}`,
    schemaVersion: "m2-schema-v1", learnerProfileVersion: "m2-profile-v1", lessonPromptVersion: "m2-prompt-v1", aiProvider: "gemini", model: "model", createdAt, lastAccessedAt: createdAt, sourceTruncated: false,
    lesson: { overview: "A concise lesson overview that meets the minimum length.", keyPhrases: Array.from({ length: 5 }, (_, index) => ({ phrase: `phrase ${index}`, meaningSimpleEnglish: "A simple English explanation for this useful phrase.", meaningTurkish: "Yararlı ifade açıklaması", articleContext: "This phrase appears in the authentic source.", exampleSentence: "This is an example sentence that uses the phrase naturally.", whyUseful: "It is useful for clear cybersecurity communication." })), difficultSentences: Array.from({ length: 3 }, (_, index) => ({ original: `This difficult sentence number ${index} comes from the authentic source text.`, simplifiedEnglish: "This is a simpler explanation of the source sentence.", importantVocabulary: ["source"], languageNote: "It uses a clear subject and a verb." })), readingQuestions: Array.from({ length: 5 }, (_, index) => ({ id: `question-${index}`, type: "multiple_choice" as const, question: "Which answer is supported by the source material?", options: [{ id: "a", text: "Supported" }, { id: "b", text: "Not supported" }, { id: "c", text: "Other" }], correctOptionId: "a", explanation: "The source supports this answer directly.", skill: "specific_detail" as const })), speaking: { mainTask: "Explain the security issue to a colleague in clear English.", followUps: ["What happened in the incident?", "What should happen next?"], chatGptVoiceInstruction: "Ask one question at a time and help me communicate clearly about the technical topic." }, writing: { task: "Write 80 to 150 words about the security response and its effects.", minWords: 80, maxWords: 150 } },
  };
}

function writingSession(id: string, createdAt: string, revisionReviewedAt?: string): WritingSession {
  return {
    id, lessonId: `lesson-${id}`, contentId: `content-${id}`, contentFingerprint: `sha256:content-${id}`, task: "Write 80 to 150 words about the security response and its effects.", minWords: 80, maxWords: 150,
    firstDraft: "The organization should improve its security process after the incident.",
    initialFeedback: { stage: "initial", overallFeedback: "Focus on one article and one verb agreement issue in the next draft.", priorityErrors: [{ id: `${id}-issue-a`, patternKey: "grammar.article", category: "grammar", subcategory: "article", originalText: "a organization", correctedText: "an organization", explanation: "Use an before a vowel sound.", severity: "moderate", confidence: 0.9, memoryEligible: true }, { id: `${id}-issue-b`, patternKey: "grammar.subject_verb_agreement", category: "grammar", subcategory: "subject_verb_agreement", originalText: "systems is", correctedText: "systems are", explanation: "Plural systems takes are.", severity: "moderate", confidence: 0.8, memoryEligible: false }], vocabularySuggestions: [], technicalAccuracy: null, revisionFocus: ["Check articles before vowel sounds."] },
    revisedDraft: revisionReviewedAt ? "The organization should improve its security processes after the incident." : null,
    revisionFeedback: revisionReviewedAt ? { stage: "revision", improvements: ["The article use is improved."], resolvedErrorIds: [`${id}-issue-a`], remainingErrors: [{ initialErrorId: `${id}-issue-b`, explanation: "The agreement is still incorrect.", recommendedAction: "Use a plural verb." }], newErrors: [], improvedExample: "The organization should improve its security processes after the incident.", technicalAccuracy: null } : null,
    createdAt, updatedAt: "2026-08-25T11:00:00.000Z", ...(revisionReviewedAt ? { revisionReviewedAt } : {}),
  } as WritingSession;
}

function reviewEvent(id: string, reviewedAt: string, reviewKind: "scheduled" | "practice_now", verdict: "correct" | "incorrect" | "uncertain"): ReviewEvent {
  return { id, reviewItemId: "review-1", patternKey: "grammar.article", exerciseType: "correction", reviewKind, reviewedAt, verdict, stageBefore: 0, stageAfter: 1, dueAtBefore: "2026-08-24T10:00:00.000Z", dueAtAfter: "2026-08-28T10:00:00.000Z", providerUsed: false, providerId: null, providerModel: null, reviewSessionId: "session-1" };
}

function reviewItem(id: string, dueAt: string, status: "scheduled" | "mastered" = "scheduled"): ReviewItem {
  return { id, sourceType: "error_pattern", patternKey: `grammar.article.${id}`, category: "grammar", subcategory: "article", status, stage: 1, dueAt, createdAt: "2026-08-01T00:00:00.000Z", lastReviewedAt: null, successfulReviews: 1, failedReviews: 0, lapseCount: 0, representativeOccurrenceId: "occurrence-1", updatedAt: "2026-08-01T00:00:00.000Z" };
}

function attempt(id: string, attemptedAt: string, accuracy: number): ListeningAttempt {
  return { id, exerciseId: "exercise-1", attemptedAt, accuracy, matchedCount: 4, missingCount: 0, extraCount: 0, substitutionCount: 1, status: accuracy === 100 ? "correct" : accuracy >= 80 ? "nearly_there" : "try_again" };
}

function shadow(id: string, repeatedAt: string): ShadowingEvent {
  return { id, exerciseId: "exercise-1", repeatedAt };
}

function pattern(patternKey: string, status: PersonalErrorPattern["status"], occurrenceCount: number, priority: number, lastSeenAt = "2026-08-24T10:00:00.000Z"): PersonalErrorPattern {
  const [category, subcategory] = patternKey.split(".");
  return { patternKey, category: category as PersonalErrorPattern["category"], subcategory: subcategory as PersonalErrorPattern["subcategory"], occurrenceCount, successfulCorrections: 0, firstSeenAt: "2026-08-01T00:00:00.000Z", lastSeenAt, lastSeverity: "moderate", status, priority };
}

function data(overrides: Partial<ProgressSourceData> = {}): ProgressSourceData {
  return { lessons: [], writingSessions: [], errorPatterns: [], reviewItems: [], reviewEvents: [], vocabularyReviewItems: [], vocabularyReviewEvents: [], vocabularyPhraseIds: [], listeningAttempts: [], shadowingEvents: [], ...overrides };
}

describe("M8 progress aggregation", () => {
  it("uses local calendar days, deduplicates active days, and excludes future activity", () => {
    const snapshot = buildProgressSnapshot(data({
      lessons: [lesson("one", "2026-08-19T23:30:00.000Z"), lesson("future", "2026-08-26T00:00:00.000Z")],
      reviewEvents: [reviewEvent("review", "2026-08-20T00:30:00.000Z", "scheduled", "correct")],
      listeningAttempts: [attempt("attempt", "2026-08-20T01:00:00.000Z", 80)],
    }), { range: "7d", now, timeZone: "America/New_York" });

    expect(snapshot.activity).toMatchObject({ activeDays: 1, lessonsCreated: 1, reviewAttempts: 1, dictationsCompleted: 1 });
    expect(snapshot.timeline).toHaveLength(7);
    expect(snapshot.timeline.find((day) => day.date === "2026-08-19")).toMatchObject({ lessons: 1, review: 1, listening: 1 });
  });

  it("uses createdAt for initial analyses and revisionReviewedAt for dated revisions", () => {
    const snapshot = buildProgressSnapshot(data({
      writingSessions: [writingSession("current", "2026-08-23T10:00:00.000Z", "2026-08-24T10:00:00.000Z"), writingSession("legacy", "2026-08-23T10:00:00.000Z")],
    }), { range: "7d", now, timeZone: "UTC" });

    expect(snapshot.writing).toMatchObject({ analyses: 2, revisions: 1, resolvedInRevisions: 1, remainingInRevisions: 1, resolutionRate: 0.5 });
  });

  it("keeps current Error Memory and review state independent of the selected range", () => {
    const source = data({
      errorPatterns: [pattern("grammar.article", "returned", 3, 56), pattern("grammar.passive_voice", "mastered", 1, 14)],
      reviewItems: [reviewItem("overdue", "2026-08-24T09:00:00.000Z"), reviewItem("today", "2026-08-25T08:00:00.000Z"), reviewItem("mastered", "2026-08-01T00:00:00.000Z", "mastered")],
    });

    const short = buildProgressSnapshot(source, { range: "7d", now, timeZone: "UTC" });
    const all = buildProgressSnapshot(source, { range: "all", now, timeZone: "UTC" });

    expect(short.errorMemory).toEqual(all.errorMemory);
    expect(short.review.current).toEqual(all.review.current);
    expect(short.review.current).toMatchObject({ dueNow: 2, overdue: 1, masteredItems: 1 });
  });

  it("separates scheduled and Practice Now events and omits uncertain reviews from success rate", () => {
    const snapshot = buildProgressSnapshot(data({
      reviewEvents: [reviewEvent("one", "2026-08-24T10:00:00.000Z", "scheduled", "correct"), reviewEvent("two", "2026-08-24T11:00:00.000Z", "practice_now", "incorrect"), reviewEvent("three", "2026-08-24T12:00:00.000Z", "scheduled", "uncertain")],
    }), { range: "7d", now, timeZone: "UTC" });

    expect(snapshot.review.events).toMatchObject({ attempts: 3, scheduled: 2, practiceNow: 1, correct: 1, incorrect: 1, uncertain: 1, successRate: 0.5 });
  });

  it("derives dictation evidence and only compares finite ranges with adequate samples", () => {
    const snapshot = buildProgressSnapshot(data({
      listeningAttempts: [attempt("a", "2026-08-24T10:00:00.000Z", 90), attempt("b", "2026-08-23T10:00:00.000Z", 80), attempt("c", "2026-08-22T10:00:00.000Z", 100), attempt("prior-a", "2026-08-17T10:00:00.000Z", 70), attempt("prior-b", "2026-08-16T10:00:00.000Z", 75), attempt("prior-c", "2026-08-15T10:00:00.000Z", 80)],
      shadowingEvents: [shadow("shadow", "2026-08-24T12:00:00.000Z")],
    }), { range: "7d", now, timeZone: "UTC" });

    expect(snapshot.listening).toMatchObject({ dictations: 3, averageAccuracy: 90, shadowingRepetitions: 1, trend: { kind: "higher", points: 15 } });
    expect(buildProgressSnapshot(data({ listeningAttempts: [attempt("one", "2026-08-24T10:00:00.000Z", 90)] }), { range: "all", now, timeZone: "UTC" }).listening.trend).toEqual({ kind: "unavailable" });
  });

  it("prioritizes current overdue work before returned patterns and range-scoped neglect", () => {
    const snapshot = buildProgressSnapshot(data({
      errorPatterns: [pattern("grammar.article", "returned", 3, 56)],
      reviewItems: [reviewItem("overdue", "2026-08-24T09:00:00.000Z")],
      lessons: [lesson("one", "2026-08-24T10:00:00.000Z")],
    }), { range: "7d", now, timeZone: "UTC" });

    expect(snapshot.focus.map((entry) => [entry.kind, entry.action])).toEqual([["overdue_review", "review"], ["returned_pattern", "review"], ["neglected_listening", "listening"]]);
  });

  it("keeps focus routing semantic rather than embedding application URLs", () => {
    const snapshot = buildProgressSnapshot(data({
      writingSessions: [writingSession("one", "2026-08-24T10:00:00.000Z"), writingSession("two", "2026-08-23T10:00:00.000Z")],
      lessons: [lesson("one", "2026-08-24T10:00:00.000Z")],
    }), { range: "7d", now, timeZone: "UTC" });

    expect(snapshot.focus).toEqual([{ kind: "neglected_listening", action: "listening", message: "You have not practiced listening in this period." }, { kind: "revision_follow_through", action: "library", message: "Try revising more of your analyzed writing instead of only reviewing feedback." }]);
    expect(snapshot.focus.every((entry) => !("href" in entry) && !("url" in entry))).toBe(true);
  });

  it("does not let invalid activity or current patterns create an active day", () => {
    const snapshot = buildProgressSnapshot(data({
      lessons: [{ ...lesson("invalid", "2026-08-20T10:00:00.000Z"), createdAt: "not-a-timestamp" } as StoredLesson],
      errorPatterns: [pattern("grammar.article", "needs_practice", 1, 20)],
    }), { range: "7d", now, timeZone: "UTC" });

    expect(snapshot.activity.activeDays).toBe(0);
    expect(snapshot.activity.lessonsCreated).toBe(0);
  });

  it("keeps all-time summaries complete while labelling a 30-day visual timeline", () => {
    const snapshot = buildProgressSnapshot(data({ lessons: [lesson("old", "2026-01-01T10:00:00.000Z")] }), { range: "all", now, timeZone: "UTC" });

    expect(snapshot.activity.lessonsCreated).toBe(1);
    expect(snapshot.timelineLabel).toBe("Recent 30-day activity");
    expect(snapshot.timeline).toHaveLength(30);
    expect(snapshot).not.toHaveProperty("overallScore");
  });

  it("keeps actionable overdue work ahead of generic zero-activity guidance", () => {
    const snapshot = buildProgressSnapshot(data({ reviewItems: [reviewItem("overdue", "2026-08-24T09:00:00.000Z")] }), { range: "7d", now, timeZone: "UTC" });

    expect(snapshot.activity.activeDays).toBe(0);
    expect(snapshot.focus.map((entry) => entry.kind)).toEqual(["overdue_review"]);
  });

  it("reports vocabulary separately from the M8 learning-balance dimensions and prioritizes its due work after error review", () => {
    const vocabularyItem = enrollVocabularyPhrase("phrase-1", "2026-08-23T12:00:00.000Z");
    const vocabularyEvent: VocabularyReviewEvent = { id: "vocab-1", phraseId: "phrase-1", reviewedAt: "2026-08-25T10:00:00.000Z", reviewKind: "scheduled", outcome: "correct", stageBefore: 0, stageAfter: 1, statusBefore: "learning", statusAfter: "learning", scheduleChanged: true };
    const snapshot = buildProgressSnapshot(data({ vocabularyReviewItems: [vocabularyItem], vocabularyReviewEvents: [vocabularyEvent], vocabularyPhraseIds: ["phrase-1"] }), { range: "7d", now, timeZone: "UTC" });

    expect(snapshot.vocabulary.current).toEqual({ enrolled: 1, dueNow: 1, overdue: 1, mastered: 0, returned: 0 });
    expect(snapshot.vocabulary.events).toMatchObject({ attempts: 1, scheduled: 1, practiceNow: 0, correct: 1, incorrect: 0 });
    expect(snapshot.balance).toEqual({ lessons: 0, writing: 0, review: 0, listening: 0 });
    expect(snapshot.focus.map((entry) => entry.kind)).toEqual(["overdue_vocabulary"]);
  });
});
