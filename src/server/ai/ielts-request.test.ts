import { describe, expect, it } from "vitest";

import { parseIeltsReadingRequest, parseIeltsWritingRequest } from "@/server/ai/ielts-request";
import { contentFingerprintFor } from "@/server/lessons/request";

const source = Array.from({ length: 410 }, () => "Security teams document evidence before making a decision.").join(" ");
const content = { id: "content-1", feedItemId: null, title: "Security report", canonicalUrl: null, publishedAt: null, author: null, primaryCategory: "cybersecurity_news", tags: [], contentType: "article", sanitizedText: source, contentFingerprint: contentFingerprintFor(source), sanitizationStatus: "sanitized" };

describe("IELTS request boundaries", () => {
  it("rejects an ineligible Reading source before any provider can be resolved", () => {
    expect(() => parseIeltsReadingRequest({ content: { ...content, sanitizedText: "too short", contentFingerprint: contentFingerprintFor("too short") } })).toThrow("400 words");
  });

  it("accepts only an application-owned Task 2 prompt and explicit mode", () => {
    expect(parseIeltsWritingRequest({ stage: "initial", sessionId: "session-1", promptId: "technology-opinion", draft: "A learner draft with enough text.", errorMemory: [] }).prompt.id).toBe("technology-opinion");
    expect(() => parseIeltsWritingRequest({ stage: "initial", sessionId: "session-1", promptId: "provider-invented", draft: "A learner draft with enough text.", errorMemory: [] })).toThrow("application-owned");
  });
});
