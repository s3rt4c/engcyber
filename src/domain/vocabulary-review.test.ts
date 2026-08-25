import { describe, expect, it } from "vitest";

import {
  applyVocabularyReviewOutcome,
  buildVocabularyExercise,
  enrollVocabularyPhrase,
  gradeVocabularyAnswer,
  queueVocabularyReviewItems,
  vocabularyReviewCurrentState,
  type VocabularyReviewItem,
} from "@/domain/vocabulary-review";
import type { SavedPhrase } from "@/domain/boundaries";

const now = "2026-08-26T09:00:00.000Z";

function phrase(id = "phrase-1", overrides: Partial<SavedPhrase> = {}): SavedPhrase {
  return { id, phrase: "carry out an assessment", context: "Teams must carry out an assessment before deployment.", sourceTitle: "Security report", sourceUrl: "https://example.com/report", contentId: "content-1", savedAt: "2026-08-25T09:00:00.000Z", ...overrides };
}

function item(overrides: Partial<VocabularyReviewItem> = {}): VocabularyReviewItem {
  return { phraseId: "phrase-1", status: "learning", stage: 0, dueAt: now, createdAt: "2026-08-25T09:00:00.000Z", lastReviewedAt: null, successfulReviews: 0, failedReviews: 0, lapseCount: 0, updatedAt: "2026-08-25T09:00:00.000Z", ...overrides };
}

