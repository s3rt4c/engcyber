import { describe, expect, it } from "vitest";

import type { ReviewEvaluationInput } from "@/domain/review";
import { createGeminiProvider, reviewEvaluationJsonSchema } from "@/server/ai/gemini";
import { buildReviewEvaluationInstructions } from "@/server/ai/review-prompt";

const input: ReviewEvaluationInput = {
  patternKey: "grammar.subject_verb_agreement", category: "grammar", subcategory: "subject_verb_agreement", exerciseType: "free_production",
  learnerAnswer: "The security team monitors the server.",
};

describe("M4 provider-neutral review evaluation", () => {
  it("keeps the learner answer separate from a narrow target-pattern instruction", () => {
    const instructions = buildReviewEvaluationInstructions(input);
    expect(instructions).toContain("UNTRUSTED_LEARNER_ANSWER_BEGIN");
    expect(instructions).toContain("grammar.subject_verb_agreement");
    expect(instructions).toContain("Do not correct unrelated vocabulary, style, or ideas");
    expect(instructions).toContain("no tools, web search, URL context, code execution, or function calling");
  });

  it("uses the action model, validates structured output, and exposes no Gemini tools", async () => {
    const requests: unknown[] = [];
    const provider = createGeminiProvider(
      { id: "gemini", apiKey: "test-gemini-key", actionModel: "gemini-action-model", lessonModel: "gemini-lesson-model" },
      { models: { generateContent: async (request: unknown) => { requests.push(request); return { text: JSON.stringify({ verdict: "correct", feedback: "The singular subject security team correctly uses monitors.", demonstratesTargetPattern: true, optionalCorrection: null }) }; } } },
    );
    await expect(provider.evaluateReview(input)).resolves.toMatchObject({ verdict: "correct", demonstratesTargetPattern: true });
    expect(requests[0]).toMatchObject({ model: "gemini-action-model", config: { responseMimeType: "application/json" } });
    expect(requests[0]).not.toHaveProperty("config.tools");
    expect(JSON.stringify(reviewEvaluationJsonSchema)).toContain("demonstratesTargetPattern");
  });

  it("does not retry malformed structured evaluation output", async () => {
    let calls = 0;
    const provider = createGeminiProvider(
      { id: "gemini", apiKey: "test-gemini-key", actionModel: "gemini-action-model", lessonModel: "gemini-lesson-model" },
      { models: { generateContent: async () => { calls += 1; return { text: "not-json" }; } } },
    );
    await expect(provider.evaluateReview(input)).rejects.toThrow("could not be validated");
    expect(calls).toBe(1);
  });
});
