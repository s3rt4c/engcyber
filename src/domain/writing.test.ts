import { describe, expect, it } from "vitest";

import {
  canonicalPatternKey,
  filterLearnerFacingErrors,
  rebuildErrorPatterns,
  validateInitialWritingFeedback,
  validateRevisionWritingFeedback,
  type ErrorOccurrence,
} from "@/domain/writing";

const source = "The report states that attackers used stolen credentials to access an internal system. The organization enabled phishing-resistant MFA after the incident.";
const draft = "The organization must to patch the system because attackers uses stolen credentials.";

function issue(overrides: Record<string, unknown> = {}) {
  return {
    category: "grammar",
    subcategory: "auxiliary_verb",
    originalText: "must to patch",
    correctedText: "must patch",
    explanation: "After must, use the base form of the verb.",
    severity: "major",
    confidence: 0.9,
    ...overrides,
  };
}

describe("M3 writing contracts", () => {
  it("derives a controlled canonical pattern key from the taxonomy", () => {
    expect(canonicalPatternKey("grammar", "article")).toBe("grammar.article");
    expect(() => canonicalPatternKey("grammar", "invented_pattern" as never)).toThrow("subcategory");
  });

  it("shows only useful-confidence errors and marks only high confidence as memory eligible", () => {
    const visible = filterLearnerFacingErrors([issue({ confidence: 0.85 }), issue({ confidence: 0.7 }), issue({ confidence: 0.64 })]);
    expect(visible).toHaveLength(2);
    expect(visible.map((entry) => entry.memoryEligible)).toEqual([true, false]);
  });

  it("rejects model taxonomy inventions and initial rewritten answers", () => {
    const invalidTaxonomy = validateInitialWritingFeedback({
      stage: "initial", overallFeedback: "Focus on a few important grammar changes before trying again.", priorityErrors: [issue({ subcategory: "made_up" })], vocabularySuggestions: [], technicalAccuracy: null, revisionFocus: ["Remove to after must."],
    }, { draft, source, issueId: () => "issue-1" });
    expect(invalidTaxonomy.success).toBe(false);

    const rewrittenAnswer = validateInitialWritingFeedback({
      stage: "initial", overallFeedback: "Focus on a few important grammar changes before trying again.", priorityErrors: [issue()], vocabularySuggestions: [], technicalAccuracy: null, revisionFocus: ["Remove to after must."], improvedExample: "A complete rewritten answer that must not be accepted.",
    }, { draft, source, issueId: () => "issue-1" });
    expect(rewrittenAnswer.success).toBe(false);
  });

  it("validates and canonicalizes grounded initial feedback", () => {
    const result = validateInitialWritingFeedback({
      stage: "initial", overallFeedback: "Your main idea is clear; correct the modal structure before revising.", priorityErrors: [issue()], vocabularySuggestions: [], technicalAccuracy: { note: "The credentials claim matches the article.", sourceEvidence: "attackers used stolen credentials" }, revisionFocus: ["Use a base verb after must."],
    }, { draft, source, issueId: () => "issue-1" });
    expect(result).toMatchObject({ success: true, data: { priorityErrors: [{ id: "issue-1", patternKey: "grammar.auxiliary_verb" }] } });
  });

  it("accepts source evidence that differs only by normal publisher punctuation", () => {
    const result = validateInitialWritingFeedback({
      stage: "initial", overallFeedback: "Your factual summary is grounded; revise the grammar before trying again.", priorityErrors: [], vocabularySuggestions: [], technicalAccuracy: { note: "The catalog detail is supported by the source.", sourceEvidence: "CISA's KEV Catalog" }, revisionFocus: ["Revise the main verb in your first sentence."],
    }, { draft: "The writer summarizes the report in a short response.", source: "CISA’s KEV Catalog requires evidence of exploitation.", issueId: () => "issue-1" });
    expect(result.success).toBe(true);
  });

  it("rejects genuinely unrelated technical source evidence", () => {
    const result = validateInitialWritingFeedback({
      stage: "initial", overallFeedback: "The technical claim needs to match the supplied source before you revise.", priorityErrors: [], vocabularySuggestions: [], technicalAccuracy: { note: "This claim is not supported by the article.", sourceEvidence: "The device was physically destroyed." }, revisionFocus: ["Keep factual claims within the supplied source."],
    }, { draft: "The writer summarizes the report in a short response.", source: "CISA’s KEV Catalog requires evidence of exploitation.", issueId: () => "issue-1" });
    expect(result).toMatchObject({ success: false, validationStage: "grounding" });
  });

  it("requires revision feedback to compare validated initial IDs", () => {
    const initial = validateInitialWritingFeedback({
      stage: "initial", overallFeedback: "Correct the modal structure and try again.", priorityErrors: [issue()], vocabularySuggestions: [], technicalAccuracy: null, revisionFocus: ["Use a base verb after must."],
    }, { draft, source, issueId: () => "issue-1" });
    if (!initial.success) throw initial.error;
    const revision = validateRevisionWritingFeedback({
      stage: "revision", improvements: ["You removed to after must."], resolvedErrorIds: ["issue-1"], remainingErrors: [], newErrors: [], improvedExample: "The organization must patch the system because attackers used stolen credentials.",
    }, { draft: "The organization must patch the system because attackers used stolen credentials.", source, initialFeedback: initial.data, issueId: () => "issue-2" });
    expect(revision).toMatchObject({ success: true, data: { resolvedErrorIds: ["issue-1"] } });
  });

  it("derives recurrence, correction, mastery, return, and priority without provider decisions", () => {
    const occurrences: ErrorOccurrence[] = [
      { id: "one", writingSessionId: "session-1", attemptNumber: 1, category: "grammar", subcategory: "article", patternKey: "grammar.article", originalText: "a organization", correctedText: "an organization", explanation: "Use an before a vowel sound.", severity: "major", confidence: 0.9, createdAt: "2026-08-01T00:00:00.000Z", dismissed: false, correctedAt: "2026-08-01T01:00:00.000Z" },
      { id: "two", writingSessionId: "session-2", attemptNumber: 1, category: "grammar", subcategory: "article", patternKey: "grammar.article", originalText: "a incident", correctedText: "an incident", explanation: "Use an before a vowel sound.", severity: "major", confidence: 0.9, createdAt: "2026-08-10T00:00:00.000Z", dismissed: false, correctedAt: "2026-08-10T01:00:00.000Z" },
      { id: "three", writingSessionId: "session-3", attemptNumber: 1, category: "grammar", subcategory: "article", patternKey: "grammar.article", originalText: "a attack", correctedText: "an attack", explanation: "Use an before a vowel sound.", severity: "major", confidence: 0.9, createdAt: "2026-08-20T00:00:00.000Z", dismissed: false, correctedAt: "2026-08-20T01:00:00.000Z" },
    ];
    const mastered = rebuildErrorPatterns(occurrences, [], "2026-08-21T00:00:00.000Z");
    expect(mastered[0]).toMatchObject({ status: "mastered", occurrenceCount: 3, successfulCorrections: 3 });

    const returned = rebuildErrorPatterns([...occurrences, { ...occurrences[2], id: "four", writingSessionId: "session-4", correctedAt: null, createdAt: "2026-08-22T00:00:00.000Z" }], mastered, "2026-08-23T00:00:00.000Z");
    expect(returned[0]).toMatchObject({ status: "returned" });
    expect(returned[0].priority).toBeGreaterThan(mastered[0].priority);
  });

  it("removes dismissed occurrences from derived pattern aggregates", () => {
    const [pattern] = rebuildErrorPatterns([{ id: "one", writingSessionId: "session-1", attemptNumber: 1, category: "vocabulary", subcategory: "collocation", patternKey: "vocabulary.collocation", originalText: "make a decision", correctedText: "reach a decision", explanation: "Reach is the usual collocation here.", severity: "moderate", confidence: 0.9, createdAt: "2026-08-20T00:00:00.000Z", dismissed: true, correctedAt: null }], [], "2026-08-21T00:00:00.000Z");
    expect(pattern).toBeUndefined();
  });
});
