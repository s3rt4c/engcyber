import type { Page } from "@playwright/test";

export const learnerStorageKeys = [
  "engcyber.lessons.v1",
  "engcyber.saved-phrases.v1",
  "engcyber.writing-sessions.v1",
  "engcyber.error-memory.v1",
  "engcyber.review-items.v1",
  "engcyber.vocabulary-review.v1",
  "engcyber.listening.v1",
  "engcyber.ielts-practice.v1",
] as const;

export const unrelatedSentinel = "unrelated.test.sentinel";
export const unrelatedSentinelValue = "synthetic-sentinel-kept";

export type StorageSeed = Readonly<Record<string, string>>;

export async function seedStorage(page: Page, seed: StorageSeed): Promise<void> {
  await page.addInitScript((entries) => {
    if (window.sessionStorage.getItem("engcyber-e2e-seeded") === "1") return;
    window.localStorage.clear();
    for (const [key, value] of entries) window.localStorage.setItem(key, value);
    window.sessionStorage.setItem("engcyber-e2e-seeded", "1");
  }, Object.entries(seed));
}

function timestamp(offsetMilliseconds = 0): string {
  return new Date(Date.now() + offsetMilliseconds).toISOString();
}

function readingPractice(id: string, completedAt: string | null, updatedAt: string) {
  return {
    id,
    generationFingerprint: `synthetic-${id}`,
    sourceId: "synthetic-source",
    sourceFingerprint: "sha256:synthetic-source",
    sourceTitle: "Synthetic resilience report",
    sourceUrl: null,
    questions: [
      ...[1, 2, 3].map((index) => ({ id: `mc-${index}`, type: "multiple_choice", question: `Which synthetic control is confirmed by report ${index}?`, options: ["a", "b", "c", "d"].map((option) => ({ id: option, text: `${option.toUpperCase()} option ${index}` })), correctOptionId: "a", relevantSourceContext: "Synthetic evidence confirms the control.", explanation: "The synthetic source confirms this control." })),
      ...[1, 2, 3].map((index) => ({ id: `tfng-${index}`, type: "true_false_not_given", question: `Does synthetic statement ${index} match the report evidence?`, answer: "true", relevantSourceContext: "Synthetic evidence confirms the control.", explanation: "The synthetic source supports the statement." })),
    ],
    answers: completedAt ? { "mc-1": "a", "mc-2": "a", "mc-3": "a", "tfng-1": "true", "tfng-2": "true", "tfng-3": "true" } : {},
    completedAt,
    elapsedSeconds: null,
    createdAt: timestamp(-10_000),
    updatedAt,
  };
}

function criteria() {
  return {
    taskResponse: { strengths: ["Clear synthetic response."], developmentPoints: ["Develop one supporting detail."], nextAction: "Add a focused supporting detail." },
    coherenceAndCohesion: { strengths: ["Logical synthetic order."], developmentPoints: ["Strengthen paragraph links."], nextAction: "Use one explicit linking phrase." },
    lexicalResource: { strengths: ["Relevant synthetic vocabulary."], developmentPoints: ["Vary repeated wording."], nextAction: "Replace one repeated phrase." },
    grammaticalRangeAndAccuracy: { strengths: ["Mostly clear synthetic sentences."], developmentPoints: ["Check agreement carefully."], nextAction: "Review subject verb agreement." },
  };
}

function writingSession(id: string, mode: "draft" | "initial" | "revision", occurredAt: string) {
  const initialFeedback = mode === "draft" ? null : { stage: "initial", criteria: criteria(), languageIssues: [], revisionPriorities: ["Improve one synthetic paragraph."], wordCount: 8 };
  const revisionFeedback = mode === "revision" ? { stage: "revision", criteriaComparison: { taskResponse: "The revised synthetic response is clearer.", coherenceAndCohesion: "The synthetic structure is more connected.", lexicalResource: "The revised wording is more precise.", grammaticalRangeAndAccuracy: "The revised sentences are more controlled." }, resolvedIssueIds: [], remainingIssueIds: [], newLanguageIssues: [], improvedExample: "A synthetic revision gives one clear reason and a precise supporting example.", wordCount: 10 } : null;
  return { id, promptId: "technology-opinion", promptType: "opinion", draft: "Synthetic learner response explains a practical security decision.", revisedDraft: mode === "revision" ? "Synthetic revised response explains one practical and well-supported security decision." : null, initialFeedback, revisionFeedback, initialAnalyzedAt: mode === "draft" ? null : occurredAt, revisionReviewedAt: mode === "revision" ? occurredAt : null, elapsedSeconds: null, createdAt: timestamp(-8_000), updatedAt: occurredAt };
}

function listeningSession(id: string, completedAt: string | null, updatedAt: string) {
  return { id, practiceDefinitionId: "p1-library-card", answers: completedAt ? { q1: "b", q2: "a", q3: "b", q4: "15 March", q5: "ten pence", q6: "fourteen" } : {}, playbackStartedAt: null, playbackCount: 0, correctCount: completedAt ? 6 : null, totalCount: completedAt ? 6 : null, createdAt: timestamp(-6_000), updatedAt, completedAt };
}

export function backupSeed(): StorageSeed {
  const phrase = { id: "synthetic-phrase", phrase: "critical patch", context: "The team applied a critical patch before the scheduled maintenance window.", sourceTitle: "Synthetic backup source", sourceUrl: null, contentId: "synthetic-content", savedAt: timestamp(-1_000) };
  return {
    "engcyber.saved-phrases.v1": JSON.stringify({ version: "m9-phrases-v2", phrases: [phrase] }),
    [unrelatedSentinel]: unrelatedSentinelValue,
  };
}

export function continuationSeed(): StorageSeed {
  const now = timestamp();
  return {
    "engcyber.ielts-practice.v1": JSON.stringify({ version: "m12-ielts-practice-v2", reading: [readingPractice("reading-open", null, now)], writing: [writingSession("writing-draft", "draft", timestamp(-1_000))], listening: [listeningSession("listening-open", null, timestamp(-2_000))] }),
  };
}

export function completedIeltsSeed(): StorageSeed {
  const now = timestamp();
  return {
    "engcyber.ielts-practice.v1": JSON.stringify({ version: "m12-ielts-practice-v2", reading: [readingPractice("reading-complete", now, now)], writing: [writingSession("writing-initial", "initial", now), writingSession("writing-revision", "revision", now)], listening: [listeningSession("listening-complete", now, now)] }),
  };
}
