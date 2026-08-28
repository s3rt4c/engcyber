import { describe, expect, it } from "vitest";

import { selectIeltsActivity, selectIeltsContinuations } from "@/domain/ielts-continuity";
import type { IeltsReadingPractice, IeltsWritingSession } from "@/domain/ielts";
import type { IeltsListeningSession } from "@/domain/ielts-listening";

const createdAt = "2026-08-20T09:00:00.000Z";

function reading(id: string, updatedAt: string, completedAt: string | null = null, answers: Record<string, string> = {}): IeltsReadingPractice {
  const questions = [...[0, 1, 2].map((index) => ({ id: `mc-${index}`, type: "multiple_choice" as const, question: "Which statement is supported by the source?", options: ["a", "b", "c", "d"].map((option) => ({ id: option, text: option })), correctOptionId: "a", relevantSourceContext: "The source supports this statement.", explanation: "The source states this." })), ...[3, 4, 5].map((index) => ({ id: `tfng-${index}`, type: "true_false_not_given" as const, question: "The source supports this statement.", answer: "not_given" as const, relevantSourceContext: "The source supports this statement.", explanation: "The information is absent." }))];
  return { id, generationFingerprint: `reading-${id}`, sourceId: "source", sourceFingerprint: "sha256:source", sourceTitle: "Source", sourceUrl: null, questions, answers, completedAt, elapsedSeconds: null, createdAt, updatedAt };
}

function writing(id: string, updatedAt: string, options: { draft?: string; initial?: string | null; revision?: string | null } = {}): IeltsWritingSession {
  const initialAt = options.initial ?? null;
  const revisionAt = options.revision ?? null;
  return {
    id,
    promptId: "technology-opinion",
    promptType: "opinion",
    draft: options.draft ?? "A saved Task 2 response with meaningful learner text.",
    revisedDraft: revisionAt ? "A reviewed revision with meaningful learner text." : null,
    initialFeedback: initialAt ? { stage: "initial", criteria: { taskResponse: { strengths: [], developmentPoints: [], nextAction: "Develop the main point." }, coherenceAndCohesion: { strengths: [], developmentPoints: [], nextAction: "Link the paragraphs." }, lexicalResource: { strengths: [], developmentPoints: [], nextAction: "Use precise vocabulary." }, grammaticalRangeAndAccuracy: { strengths: [], developmentPoints: [], nextAction: "Check agreement." } }, languageIssues: [], revisionPriorities: [], wordCount: 8 } : null,
    revisionFeedback: revisionAt ? { stage: "revision", criteriaComparison: { taskResponse: "More focused.", coherenceAndCohesion: "Clearer links.", lexicalResource: "More precise words.", grammaticalRangeAndAccuracy: "More accurate sentences." }, resolvedIssueIds: [], remainingIssueIds: [], newLanguageIssues: [], improvedExample: null, wordCount: 8 } : null,
    initialAnalyzedAt: initialAt,
    revisionReviewedAt: revisionAt,
    elapsedSeconds: null,
    createdAt,
    updatedAt,
  };
}

function listening(id: string, updatedAt: string, completedAt: string | null = null): IeltsListeningSession {
  return { id, practiceDefinitionId: "p1-library-card", answers: {}, playbackStartedAt: null, playbackCount: 0, correctCount: completedAt ? 5 : null, totalCount: completedAt ? 6 : null, createdAt, updatedAt, completedAt };
}

