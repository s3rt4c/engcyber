import { describe, expect, it } from "vitest";

import {
  applyReviewVerdict,
  buildReviewExercise,
  gradeLocalCorrection,
  queueReviewItems,
  synchronizeReviewItems,
  type ReviewItem,
} from "@/domain/review";
import type { ErrorOccurrence, PersonalErrorPattern } from "@/domain/writing";

const now = "2026-08-24T12:00:00.000Z";

function occurrence(id = "occurrence-1", dismissed = false): ErrorOccurrence {
  return {
    id, writingSessionId: "session-1", attemptNumber: 1, category: "grammar", subcategory: "auxiliary_verb", patternKey: "grammar.auxiliary_verb",
    originalText: "Teams must to patch systems.", correctedText: "Teams must patch systems.", explanation: "Use the base verb after must.", severity: "major", confidence: 0.9,
    createdAt: "2026-08-23T12:00:00.000Z", dismissed, correctedAt: null,
  };
}

function pattern(status: PersonalErrorPattern["status"] = "needs_practice", priority = 30): PersonalErrorPattern {
  return {
    patternKey: "grammar.auxiliary_verb", category: "grammar", subcategory: "auxiliary_verb", occurrenceCount: 1, successfulCorrections: 0,
    firstSeenAt: "2026-08-23T12:00:00.000Z", lastSeenAt: "2026-08-23T12:00:00.000Z", lastSeverity: "major", status, priority,
  };
}

function item(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: "review-1", sourceType: "error_pattern", patternKey: "grammar.auxiliary_verb", category: "grammar", subcategory: "auxiliary_verb", status: "scheduled", stage: 0,
    dueAt: "2026-08-24T12:00:00.000Z", createdAt: "2026-08-23T12:00:00.000Z", lastReviewedAt: null, successfulReviews: 0, failedReviews: 0, lapseCount: 0,
    representativeOccurrenceId: "occurrence-1", updatedAt: "2026-08-23T12:00:00.000Z", ...overrides,
  };
}

