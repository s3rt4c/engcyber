import { describe, expect, it } from "vitest";

import { preserveRevisionTimestampOnDismissal, recordRevisionReview, submitWritingAnalysis, wordCountForWriting, writingTargetNotice } from "@/client/writing-flow";
import type { RevisionWritingFeedback, WritingSession } from "@/domain/writing";

const revisionFeedback: RevisionWritingFeedback = { stage: "revision", improvements: ["The article use is improved."], resolvedErrorIds: ["issue-1"], remainingErrors: [], newErrors: [], improvedExample: "The organization improved its response after the incident.", technicalAccuracy: null };
const existingSession = { id: "session-1", firstDraft: "The organization improve security after the incident.", revisedDraft: null, revisionFeedback: null, dismissedErrorIds: [], createdAt: "2026-08-20T10:00:00.000Z", updatedAt: "2026-08-20T10:00:00.000Z", revisionReviewedAt: "2026-08-22T10:00:00.000Z" } as unknown as WritingSession;

describe("M3 explicit writing-analysis flow", () => {
  it("counts and updates typing state without invoking an analysis request", () => {
    expect(wordCountForWriting("The learner writes a first sentence.")).toBe(6);
    expect(writingTargetNotice("One two three", 80, 150)).toContain("below");
  });

  it("rejects an unusable draft before invoking the configured fetcher", async () => {
    let requests = 0;
    const result = await submitWritingAnalysis(async () => { requests += 1; return new Response(); }, { draft: "Too short", payload: { stage: "initial" } });
    expect(result).toMatchObject({ ok: false });
    expect(requests).toBe(0);
  });

  it("uses one request only for an explicit valid analysis action", async () => {
    const calls: unknown[] = [];
    const result = await submitWritingAnalysis(async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ feedback: { stage: "initial" } }), { status: 200 });
    }, { draft: "The organization must patch the system because attackers used stolen credentials after the incident happened yesterday.", payload: { stage: "initial" } });
    expect(result).toMatchObject({ ok: true, data: { feedback: { stage: "initial" } } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: "/api/writing/analyze" });
  });

  it("records only an explicit successful revision review as revision timing", () => {
    const reviewed = recordRevisionReview(existingSession, "The organization improved security after the incident.", revisionFeedback, "2026-08-25T10:00:00.000Z");
    const dismissed = preserveRevisionTimestampOnDismissal(reviewed, "issue-2", "2026-08-25T11:00:00.000Z");

    expect(reviewed.revisionReviewedAt).toBe("2026-08-25T10:00:00.000Z");
    expect(dismissed.revisionReviewedAt).toBe("2026-08-25T10:00:00.000Z");
    expect(dismissed.updatedAt).toBe("2026-08-25T11:00:00.000Z");
  });
});
