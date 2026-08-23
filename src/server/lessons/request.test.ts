import { describe, expect, it } from "vitest";

import { contentFingerprintFor, createLessonIdentity, parseSanitizedLessonContent } from "@/server/lessons/request";

const content = {
  id: "content-1", feedItemId: null, title: "Security report", canonicalUrl: null, publishedAt: null, author: null,
  primaryCategory: "cybersecurity_news", tags: [], contentType: "article", sanitizedText: "Attackers used stolen credentials to access the network.\n\nThe organisation introduced stronger authentication controls after the incident.\n\nThe report explains how the breach affected several internal systems.", contentFingerprint: "", sanitizationStatus: "sanitized",
};

describe("lesson request boundary", () => {
  it("accepts only a sanitized content-shaped request and computes identity server-side", () => {
    const parsed = parseSanitizedLessonContent({ ...content, contentFingerprint: contentFingerprintFor(content.sanitizedText) });
    expect(parsed.sanitizationStatus).toBe("sanitized");
    expect(parseSanitizedLessonContent({ ...content, primaryCategory: "htb_tryhackme", contentFingerprint: contentFingerprintFor(content.sanitizedText) }).primaryCategory).toBe("htb_tryhackme");
    expect(createLessonIdentity(parsed, {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "key",
      GEMINI_LESSON_MODEL: "gemini-lesson-model",
    }).generationFingerprint).toMatch(/^sha256:/);
  });

  it("rejects raw or tampered client content before a lesson request", () => {
    expect(() => parseSanitizedLessonContent({ ...content, sanitizationStatus: "raw" })).toThrow("sanitized");
    expect(() => parseSanitizedLessonContent({ ...content, contentFingerprint: "sha256:tampered" })).toThrow("fingerprint");
    const markup = "<script>untrusted()</script> article text";
    expect(() => parseSanitizedLessonContent({ ...content, sanitizedText: markup, contentFingerprint: contentFingerprintFor(markup) })).toThrow("markup");
  });
});
