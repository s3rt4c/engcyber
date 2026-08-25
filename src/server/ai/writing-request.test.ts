import { describe, expect, it } from "vitest";

import { parseWritingAnalysisRequest } from "@/server/ai/writing-request";

const requestBase = { writingSessionId: "writing-1", stage: "initial" as const, task: "Write 80 to 150 words explaining the technical incident and its effect.", draft: "The organisation have a security problem because attackers uses stolen credentials to access the network yesterday.", errorMemory: [] };

describe("resumable writing request boundary", () => {
  it("accepts only validated bounded lesson context as the source for a resumed writing analysis", () => {
    const result = parseWritingAnalysisRequest({ ...requestBase, lessonContext: { version: "m9-lesson-context-v1", title: "Security report", sourceLabel: "CISA", canonicalUrl: "https://example.com/report", contentId: "content-1", contentFingerprint: "sha256:original-content", primaryCategory: "cybersecurity_news", contentType: "article", sourceText: "Title: Security report\n\nAttackers used stolen credentials to access the network.", sourceTruncated: false } });

    expect(result.content).toMatchObject({ id: "content-1", title: "Security report", sanitizedText: "Title: Security report\n\nAttackers used stolen credentials to access the network.", sanitizationStatus: "sanitized" });
    expect(result.source).toEqual({ text: "Title: Security report\n\nAttackers used stolen credentials to access the network.", sourceTruncated: false });
  });

  it("rejects a malformed stored context instead of treating browser storage as trusted content", () => {
    expect(() => parseWritingAnalysisRequest({ ...requestBase, lessonContext: { version: "m9-lesson-context-v1", title: "Report", canonicalUrl: "javascript:alert(1)", contentId: "content-1", contentFingerprint: "sha256:content", primaryCategory: "cybersecurity_news", contentType: "article", sourceText: "<script>alert(1)</script>", sourceTruncated: false } })).toThrow("validated saved lesson context");
  });
});
