import { describe, expect, it } from "vitest";

import { submitWritingAnalysis, wordCountForWriting, writingTargetNotice } from "@/client/writing-flow";

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
});
