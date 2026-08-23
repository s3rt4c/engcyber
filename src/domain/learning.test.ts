import { describe, expect, it } from "vitest";

import {
  contentCategories,
  resolveProcessingMode,
  type ContentProcessingRequest,
} from "@/domain/learning";

describe("content discovery boundaries", () => {
  it("keeps discovered content metadata-only until the learner explicitly requests a lesson", () => {
    const discovered: ContentProcessingRequest = {
      kind: "discovered",
      contentId: "feed-item-42",
    };

    const requested: ContentProcessingRequest = {
      kind: "lesson_requested",
      contentId: "feed-item-42",
      requestedBy: "current_user",
    };

    expect(resolveProcessingMode(discovered)).toBe("metadata_only");
    expect(resolveProcessingMode(requested)).toBe("lesson_generation");
  });

  it("defines every M0 content category as a first-class value", () => {
    expect(contentCategories.map((category) => category.name)).toEqual([
      "Cybersecurity News",
      "Artificial Intelligence",
      "Active Directory / Internal Pentesting",
      "HTB & TryHackMe",
      "DFIR / Incident Reports",
      "Podcasts / Transcripts",
      "General IELTS",
      "My Content",
    ]);
  });
});