describe("IELTS continuity derivation", () => {
  it("derives only unfinished Reading, nonblank draft, revision, and Listening continuations in deterministic newest-first order", () => {
    const items = selectIeltsContinuations({
      reading: [reading("reading-complete", "2026-08-25T12:00:00.000Z", "2026-08-25T12:00:00.000Z"), reading("reading-partial", "2026-08-23T12:00:00.000Z", null, { "mc-0": "a" })],
      writing: [writing("draft", "2026-08-24T12:00:00.000Z"), writing("revision", "2026-08-26T12:00:00.000Z", { initial: "2026-08-24T10:00:00.000Z" }), writing("reviewed", "2026-08-27T12:00:00.000Z", { initial: "2026-08-24T10:00:00.000Z", revision: "2026-08-27T12:00:00.000Z" }), writing("blank", "2026-08-28T12:00:00.000Z", { draft: "  \n\t" })],
      listening: [listening("listening-open", "2026-08-25T12:00:00.000Z"), listening("listening-complete", "2026-08-28T12:00:00.000Z", "2026-08-28T12:00:00.000Z")],
    });

    expect(items).toEqual([
      { id: "ielts-writing:revision:revision", domain: "ielts_writing", title: "Revise Task 2", subtitle: "Initial feedback is ready", href: "/ielts/writing/revision", updatedAt: "2026-08-26T12:00:00.000Z", state: "revision" },
      { id: "ielts-listening:listening-open:unfinished", domain: "ielts_listening", title: "Continue Listening", subtitle: "Unfinished IELTS Listening practice", href: "/ielts/listening/listening-open", updatedAt: "2026-08-25T12:00:00.000Z", state: "unfinished_listening" },
      { id: "ielts-writing:draft:draft", domain: "ielts_writing", title: "Continue Task 2 draft", subtitle: "Saved Task 2 draft", href: "/ielts/writing/draft", updatedAt: "2026-08-24T12:00:00.000Z", state: "draft" },
      { id: "ielts-reading:reading-partial:unfinished", domain: "ielts_reading", title: "Continue Reading", subtitle: "Source", href: "/ielts/reading/reading-partial", updatedAt: "2026-08-23T12:00:00.000Z", state: "unfinished_reading" },
    ]);
  });

  it("uses stable ID ascending ties, caps continuations after ordering, and skips malformed ordering timestamps", () => {
    const items = selectIeltsContinuations({
      reading: [reading("b", "2026-08-25T12:00:00.000Z"), reading("a", "2026-08-25T12:00:00.000Z"), reading("broken", "not-a-date")],
      writing: [], listening: [listening("z", "2026-08-25T12:00:00.000Z"), listening("c", "2026-08-25T12:00:00.000Z")],
    }, 3);

    expect(items.map((item) => item.id)).toEqual(["ielts-listening:c:unfinished", "ielts-listening:z:unfinished", "ielts-reading:a:unfinished"]);
  });

  it("derives one completed event per accepted IELTS completion with durable IDs, concrete evidence, and ordered bounds", () => {
    const items = selectIeltsActivity({
      reading: [reading("reading-complete", "2026-08-24T12:00:00.000Z", "2026-08-24T12:00:00.000Z", { "mc-0": "a", "mc-1": "a", "tfng-3": "not_given" }), reading("reading-open", "2026-08-25T12:00:00.000Z")],
      writing: [writing("initial", "2026-08-25T12:00:00.000Z", { initial: "2026-08-25T12:00:00.000Z" }), writing("revision", "2026-08-26T12:00:00.000Z", { initial: "2026-08-25T12:00:00.000Z", revision: "2026-08-26T12:00:00.000Z" }), writing("draft-only", "2026-08-27T12:00:00.000Z")],
      listening: [listening("complete", "2026-08-27T12:00:00.000Z", "2026-08-27T12:00:00.000Z"), listening("playback-only", "2026-08-28T12:00:00.000Z")],
    }, 5);

    expect(items).toEqual([
      { id: "ielts-listening:complete:completed", kind: "listening_completed", occurredAt: "2026-08-27T12:00:00.000Z", title: "IELTS Listening completed", href: "/ielts/listening/complete", evidence: "5 / 6 correct" },
      { id: "ielts-writing:revision:revision", kind: "writing_revision_review", occurredAt: "2026-08-26T12:00:00.000Z", title: "Task 2 revision reviewed", href: "/ielts/writing/revision", evidence: "Revision reviewed" },
      { id: "ielts-writing:initial:initial", kind: "writing_initial_feedback", occurredAt: "2026-08-25T12:00:00.000Z", title: "Task 2 initial feedback completed", href: "/ielts/writing/initial", evidence: "Initial feedback completed" },
      { id: "ielts-writing:revision:initial", kind: "writing_initial_feedback", occurredAt: "2026-08-25T12:00:00.000Z", title: "Task 2 initial feedback completed", href: "/ielts/writing/revision", evidence: "Initial feedback completed" },
      { id: "ielts-reading:reading-complete:completed", kind: "reading_completed", occurredAt: "2026-08-24T12:00:00.000Z", title: "IELTS Reading completed", href: "/ielts/reading/reading-complete", evidence: "3 / 6 correct" },
    ]);
  });
});
