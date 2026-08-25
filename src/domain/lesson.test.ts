import { describe, expect, it } from "vitest";

import { defaultLearnerProfile } from "@/domain/learner-profile";
import {
  buildLessonSource,
  createStoredLessonContext,
  gradeReadingQuestion,
  validateLessonDraft,
  type LessonDraft,
} from "@/domain/lesson";
import { createGenerationIdentity } from "@/server/lessons/identity";

const validDraft: LessonDraft = {
  overview: "The report explains how attackers used stolen credentials and why organisations need stronger controls.",
  keyPhrases: Array.from({ length: 5 }, (_, index) => ({
    phrase: `useful technical phrase ${index + 1}`,
    meaningSimpleEnglish: "A reusable English language chunk for explaining a technical event.",
    meaningTurkish: "Teknik bir olayı açıklamak için kullanılabilecek İngilizce ifade.",
    articleContext: "Attackers used stolen credentials to access the network.",
    exampleSentence: "Teams should use this phrase when they explain a security incident.",
    whyUseful: "It helps learners describe technical cause and effect clearly.",
  })),
  difficultSentences: [
    "Attackers used stolen credentials to access the network.",
    "The organisation introduced stronger authentication controls after the incident.",
    "The report explains how the breach affected several internal systems.",
  ].map((original) => ({
    original,
    simplifiedEnglish: "This sentence explains an important event in simpler English.",
    importantVocabulary: ["credentials", "authentication"],
    languageNote: "Notice the past-tense verb and the cause-and-effect connection.",
  })),
  readingQuestions: [
    { id: "q1", type: "multiple_choice", question: "What is the main idea?", options: [{ id: "a", text: "A security incident" }, { id: "b", text: "A holiday" }, { id: "c", text: "A recipe" }], correctOptionId: "a", explanation: "The source describes a security incident.", skill: "main_idea" },
    { id: "q2", type: "multiple_choice", question: "How did attackers enter?", options: [{ id: "a", text: "Credentials" }, { id: "b", text: "A train" }, { id: "c", text: "A book" }], correctOptionId: "a", explanation: "The source says stolen credentials were used.", skill: "specific_detail" },
    { id: "q3", type: "true_false_not_given", question: "The source suggests stronger controls were needed.", options: [{ id: "true", text: "True" }, { id: "false", text: "False" }, { id: "not_given", text: "Not Given" }], correctOptionId: "true", explanation: "Stronger authentication controls followed the incident.", skill: "true_false_not_given" },
    { id: "q4", type: "vocabulary_in_context", question: "What does credentials mean here?", options: [{ id: "a", text: "Login information" }, { id: "b", text: "Food" }, { id: "c", text: "Weather" }], correctOptionId: "a", explanation: "Credentials are login information.", skill: "vocabulary_in_context" },
    { id: "q5", type: "multiple_choice", question: "What was one effect?", options: [{ id: "a", text: "Internal systems were affected" }, { id: "b", text: "The weather changed" }, { id: "c", text: "A concert started" }], correctOptionId: "a", explanation: "The source names internal systems as affected.", skill: "cause_effect" },
  ],
  speaking: {
    mainTask: "Explain the incident to a non-technical manager.",
    followUps: ["What should the organisation improve?", "Why are credentials valuable to attackers?"],
    chatGptVoiceInstruction: "Treat me as B1 aiming for IELTS 7. Ask one question at a time, correct only important mistakes, and ask me to try again.",
  },
  writing: { task: "Write 80 to 150 words explaining the cause and effect of this security incident.", minWords: 80, maxWords: 150 },
};

const sourceText = [
  "Attackers used stolen credentials to access the network.",
  "The organisation introduced stronger authentication controls after the incident.",
  "The report explains how the breach affected several internal systems.",
].join("\n\n");

describe("M2 lesson contracts", () => {
  it("creates a stable generation identity and invalidates it when a relevant input changes", () => {
    const base = createGenerationIdentity({ contentFingerprint: "sha256:content", learnerProfile: defaultLearnerProfile, aiProvider: "gemini", lessonModel: "configured-model" });
    expect(createGenerationIdentity({ contentFingerprint: "sha256:content", learnerProfile: defaultLearnerProfile, aiProvider: "gemini", lessonModel: "configured-model" })).toEqual(base);
    expect(createGenerationIdentity({ contentFingerprint: "sha256:changed", learnerProfile: defaultLearnerProfile, aiProvider: "gemini", lessonModel: "configured-model" }).generationFingerprint).not.toBe(base.generationFingerprint);
    expect(createGenerationIdentity({ contentFingerprint: "sha256:content", learnerProfile: defaultLearnerProfile, aiProvider: "gemini", lessonModel: "other-model" }).generationFingerprint).not.toBe(base.generationFingerprint);
    expect(createGenerationIdentity({ contentFingerprint: "sha256:content", learnerProfile: defaultLearnerProfile, aiProvider: "openai", lessonModel: "configured-model" }).generationFingerprint).not.toBe(base.generationFingerprint);
  });

  it("bounds oversized source deterministically at paragraph boundaries", () => {
    const paragraphs = Array.from({ length: 30 }, (_, index) => `Paragraph ${index}: ${"useful technical language ".repeat(50)}`);
    const first = buildLessonSource("Article title", paragraphs.join("\n\n"));
    const second = buildLessonSource("Article title", paragraphs.join("\n\n"));
    expect(first).toEqual(second);
    expect(first.sourceTruncated).toBe(true);
    expect(first.text.length).toBeLessThanOrEqual(12_000);
    expect(first.text).toContain("Paragraph 0:");
    expect(first.text).toContain("Paragraph 2:");
    expect(first.text).toContain("Paragraph 29:");
  });

  it("keeps an untrusted oversized title within the lesson source bound", () => {
    const source = buildLessonSource("T".repeat(13_000), sourceText);
    expect(source.text.length).toBeLessThanOrEqual(12_000);
  });

  it("retains exactly the canonical bounded lesson source as validated local context", () => {
    const context = createStoredLessonContext({ id: "content-1", title: "Article title", canonicalUrl: "https://example.com/report", primaryCategory: "cybersecurity_news", contentType: "article", sanitizedText: sourceText, contentFingerprint: "sha256:original" }, "CISA");

    expect(context.sourceText).toBe("Title: Article title\n\nAttackers used stolen credentials to access the network.\n\nThe organisation introduced stronger authentication controls after the incident.\n\nThe report explains how the breach affected several internal systems.");
    expect(context.sourceText.length).toBeLessThanOrEqual(12_000);
    expect(context.canonicalUrl).toBe("https://example.com/report");
    expect(context.sourceTruncated).toBe(false);
  });

  it("rejects malformed and ungrounded structured lessons while accepting grounded output", () => {
    expect(validateLessonDraft(validDraft, sourceText).success).toBe(true);
    expect(validateLessonDraft({ ...validDraft, keyPhrases: validDraft.keyPhrases.slice(0, 4) }, sourceText).success).toBe(false);
    expect(validateLessonDraft({ ...validDraft, difficultSentences: [{ ...validDraft.difficultSentences[0], original: "Invented original sentence." }, ...validDraft.difficultSentences.slice(1)] }, sourceText).success).toBe(false);
  });

  it("grades objective reading answers locally without an AI request", () => {
    expect(gradeReadingQuestion(validDraft.readingQuestions[0], "a")).toEqual({ correct: true, explanation: "The source describes a security incident." });
    expect(gradeReadingQuestion(validDraft.readingQuestions[0], "b")).toEqual({ correct: false, explanation: "The source describes a security incident." });
  });
});
