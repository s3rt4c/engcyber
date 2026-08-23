import { describe, expect, it } from "vitest";

import { defaultLearnerProfile } from "@/domain/learner-profile";
import type { Content } from "@/domain/models";
import { createGeminiProvider, geminiLessonJsonSchema, geminiProviderErrorMessage } from "@/server/ai/gemini";

const sourceText = [
  "Attackers used stolen credentials to access the network.",
  "The organisation introduced stronger authentication controls after the incident.",
  "The report explains how the breach affected several internal systems.",
  "Investigators recommended regular credential reviews, clearer incident communication, and tested recovery procedures to reduce the effect of similar attacks.",
].join("\n\n");

const content: Content = {
  id: "content-1", feedItemId: null, title: "Security report", canonicalUrl: null, publishedAt: null, author: null,
  primaryCategory: "cybersecurity_news", tags: [], contentType: "article", sanitizedText: sourceText, contentFingerprint: "sha256:content", sanitizationStatus: "sanitized",
};

function validLessonPayload() {
  return {
    overview: "The report explains how attackers used stolen credentials and why organisations need stronger controls.",
    keyPhrases: Array.from({ length: 5 }, (_, index) => ({ phrase: `technical phrase ${index + 1}`, meaningSimpleEnglish: "A useful group of words for explaining a security event clearly.", meaningTurkish: "Bir güvenlik olayını açıklamak için yararlı bir ifade.", articleContext: "Attackers used stolen credentials to access the network.", exampleSentence: "Teams can use this phrase when explaining an incident.", whyUseful: "It helps learners explain technical cause and effect clearly." })),
    difficultSentences: sourceText.split("\n\n").map((original) => ({ original, simplifiedEnglish: "This sentence explains an important security event in simpler English.", importantVocabulary: ["credentials", "authentication"], languageNote: "Notice the past tense and the cause-and-effect connection." })),
    readingQuestions: [
      { id: "q1", type: "multiple_choice", question: "What is the main idea?", options: [{ id: "a", text: "A security incident" }, { id: "b", text: "A holiday" }, { id: "c", text: "A recipe" }], correctOptionId: "a", explanation: "The article describes a security incident.", skill: "main_idea" },
      { id: "q2", type: "multiple_choice", question: "How did the attackers enter?", options: [{ id: "a", text: "Credentials" }, { id: "b", text: "A train" }, { id: "c", text: "A book" }], correctOptionId: "a", explanation: "The article says stolen credentials were used.", skill: "specific_detail" },
      { id: "q3", type: "true_false_not_given", question: "Stronger controls were introduced after the incident.", options: [{ id: "true", text: "True" }, { id: "false", text: "False" }, { id: "not_given", text: "Not Given" }], correctOptionId: "true", explanation: "The article says stronger authentication controls followed the incident.", skill: "true_false_not_given" },
      { id: "q4", type: "vocabulary_in_context", question: "What does credentials mean in this article?", options: [{ id: "a", text: "Login information" }, { id: "b", text: "Food" }, { id: "c", text: "Weather" }], correctOptionId: "a", explanation: "Credentials are login information.", skill: "vocabulary_in_context" },
      { id: "q5", type: "multiple_choice", question: "What was one effect of the breach?", options: [{ id: "a", text: "Internal systems were affected" }, { id: "b", text: "The weather changed" }, { id: "c", text: "A concert started" }], correctOptionId: "a", explanation: "The article names affected internal systems.", skill: "cause_effect" },
    ],
    speaking: { mainTask: "Explain the incident to a non-technical manager.", followUps: ["What should the organisation improve?", "Why are credentials valuable to attackers?"], chatGptVoiceInstruction: "Treat me as B1 aiming for IELTS 7. Ask one question at a time, correct important mistakes, and ask me to try again." },
    writing: { task: "Write 80 to 150 words explaining the cause and effect of this security incident.", minWords: 80, maxWords: 150 },
  };
}

describe("Gemini provider", () => {
  it("converts transient provider errors into a safe learner-facing message", () => {
    expect(geminiProviderErrorMessage(Object.assign(new Error("unavailable"), { status: 503 }))).toBe("Gemini is temporarily unavailable. Please try again.");
  });

  it("derives a Gemini-compatible structured-output schema from the canonical Zod schema", () => {
    expect(geminiLessonJsonSchema).toMatchObject({ type: "object" });
    expect(JSON.stringify(geminiLessonJsonSchema)).not.toContain('"const"');
  });

  it("uses the configured action model for a bounded explicit sentence action without tools", async () => {
    const requests: unknown[] = [];
    const provider = createGeminiProvider(
      { id: "gemini", apiKey: "test-gemini-key", actionModel: "gemini-action-model", lessonModel: "gemini-lesson-model" },
      { models: { generateContent: async (request: unknown) => { requests.push(request); return { text: "Simplified support." }; } } },
    );

    await expect(provider.runSentenceAction({ action: "simplify", selectedText: "The attackers exploited an exposed service.", surroundingContext: "The report describes the incident." })).resolves.toBe("Simplified support.");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: "gemini-action-model",
    });
    expect(requests[0]).toHaveProperty("config.thinkingConfig", { thinkingLevel: "LOW" });
    expect(requests[0]).toHaveProperty("config.maxOutputTokens", 512);
    expect(JSON.stringify(requests[0])).toContain("Return only the final learner-facing answer.");
    expect(requests[0]).not.toHaveProperty("config.tools");
    expect(requests[0]).not.toHaveProperty("config.toolConfig");
    expect(requests[0]).not.toHaveProperty("config.automaticFunctionCalling");
  });

  it("uses the configured lesson model and validates native structured JSON before returning a lesson", async () => {
    const requests: unknown[] = [];
    const provider = createGeminiProvider(
      { id: "gemini", apiKey: "test-gemini-key", actionModel: "gemini-action-model", lessonModel: "gemini-lesson-model" },
      { models: { generateContent: async (request: unknown) => { requests.push(request); return { text: JSON.stringify(validLessonPayload()), usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 } }; } } },
    );

    const result = await provider.generateLesson(content, defaultLearnerProfile);

    expect(result.model).toBe("gemini-lesson-model");
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 200, totalTokens: 300 });
    expect(result.draft.keyPhrases).toHaveLength(5);
    expect(requests[0]).toMatchObject({ model: "gemini-lesson-model", config: { responseMimeType: "application/json" } });
    expect(requests[0]).not.toHaveProperty("config.tools");
  });

  it("does not retry a structured-output validation failure", async () => {
    let calls = 0;
    const provider = createGeminiProvider(
      { id: "gemini", apiKey: "test-gemini-key", actionModel: "gemini-action-model", lessonModel: "gemini-lesson-model" },
      { models: { generateContent: async () => { calls += 1; return { text: '{"overview":"too short"}' }; } } },
    );

    await expect(provider.generateLesson(content, defaultLearnerProfile)).rejects.toThrow("did not pass validation");
    expect(calls).toBe(1);
  });
});
