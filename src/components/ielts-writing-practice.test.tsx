import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IeltsRevisionFeedback } from "@/components/ielts-writing-practice";
import type { IeltsRevisionWritingFeedback } from "@/domain/ielts";

const feedback: IeltsRevisionWritingFeedback = {
  stage: "revision",
  criteriaComparison: {
    taskResponse: "The position is clearer.",
    coherenceAndCohesion: "The connection is stronger.",
    lexicalResource: "Vocabulary is more precise.",
    grammaticalRangeAndAccuracy: "One agreement issue remains.",
  },
  resolvedIssueIds: ["issue-1"],
  remainingIssueIds: [],
  newLanguageIssues: [{ id: "issue-2", category: "grammar", subcategory: "subject_verb_agreement", patternKey: "grammar.subject_verb_agreement", memoryEligible: true, originalText: "People uses online services", correctedText: "People use online services", explanation: "The plural subject needs the base verb form.", severity: "moderate", confidence: 0.9 }],
  improvedExample: null,
  wordCount: 265,
};

describe("IELTS Task 2 revision feedback", () => {
  it("renders criterion comparisons and each new controlled language issue", () => {
    const html = renderToStaticMarkup(<IeltsRevisionFeedback feedback={feedback} dismissed={[]} onDismiss={() => undefined} />);
    expect(html).toContain("Task Response");
    expect(html).toContain("The position is clearer.");
    expect(html).toContain("New language issues");
    expect(html).toContain("People uses online services");
    expect(html).toContain("People use online services");
    expect(html).toContain("Not an error");
    const dismissed = renderToStaticMarkup(<IeltsRevisionFeedback feedback={feedback} dismissed={["issue-2"]} onDismiss={() => undefined} />);
    expect(dismissed).not.toContain("People uses online services");
  });
});