describe("M4 review scheduling", () => {
  it("creates one stage-zero review item due one day after a newly eligible pattern", () => {
    const result = synchronizeReviewItems([pattern()], [occurrence()], [], { now, createId: () => "review-1" });
    expect(result).toEqual([item({ dueAt: "2026-08-25T12:00:00.000Z", createdAt: now, updatedAt: now })]);
  });

  it("is idempotent and refreshes an invalid representative occurrence", () => {
    const first = synchronizeReviewItems([pattern()], [occurrence(), occurrence("occurrence-2")], [item({ representativeOccurrenceId: "missing" })], { now, createId: () => "new-id" });
    const second = synchronizeReviewItems([pattern()], [occurrence(), occurrence("occurrence-2")], first, { now, createId: () => "another-id" });
    expect(first).toHaveLength(1);
    expect(first[0].representativeOccurrenceId).toBe("occurrence-1");
    expect(second).toEqual(first);
  });

  it("refreshes item taxonomy from the application-controlled error pattern", () => {
    const result = synchronizeReviewItems([pattern()], [occurrence()], [item({ category: "vocabulary", subcategory: "collocation" })], { now, createId: () => "unused" });
    expect(result).toMatchObject([{ category: "grammar", subcategory: "auxiliary_verb" }]);
  });

  it("removes an item whose pattern has no eligible occurrence", () => {
    expect(synchronizeReviewItems([pattern()], [occurrence("occurrence-1", true)], [item()], { now, createId: () => "unused" })).toEqual([]);
  });

  it("reactivates a returned mastered pattern at stage zero one day later", () => {
    const result = synchronizeReviewItems([pattern("returned")], [occurrence()], [item({ status: "mastered", stage: 3, dueAt: "2026-08-01T12:00:00.000Z", lapseCount: 2 })], { now, createId: () => "unused" });
    expect(result[0]).toMatchObject({ status: "scheduled", stage: 0, dueAt: "2026-08-25T12:00:00.000Z", lapseCount: 3 });
  });

  it("removes an externally mastered pattern from the active review queue", () => {
    const result = synchronizeReviewItems([pattern("mastered")], [occurrence()], [item()], { now, createId: () => "unused" });
    expect(result).toMatchObject([{ status: "mastered", stage: 0 }]);
    expect(queueReviewItems(result, [pattern("mastered")], now)).toEqual([]);
  });

  it("advances only successful due reviews through the 3, 7, and 14 day intervals", () => {
    const stageOne = applyReviewVerdict(item(), "correct", "scheduled", now, "event-1", "session-1");
    expect(stageOne.item).toMatchObject({ stage: 1, dueAt: "2026-08-27T12:00:00.000Z", successfulReviews: 1 });
    const stageTwo = applyReviewVerdict(stageOne.item, "correct", "scheduled", "2026-08-27T12:00:00.000Z", "event-2", "session-2");
    expect(stageTwo.item).toMatchObject({ stage: 2, dueAt: "2026-09-03T12:00:00.000Z" });
    const stageThree = applyReviewVerdict(stageTwo.item, "correct", "scheduled", "2026-09-03T12:00:00.000Z", "event-3", "session-3");
    expect(stageThree.item).toMatchObject({ stage: 3, dueAt: "2026-09-17T12:00:00.000Z" });
  });

  it("masters only a successful final scheduled review performed when due", () => {
    const final = item({ stage: 3, dueAt: now, successfulReviews: 3 });
    const result = applyReviewVerdict(final, "correct", "scheduled", now, "event-4", "session-4");
    expect(result.item).toMatchObject({ status: "mastered", lastReviewedAt: now, successfulReviews: 4 });
    expect(result.masteredPatternKey).toBe("grammar.auxiliary_verb");
  });

  it("records early Practice Now success without moving stage or due date", () => {
    const future = item({ stage: 2, dueAt: "2026-08-31T12:00:00.000Z", successfulReviews: 2 });
    const result = applyReviewVerdict(future, "correct", "practice_now", now, "event-5", "session-5");
    expect(result.item).toEqual(future);
    expect(result.event).toMatchObject({ reviewKind: "practice_now", verdict: "correct", stageBefore: 2, stageAfter: 2, dueAtAfter: future.dueAt });
    expect(result.masteredPatternKey).toBeNull();
  });

  it("cannot master a stage through repeated same-day Practice Now successes", () => {
    const future = item({ stage: 3, dueAt: "2026-09-17T12:00:00.000Z", successfulReviews: 3 });
    const first = applyReviewVerdict(future, "correct", "practice_now", now, "event-practice-1", "session-1");
    const second = applyReviewVerdict(first.item, "correct", "practice_now", now, "event-practice-2", "session-1");
    const third = applyReviewVerdict(second.item, "correct", "practice_now", now, "event-practice-3", "session-1");
    expect(third.item).toEqual(future);
    expect([first, second, third].every((result) => result.masteredPatternKey === null)).toBe(true);
    expect([first, second, third].map((result) => result.event.reviewKind)).toEqual(["practice_now", "practice_now", "practice_now"]);
  });

  it("moves any incorrect answer back conservatively and schedules one day later", () => {
    const result = applyReviewVerdict(item({ stage: 2, dueAt: "2026-08-31T12:00:00.000Z", failedReviews: 1, lapseCount: 1 }), "incorrect", "practice_now", now, "event-6", "session-6");
    expect(result.item).toMatchObject({ stage: 1, dueAt: "2026-08-25T12:00:00.000Z", failedReviews: 2, lapseCount: 2 });
  });

  it("leaves uncertain verdict scheduling neutral while retaining an event", () => {
    const original = item({ stage: 1, dueAt: "2026-08-27T12:00:00.000Z" });
    const result = applyReviewVerdict(original, "uncertain", "scheduled", now, "event-7", "session-7");
    expect(result.item).toEqual(original);
    expect(result.event).toMatchObject({ verdict: "uncertain", stageBefore: 1, stageAfter: 1, dueAtAfter: original.dueAt });
  });

  it("uses due state, returned status, priority, due date, and pattern key for a five-item queue", () => {
    const due = item({ id: "a", dueAt: now });
    const returned = item({ id: "b", patternKey: "grammar.article", dueAt: now });
    const patterns = [pattern("needs_practice", 10), { ...pattern("returned", 5), patternKey: "grammar.article", subcategory: "article" as const }];
    const queue = queueReviewItems([due, returned], patterns, now);
    expect(queue.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("hides canonical corrections and grades only safely normalized exact correction answers locally", () => {
    const exercise = buildReviewExercise(item(), occurrence());
    expect(exercise).toMatchObject({ type: "correction", prompt: "Fix this sentence: Teams must to patch systems." });
    expect(JSON.stringify(exercise)).not.toContain("Teams must patch systems.");
    expect(gradeLocalCorrection("  teams must patch systems!  ", occurrence().correctedText)).toEqual({ verdict: "correct" });
    expect(gradeLocalCorrection("Teams must to patch systems.", occurrence().correctedText)).toEqual({ verdict: "needs_provider" });
  });
});
