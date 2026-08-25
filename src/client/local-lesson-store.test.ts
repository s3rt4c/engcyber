import { describe, expect, it } from "vitest";

import { LocalLessonStore, type StoredLesson } from "@/client/local-lesson-store";

function lesson(fingerprint = "sha256:lesson-1"): StoredLesson {
  const question = (id: string) => ({ id, type: "multiple_choice" as const, question: "Which answer is supported by the source?", options: [{ id: "a", text: "Supported" }, { id: "b", text: "Unsupported" }, { id: "c", text: "Other" }], correctOptionId: "a", explanation: "The source supports this answer.", skill: "specific_detail" as const });
  return {
    id: "lesson-1", contentId: "content-1", contentFingerprint: "sha256:content", generationFingerprint: fingerprint,
    schemaVersion: "m2-schema-v1", learnerProfileVersion: "m2-profile-v1", lessonPromptVersion: "m2-prompt-v1", aiProvider: "gemini", model: "configured-model",
    createdAt: "2026-08-24T00:00:00.000Z", lastAccessedAt: "2026-08-24T00:00:00.000Z", sourceTruncated: false,
    lesson: {
      overview: "This concise overview prepares the learner for the technical article.",
      keyPhrases: Array.from({ length: 5 }, (_, index) => ({ phrase: `technical phrase ${index}`, meaningSimpleEnglish: "A useful language chunk for a technical explanation.", meaningTurkish: "Teknik açıklama için yararlı ifade.", articleContext: "The article uses this useful phrase in context.", exampleSentence: "This example uses the phrase in a clear sentence.", whyUseful: "It transfers to other technical discussions." })),
      difficultSentences: Array.from({ length: 3 }, (_, index) => ({ original: `Original source sentence number ${index} is long enough.`, simplifiedEnglish: "A simpler explanation of this source sentence.", importantVocabulary: ["technical"], languageNote: "This note explains useful sentence structure." })),
      readingQuestions: [question("q1"), question("q2"), question("q3"), question("q4"), question("q5")],
      speaking: { mainTask: "Explain the technical issue to a non-technical manager.", followUps: ["Why does this matter?", "What should happen next?"], chatGptVoiceInstruction: "Treat me as B1 aiming for IELTS 7. Ask one question at a time, correct important mistakes, and ask me to try again." },
      writing: { task: "Write 80 to 150 words explaining the technical cause and effect from the article.", minWords: 80, maxWords: 150 },
    },
  };
}

describe("LocalLessonStore", () => {
  it("returns a valid cached lesson and updates its last access time", async () => {
    const values = new Map<string, string>();
    const store = new LocalLessonStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }, () => "2026-08-24T01:00:00.000Z");
    await store.save(lesson());
    const cached = await store.get("sha256:lesson-1");
    expect(cached?.generationFingerprint).toBe("sha256:lesson-1");
    expect(cached?.aiProvider).toBe("gemini");
    expect(cached?.lastAccessedAt).toBe("2026-08-24T01:00:00.000Z");
  });

  it("treats corrupted or incompatible browser data as a cache miss", async () => {
    const values = new Map<string, string>([["engcyber.lessons.v1", "not-json"]]);
    const store = new LocalLessonStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
    await expect(store.get("sha256:lesson-1")).resolves.toBeNull();
    expect(values.has("engcyber.lessons.v1")).toBe(false);
  });

  it("persists a valid bounded lesson context for cached resume", async () => {
    const values = new Map<string, string>();
    const store = new LocalLessonStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
    const context = { version: "m9-lesson-context-v1" as const, title: "Security report", sourceLabel: "CISA", canonicalUrl: "https://example.com/report", contentId: "content-1", contentFingerprint: "sha256:content", primaryCategory: "cybersecurity_news" as const, contentType: "article" as const, sourceText: "Title: Security report\n\nAttackers used stolen credentials to access the network.", sourceTruncated: false };

    await expect(store.save({ ...lesson(), context })).resolves.toBe(true);
    await expect(store.list()).resolves.toMatchObject([{ context }]);
  });

  it("rejects malformed persisted lesson context rather than trusting localStorage", async () => {
    const values = new Map<string, string>();
    values.set("engcyber.lessons.v1", JSON.stringify({ version: "m2-lesson-cache-v1", lessons: [{ ...lesson(), context: { version: "m9-lesson-context-v1", title: "Report", canonicalUrl: "javascript:alert(1)", contentId: "content-1", contentFingerprint: "sha256:content", primaryCategory: "cybersecurity_news", contentType: "article", sourceText: "<script>alert(1)</script>", sourceTruncated: false } }] }));
    const store = new LocalLessonStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });

    await expect(store.list()).resolves.toEqual([]);
    expect(values.has("engcyber.lessons.v1")).toBe(false);
  });

  it("keeps only the 20 most recently stored lessons", async () => {
    const values = new Map<string, string>();
    const store = new LocalLessonStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
    for (let index = 0; index < 21; index += 1) await store.save(lesson(`sha256:${index}`));
    await expect(store.get("sha256:0")).resolves.toBeNull();
    await expect(store.get("sha256:20")).resolves.not.toBeNull();
  });

  it("lists cached lessons by most recently accessed so local listening can choose one without generation", async () => {
    const values = new Map<string, string>();
    const store = new LocalLessonStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
    await store.save({ ...lesson("sha256:older"), lastAccessedAt: "2026-08-24T00:00:00.000Z" });
    await store.save({ ...lesson("sha256:newer"), lastAccessedAt: "2026-08-25T00:00:00.000Z" });
    await expect(store.list()).resolves.toMatchObject([{ generationFingerprint: "sha256:newer" }, { generationFingerprint: "sha256:older" }]);
  });
});
