import { describe, expect, it } from "vitest";

import { resolveAiProvider } from "@/server/ai/provider";

describe("AI provider resolution", () => {
  it("selects Gemini without requiring any OpenAI configuration", () => {
    const provider = resolveAiProvider({
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_ACTION_MODEL: "gemini-action-model",
      GEMINI_LESSON_MODEL: "gemini-lesson-model",
    });

    expect(provider.id).toBe("gemini");
    expect(provider.actionModel).toBe("gemini-action-model");
    expect(provider.lessonModel).toBe("gemini-lesson-model");
  });

  it("rejects an unknown provider instead of silently selecting one", () => {
    expect(() => resolveAiProvider({ AI_PROVIDER: "unknown" })).toThrow("Unsupported AI_PROVIDER");
  });

  it("reports a missing action model without preventing the same provider's lesson configuration", () => {
    const environment = {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_LESSON_MODEL: "gemini-lesson-model",
    };

    expect(() => resolveAiProvider({
      ...environment,
    }, "sentence_action")).toThrow("Gemini sentence actions require GEMINI_ACTION_MODEL");
    expect(resolveAiProvider(environment, "lesson_generation").lessonModel).toBe("gemini-lesson-model");
  });
});
