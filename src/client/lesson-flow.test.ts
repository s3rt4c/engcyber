import { describe, expect, it } from "vitest";

import { openCachedOrGeneratedLesson } from "@/client/lesson-flow";

describe("lesson flow cache boundary", () => {
  it("uses a valid cache hit without invoking generation", async () => {
    let generated = 0;
    const cached = { generationFingerprint: "sha256:cached" };
    const result = await openCachedOrGeneratedLesson({
      generationFingerprint: "sha256:cached",
      store: { get: async () => cached, save: async () => true },
      generate: async () => { generated += 1; return { generationFingerprint: "sha256:new" }; },
    });
    expect(result).toEqual({ lesson: cached, cacheHit: true });
    expect(generated).toBe(0);
  });

  it("generates and saves only after a cache miss", async () => {
    let saved = 0;
    const generated = { generationFingerprint: "sha256:new" };
    const result = await openCachedOrGeneratedLesson({ generationFingerprint: "sha256:new", store: { get: async () => null, save: async () => { saved += 1; return true; } }, generate: async () => generated });
    expect(result).toEqual({ lesson: generated, cacheHit: false });
    expect(saved).toBe(1);
  });

  it("does not save a failed generation after a cache miss", async () => {
    let saved = 0;

    await expect(openCachedOrGeneratedLesson({
      generationFingerprint: "sha256:new",
      store: { get: async () => null, save: async () => { saved += 1; return true; } },
      generate: async () => { throw new Error("Gemini is temporarily unavailable. Please try again."); },
    })).rejects.toThrow("temporarily unavailable");

    expect(saved).toBe(0);
  });
});
