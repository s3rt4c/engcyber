import { describe, expect, it } from "vitest";

import {
  gradeIeltsListeningAnswers,
  ieltsListeningQuestionCount,
  normalizeIeltsListeningCompletionAnswer,
  validateIeltsListeningPracticeDefinition,
} from "@/domain/ielts-listening";
import { ieltsListeningPracticeBank } from "@/domain/ielts-listening-bank";

describe("M12 IELTS Listening domain", () => {
  it("ships exactly eight valid application-owned practices with two of every part style and six fixed questions", () => {
    expect(ieltsListeningPracticeBank).toHaveLength(8);
    expect(Object.fromEntries(["part1_conversation", "part2_monologue", "part3_discussion", "part4_lecture"].map((partStyle) => [partStyle, ieltsListeningPracticeBank.filter((practice) => practice.partStyle === partStyle).length]))).toEqual({ part1_conversation: 2, part2_monologue: 2, part3_discussion: 2, part4_lecture: 2 });
    for (const practice of ieltsListeningPracticeBank) {
      expect(validateIeltsListeningPracticeDefinition(practice).success).toBe(true);
      expect(practice.questions).toHaveLength(ieltsListeningQuestionCount);
      expect(practice.questions.filter((question) => question.type === "multiple_choice")).toHaveLength(3);
      expect(practice.questions.filter((question) => question.type === "completion")).toHaveLength(3);
      expect(practice.scriptTurns.map((turn) => turn.text).join(" ").split(/\s+/u).filter(Boolean).length, practice.id).toBeGreaterThanOrEqual(160);
    }
  });

  it("uses only explicit conservative completion variants and deterministic local grading", () => {
    const practice = ieltsListeningPracticeBank[0]!;
    const answers = Object.fromEntries(practice.questions.map((question) => [question.id, question.type === "multiple_choice" ? question.correctOptionId : question.acceptedAnswers[0]!]));
    const completion = practice.questions.find((question) => question.type === "completion")!;
    expect(normalizeIeltsListeningCompletionAnswer(`  ${completion.acceptedAnswers[0]}! `)).toBe(normalizeIeltsListeningCompletionAnswer(completion.acceptedAnswers[0]!));
    expect(gradeIeltsListeningAnswers(practice, answers)).toEqual({ correct: 6, total: 6 });
    expect(gradeIeltsListeningAnswers(practice, { ...answers, [completion.id]: "a related but unlisted synonym" })).toEqual({ correct: 5, total: 6 });
  });
});
