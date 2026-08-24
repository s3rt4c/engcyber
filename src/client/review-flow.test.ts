import { describe, expect, it } from "vitest";

import { checkReviewAnswer } from "@/client/review-flow";
import type { ReviewItem } from "@/domain/review";
import type { ErrorOccurrence } from "@/domain/writing";

const item: ReviewItem = { id: "review-1", sourceType: "error_pattern", patternKey: "grammar.article", category: "grammar", subcategory: "article", status: "scheduled", stage: 0, dueAt: "2026-08-25T00:00:00.000Z", createdAt: "2026-08-24T00:00:00.000Z", lastReviewedAt: null, successfulReviews: 0, failedReviews: 0, lapseCount: 0, representativeOccurrenceId: "occurrence-1", updatedAt: "2026-08-24T00:00:00.000Z" };
const occurrence: ErrorOccurrence = { id: "occurrence-1", writingSessionId: "writing-1", attemptNumber: 1, category: "grammar", subcategory: "article", patternKey: "grammar.article", originalText: "a organization", correctedText: "an organization", explanation: "Use an before a vowel sound.", severity: "major", confidence: 0.9, createdAt: "2026-08-24T00:00:00.000Z", dismissed: false, correctedAt: null };

describe("M4 client review flow", () => {
  it("locally accepts a safely normalized historical correction without calling a provider", async () => {
    let calls = 0;
    const result = await checkReviewAnswer(async () => { calls += 1; throw new Error("must not call"); }, { item, occurrence, answer: "  An organization! " });
    expect(result).toMatchObject({ ok: true, evaluation: { verdict: "correct" }, provider: null });
    expect(calls).toBe(0);
  });

  it("uses the explicit evaluation endpoint for a plausible alternative correction", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const result = await checkReviewAnswer(async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ evaluation: { verdict: "correct", feedback: "The article use is correct in this alternative sentence.", demonstratesTargetPattern: true, optionalCorrection: null }, provider: { id: "gemini", model: "gemini-action-model" } }), { status: 200 });
    }, { item, occurrence, answer: "The organization reported the incident." });
    expect(result).toMatchObject({ ok: true, evaluation: { verdict: "correct" }, provider: { id: "gemini" } });
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("/api/review/evaluate");
  });

  it("surfaces an inconclusive provider result without inventing a schedule verdict", async () => {
    const result = await checkReviewAnswer(async () => new Response(JSON.stringify({ evaluation: { verdict: "uncertain", feedback: "There is not enough text to assess the target pattern reliably.", demonstratesTargetPattern: false, optionalCorrection: null }, provider: { id: "openai", model: "openai-action-model" } }), { status: 200 }), { item: { ...item, stage: 2 }, occurrence, answer: "Maybe." });
    expect(result).toMatchObject({ ok: true, evaluation: { verdict: "uncertain" } });
  });
});
