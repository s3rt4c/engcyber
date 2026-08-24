import { describe, expect, it } from "vitest";

import { parseReviewEvaluationRequest } from "@/server/ai/review-request";

function request(overrides: Record<string, unknown> = {}) {
  return {
    item: { id: "review-1", sourceType: "error_pattern", patternKey: "grammar.article", category: "grammar", subcategory: "article", status: "scheduled", stage: 0, dueAt: "2026-08-25T00:00:00.000Z", createdAt: "2026-08-24T00:00:00.000Z", lastReviewedAt: null, successfulReviews: 0, failedReviews: 0, lapseCount: 0, representativeOccurrenceId: "occurrence-1", updatedAt: "2026-08-24T00:00:00.000Z" },
    occurrence: { id: "occurrence-1", writingSessionId: "writing-1", attemptNumber: 1, category: "grammar", subcategory: "article", patternKey: "grammar.article", originalText: "a organization", correctedText: "an organization", explanation: "Use an before a vowel sound.", severity: "major", confidence: 0.9, createdAt: "2026-08-24T00:00:00.000Z", dismissed: false, correctedAt: null },
    answer: "The organization reported the incident.",
    ...overrides,
  };
}

describe("review evaluation request boundary", () => {
  it("builds a narrow correction evaluation from a matching review item and occurrence", () => {
    expect(parseReviewEvaluationRequest(request())).toEqual({ patternKey: "grammar.article", category: "grammar", subcategory: "article", exerciseType: "correction", learnerAnswer: "The organization reported the incident.", originalText: "a organization", canonicalCorrection: "an organization" });
  });

  it("rejects a mismatched or dismissed historical occurrence", () => {
    expect(() => parseReviewEvaluationRequest(request({ occurrence: { ...request().occurrence as object, id: "other" } }))).toThrow("matching");
    expect(() => parseReviewEvaluationRequest(request({ occurrence: { ...request().occurrence as object, dismissed: true } }))).toThrow("eligible");
  });
});
