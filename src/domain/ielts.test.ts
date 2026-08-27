import { describe, expect, it } from "vitest";

import { gradeIeltsReadingPractice, ieltsInitialWritingFeedbackSchema, ieltsReadingMinimumWords, validateIeltsInitialWritingFeedback, validateIeltsReadingDraft } from "@/domain/ielts";

const source = "Title: Test source\n\n" + Array.from({ length: 420 }, () => "Security teams document evidence before making a decision.").join(" ");

describe("M11 IELTS practice domain", () => {
  it("rejects a complete-looking reading set when a relevant source context is fabricated", () => {
    const questions = Array.from({ length: 6 }, (_, index) => index < 3
      ? { id: `mc-${index}`, type: "multiple_choice", question: "Which statement is supported by the source?", options: ["a", "b", "c", "d"].map((id) => ({ id, text: `Option ${id}` })), correctOptionId: "a", relevantSourceContext: index === 0 ? "Invented context." : "Security teams document evidence before making a decision.", explanation: "The source supports this statement." }
      : { id: `tfng-${index}`, type: "true_false_not_given", question: "The source makes this statement.", answer: "not_given", relevantSourceContext: "Security teams document evidence before making a decision.", explanation: "The required information is absent or insufficient." });
    expect(validateIeltsReadingDraft({ questions }, source).success).toBe(false);
  });

  it("grades saved answer IDs locally and reports only practice evidence", () => {
    const practice = validateIeltsReadingDraft({ questions: Array.from({ length: 6 }, (_, index) => index < 3
      ? { id: `mc-${index}`, type: "multiple_choice", question: "Which statement is supported by the source?", options: ["a", "b", "c", "d"].map((id) => ({ id, text: `Option ${id}` })), correctOptionId: "a", relevantSourceContext: "Security teams document evidence before making a decision.", explanation: "The source supports this statement." }
      : { id: `tfng-${index}`, type: "true_false_not_given", question: "The source makes this statement.", answer: "not_given", relevantSourceContext: "Security teams document evidence before making a decision.", explanation: "The required information is absent or insufficient." }) }, source);
    if (!practice.success) throw practice.error;
    expect(gradeIeltsReadingPractice(practice.data.questions, { "mc-0": "a", "mc-1": "b", "mc-2": "a", "tfng-3": "not_given", "tfng-4": "true", "tfng-5": "not_given" })).toEqual({ correct: 4, total: 6 });
  });

  it("keeps the named reading threshold at four hundred words", () => {
    expect(ieltsReadingMinimumWords).toBe(400);
  });

  it("rejects any initial Task 2 feedback that attempts to add a revision-only example", () => {
    const feedback = validateIeltsInitialWritingFeedback({ stage: "initial", criteria: { taskResponse: { strengths: ["A clear position"], developmentPoints: ["Develop it"], nextAction: "Add one example." }, coherenceAndCohesion: { strengths: ["Paragraphs are present"], developmentPoints: ["Link ideas"], nextAction: "Use a connector." }, lexicalResource: { strengths: ["Some topic words"], developmentPoints: ["Use precise phrases"], nextAction: "Replace one repeated word." }, grammaticalRangeAndAccuracy: { strengths: ["Simple clauses work"], developmentPoints: ["Correct agreement"], nextAction: "Check each subject and verb." } }, languageIssues: [], revisionPriorities: ["Develop the example."], wordCount: 1, improvedExample: "This is not allowed." }, { draft: "A short learner draft.", issueId: () => "issue-1", wordCount: 4 });
    expect(feedback.success).toBe(false);
  });

  it("does not expose scoring, technical accuracy, or revision examples in the initial feedback contract", () => {
    const contract = JSON.stringify(ieltsInitialWritingFeedbackSchema.shape);
    expect(contract).not.toContain("improvedExample");
    expect(contract).not.toContain("technical_accuracy");
    expect(contract).not.toMatch(/band|cefr|readiness|proficiency/iu);
  });
});