describe("M10 vocabulary review scheduling", () => {
  it("enrols an explicitly selected phrase at stage zero due one day later", () => {
    expect(enrollVocabularyPhrase("phrase-1", now)).toEqual(item({ dueAt: "2026-08-27T09:00:00.000Z", createdAt: now, updatedAt: now }));
  });

  it("reaches mastered long review after five successful due retrievals", () => {
    const one = applyVocabularyReviewOutcome(item(), "correct", now, "event-1");
    const two = applyVocabularyReviewOutcome(one.item, "correct", "2026-08-29T09:00:00.000Z", "event-2");
    const three = applyVocabularyReviewOutcome(two.item, "correct", "2026-09-05T09:00:00.000Z", "event-3");
    const four = applyVocabularyReviewOutcome(three.item, "correct", "2026-09-19T09:00:00.000Z", "event-4");
    const five = applyVocabularyReviewOutcome(four.item, "correct", "2026-10-19T09:00:00.000Z", "event-5");

    expect([one.item.stage, two.item.stage, three.item.stage, four.item.stage, five.item.stage]).toEqual([1, 2, 3, 4, 5]);
    expect(five.item).toMatchObject({ status: "mastered", dueAt: "2026-12-18T09:00:00.000Z", successfulReviews: 5 });
  });

  it("keeps a stage-five due success mastered and schedules another sixty-day review", () => {
    const result = applyVocabularyReviewOutcome(item({ status: "mastered", stage: 5, dueAt: now, successfulReviews: 5 }), "correct", now, "event-6");
    expect(result.item).toMatchObject({ status: "mastered", stage: 5, dueAt: "2026-10-25T09:00:00.000Z", successfulReviews: 6 });
  });

  it("moves a scheduled reviewing failure down one stage, due tomorrow, and records a lapse", () => {
    const result = applyVocabularyReviewOutcome(item({ status: "reviewing", stage: 3, dueAt: now }), "incorrect", now, "event-7");
    expect(result.item).toMatchObject({ status: "reviewing", stage: 2, dueAt: "2026-08-27T09:00:00.000Z", failedReviews: 1, lapseCount: 1 });
    expect(result.event).toMatchObject({ reviewKind: "scheduled", outcome: "incorrect", stageBefore: 3, stageAfter: 2, statusBefore: "reviewing", statusAfter: "reviewing" });
  });

  it("moves a mastered failure into returned recovery at stage two", () => {
    const result = applyVocabularyReviewOutcome(item({ status: "mastered", stage: 5, dueAt: now }), "incorrect", now, "event-8");
    expect(result.item).toMatchObject({ status: "returned", stage: 2, dueAt: "2026-08-27T09:00:00.000Z", failedReviews: 1, lapseCount: 1 });
  });

  it("preserves returned status through recovery stages until it reaches mastered again", () => {
    const one = applyVocabularyReviewOutcome(item({ status: "returned", stage: 2, dueAt: now }), "correct", now, "event-9");
    const two = applyVocabularyReviewOutcome(one.item, "correct", "2026-09-09T09:00:00.000Z", "event-10");
    const three = applyVocabularyReviewOutcome(two.item, "correct", "2026-10-09T09:00:00.000Z", "event-11");
    expect([one.item.status, two.item.status, three.item.status]).toEqual(["returned", "returned", "mastered"]);
  });

  it("records a non-due Practice Now success without moving schedule or recovery status", () => {
    const future = item({ status: "returned", stage: 3, dueAt: "2026-09-01T09:00:00.000Z" });
    const result = applyVocabularyReviewOutcome(future, "correct", now, "event-12");
    expect(result.item).toEqual(future);
    expect(result.event).toMatchObject({ reviewKind: "practice_now", outcome: "correct", stageBefore: 3, stageAfter: 3, statusBefore: "returned", statusAfter: "returned", scheduleChanged: false });
  });

  it("treats a non-due Practice Now failure as genuine forgetting", () => {
    const future = item({ status: "mastered", stage: 5, dueAt: "2026-09-01T09:00:00.000Z" });
    const result = applyVocabularyReviewOutcome(future, "incorrect", now, "event-13");
    expect(result.item).toMatchObject({ status: "returned", stage: 2, dueAt: "2026-08-27T09:00:00.000Z", failedReviews: 1, lapseCount: 1 });
    expect(result.event).toMatchObject({ reviewKind: "practice_now", scheduleChanged: true });
  });

  it("uses scheduled semantics whenever the item is due, regardless of entry point", () => {
    const result = applyVocabularyReviewOutcome(item({ dueAt: now }), "correct", now, "event-14");
    expect(result.event.reviewKind).toBe("scheduled");
    expect(result.item).toMatchObject({ stage: 1, dueAt: "2026-08-29T09:00:00.000Z" });
  });

  it("queues only due phrases, oldest first, with a stable phrase ID tie-breaker and maximum ten", () => {
    const items = Array.from({ length: 11 }, (_, index) => item({ phraseId: `phrase-${String(11 - index).padStart(2, "0")}`, dueAt: index < 2 ? "2026-08-25T09:00:00.000Z" : now }));
    const phrases = items.slice(0, 10).map((entry) => phrase(entry.phraseId));
    expect(queueVocabularyReviewItems(items, phrases, now).map((entry) => entry.phraseId)).toEqual(["phrase-10", "phrase-11", "phrase-02", "phrase-03", "phrase-04", "phrase-05", "phrase-06", "phrase-07", "phrase-08", "phrase-09"]);
  });

  it("derives due and overdue counts from existing phrase references without altering missing records", () => {
    const state = vocabularyReviewCurrentState([item({ phraseId: "phrase-1", dueAt: now }), item({ phraseId: "missing", status: "mastered", stage: 5, dueAt: "2026-08-20T09:00:00.000Z" })], [phrase("phrase-1")], now, "Europe/Istanbul");
    expect(state).toEqual({ enrolled: 1, dueNow: 1, overdue: 0, mastered: 0, returned: 0 });
  });

  it("uses authentic context for cloze and safely falls back when the saved phrase is absent", () => {
    expect(buildVocabularyExercise(phrase())).toEqual({ type: "context_cloze", prompt: "Complete the saved phrase in this authentic context.", context: "Teams must [____] before deployment." });
    expect(buildVocabularyExercise(phrase("phrase-2", { phrase: "publicly exposed", context: "The service was visible on the internet." }))).toEqual({ type: "source_recall", prompt: "Recall the saved phrase from Security report.", context: null });
  });

  it("grades only conservative canonical phrase matches", () => {
    expect(gradeVocabularyAnswer(" Carry out an assessment! ", "carry out an assessment")).toBe(true);
    expect(gradeVocabularyAnswer("conduct an assessment", "carry out an assessment")).toBe(false);
    expect(gradeVocabularyAnswer("public exposed", "publicly exposed")).toBe(false);
  });
});
