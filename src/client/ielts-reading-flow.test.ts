import { describe, expect, it } from "vitest";

import { openCachedOrGeneratedIeltsReading } from "@/client/ielts-reading-flow";

describe("IELTS Reading cache flow", () => {
  it("reopens a compatible local practice without calling generation", async () => {
    let generated = false;
    const practice = { id: "reading-1", generationFingerprint: "fingerprint", sourceId: "source", sourceFingerprint: "sha256:source", sourceTitle: "Source", sourceUrl: null, questions: [], answers: {}, completedAt: null, elapsedSeconds: null, createdAt: "2026-08-27T00:00:00.000Z", updatedAt: "2026-08-27T00:00:00.000Z" };
    const result = await openCachedOrGeneratedIeltsReading({ generationFingerprint: "fingerprint", store: { getReadingByFingerprint: async () => practice, saveReading: async () => true }, generate: async () => { generated = true; return practice; } });
    expect(result.cacheHit).toBe(true);
    expect(generated).toBe(false);
  });
});
