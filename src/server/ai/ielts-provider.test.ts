import { afterEach, describe, expect, it, vi } from "vitest";

const openAiCalls = vi.hoisted((): unknown[] => []);
const openAiResponses = vi.hoisted((): unknown[] => []);

vi.mock("openai", () => ({ default: class OpenAI {
  readonly responses = { parse: async (request: unknown) => {
    openAiCalls.push(request);
    return { output_parsed: openAiResponses.shift() };
  } };
} }));

import { ieltsTask2PromptBank, type IeltsInitialWritingFeedback, type IeltsWritingAnalysisInput } from "@/domain/ielts";
import { createGeminiProvider, type GeminiClient } from "@/server/ai/gemini";
import { analyzeOpenAiIeltsWriting } from "@/server/openai/ielts";

const criteria = {
  taskResponse: { strengths: ["A clear position"], developmentPoints: ["Develop the example"], nextAction: "Add one specific example." },
  coherenceAndCohesion: { strengths: ["Paragraphs are clear"], developmentPoints: ["Link the final idea"], nextAction: "Use one precise connector." },
  lexicalResource: { strengths: ["Relevant vocabulary appears"], developmentPoints: ["Avoid repeated words"], nextAction: "Replace one repeated phrase." },
  grammaticalRangeAndAccuracy: { strengths: ["Simple clauses are clear"], developmentPoints: ["Correct subject agreement"], nextAction: "Check every subject and verb." },
};
const rawIssue = { category: "grammar", subcategory: "subject_verb_agreement", originalText: "People uses online services", correctedText: "People use online services", explanation: "The plural subject needs the base verb form.", severity: "moderate", confidence: 0.9 } as const;
const initialFeedback: IeltsInitialWritingFeedback = { stage: "initial", criteria, languageIssues: [{ ...rawIssue, id: "initial-issue-1", patternKey: "grammar.subject_verb_agreement", memoryEligible: true }], revisionPriorities: ["Correct subject-verb agreement."], wordCount: 260 };

function input(stage: "initial" | "revision"): IeltsWritingAnalysisInput {
  return { stage, sessionId: "session-1", prompt: ieltsTask2PromptBank[0], draft: stage === "initial" ? "People uses online services because they are convenient." : "People uses online services because they are convenient and fast.", initialFeedback: stage === "revision" ? initialFeedback : undefined, errorMemory: [] };
}

function rawFeedback(stage: "initial" | "revision") {
  return stage === "initial"
    ? { stage, criteria, languageIssues: [rawIssue], revisionPriorities: ["Correct subject-verb agreement."], wordCount: 260 }
    : { stage, criteriaComparison: { taskResponse: "The position is clearer.", coherenceAndCohesion: "The connection is stronger.", lexicalResource: "Vocabulary is more precise.", grammaticalRangeAndAccuracy: "One agreement issue remains." }, resolvedIssueIds: [], remainingIssueIds: ["initial-issue-1"], newLanguageIssues: [rawIssue], improvedExample: null, wordCount: 265 };
}

function providerIssueSchema(call: unknown) {
  const request = call as { text?: { format?: { schema?: { properties?: { languageIssues?: { items?: { properties?: Record<string, unknown> } }; newLanguageIssues?: { items?: { properties?: Record<string, unknown> } } } } } } };
  const properties = request.text?.format?.schema?.properties;
  return properties?.languageIssues?.items?.properties ?? properties?.newLanguageIssues?.items?.properties;
}

describe("IELTS provider writing schemas", () => {
  afterEach(() => { openAiCalls.splice(0); openAiResponses.splice(0); });

  it.each(["initial", "revision"] as const)("asks OpenAI for raw %s issues before application canonicalization", async (stage) => {
    openAiResponses.push(rawFeedback(stage));
    const result = await analyzeOpenAiIeltsWriting(input(stage), { OPENAI_API_KEY: "test-key", OPENAI_LESSON_MODEL: "test-model" });
    if (result.feedback.stage === "initial") expect(result.feedback.languageIssues).toHaveLength(1);
    else expect(result.feedback.newLanguageIssues).toHaveLength(1);
    expect(providerIssueSchema(openAiCalls[0])).toEqual(expect.not.objectContaining({ id: expect.anything(), patternKey: expect.anything(), memoryEligible: expect.anything() }));
  });

  it.each(["initial", "revision"] as const)("asks Gemini for raw %s issues before application canonicalization", async (stage) => {
    const calls: unknown[] = [];
    const client: GeminiClient = { models: { generateContent: async (request) => { calls.push(request); return { text: JSON.stringify(rawFeedback(stage)) }; } } };
    const provider = createGeminiProvider({ id: "gemini", apiKey: "test-key", actionModel: "test-action", lessonModel: "test-model" }, client);
    const result = await provider.analyzeIeltsWriting(input(stage));
    if (result.feedback.stage === "initial") expect(result.feedback.languageIssues).toHaveLength(1);
    else expect(result.feedback.newLanguageIssues).toHaveLength(1);
    const request = calls[0] as { config?: { responseJsonSchema?: { properties?: { languageIssues?: { items?: { properties?: Record<string, unknown> } }; newLanguageIssues?: { items?: { properties?: Record<string, unknown> } } } } } };
    const properties = request.config?.responseJsonSchema?.properties;
    const issueProperties = properties?.languageIssues?.items?.properties ?? properties?.newLanguageIssues?.items?.properties;
    expect(issueProperties).toEqual(expect.not.objectContaining({ id: expect.anything(), patternKey: expect.anything(), memoryEligible: expect.anything() }));
  });
});
