import { describe, expect, it } from "vitest";

import { resolveAiRuntime } from "@/server/ai/runtime";

describe("active AI runtime", () => {
  it("selects the Gemini adapter for an explicit sentence action without consulting OpenAI", () => {
    const result = resolveAiRuntime(
      {
        AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "test-gemini-key",
        GEMINI_ACTION_MODEL: "gemini-action-model",
      },
      "sentence_action",
      {
        gemini: (configuration) => ({
          id: "gemini", actionModel: configuration.actionModel, lessonModel: configuration.lessonModel,
          runSentenceAction: async () => "support", generateLesson: async () => { throw new Error("not called"); }, analyzeWriting: async () => { throw new Error("not called"); }, evaluateReview: async () => { throw new Error("not called"); }, generateIeltsReading: async () => { throw new Error("not called"); }, analyzeIeltsWriting: async () => { throw new Error("not called"); },
        }),
        openai: () => { throw new Error("OpenAI must not be selected"); },
      },
    );

    expect(result.id).toBe("gemini");
    expect(result.actionModel).toBe("gemini-action-model");
  });
});
