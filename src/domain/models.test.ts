import { describe, expect, it } from "vitest";

import type { Content, Lesson } from "@/domain/models";

describe("M0 domain model", () => {
  it("allows manually supplied content without fabricating a feed item", () => {
    const content: Content = {
      id: "content-1",
      feedItemId: null,
      title: "My technical note",
      canonicalUrl: null,
      publishedAt: null,
      author: null,
      primaryCategory: "my_content",
      tags: [],
      contentType: "manual",
      sanitizedText: "Authentic English content.",
      contentFingerprint: "sha256:content-v1",
      sanitizationStatus: "sanitized",
    };

    expect(content.feedItemId).toBeNull();
  });

  it("gives a generated lesson a reusable cache identity", () => {
    const lesson: Lesson = {
      id: "lesson-1",
      contentId: "content-1",
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
      learnerLevel: "B1",
      generationFingerprint: "sha256:lesson-v1",
      status: "ready",
    };

    expect(lesson.generationFingerprint).toBe("sha256:lesson-v1");
  });
});
