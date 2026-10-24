import { LocalErrorMemoryStore } from "@/client/local-error-memory-store";
import { LocalIeltsPracticeStore } from "@/client/local-ielts-practice-store";
import { LocalLessonStore } from "@/client/local-lesson-store";
import { LocalListeningStore } from "@/client/local-listening-store";
import { LocalPhraseStore } from "@/client/local-phrase-store";
import { LocalReviewStore } from "@/client/local-review-store";
import { LocalVocabularyReviewStore } from "@/client/local-vocabulary-review-store";
import { LocalWritingSessionStore } from "@/client/local-writing-session-store";
import type { IeltsReadingPractice } from "@/domain/ielts";
import type { StoredLesson } from "@/domain/lesson";
import { createListeningSession } from "@/domain/listening";
import { synchronizeReviewItems } from "@/domain/review";
import { enrollVocabularyPhrase } from "@/domain/vocabulary-review";
import type { ErrorOccurrence, WritingSession } from "@/domain/writing";

export class TrainingStorage {
  readonly values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.writes++; this.values.delete(key); }
  contents() { return Object.fromEntries(this.values); }
}

export function trainingReading(now: string, id = "training-reading"): IeltsReadingPractice {
  return {
    id, generationFingerprint: `generation-${id}`, sourceId: "training-source", sourceFingerprint: "sha256:training-source", sourceTitle: "Synthetic training report", sourceUrl: null,
    questions: [...[1, 2, 3].map((n) => ({ id: `mc-${n}`, type: "multiple_choice" as const, question: "Which response is supported by the report?", options: ["a", "b", "c", "d"].map((id) => ({ id, text: `Response ${id}` })), correctOptionId: "a", relevantSourceContext: "The team improved its response.", explanation: "The report supports this response." })), ...[1, 2, 3].map((n) => ({ id: `tf-${n}`, type: "true_false_not_given" as const, question: "The team improved its response.", answer: "true" as const, relevantSourceContext: "The team improved its response.", explanation: "This is stated directly in the report." }))],
    answers: {}, completedAt: null, elapsedSeconds: null, createdAt: now, updatedAt: now,
  };
}

export async function trainingFixture(now: string) {
  const ago = (days: number) => new Date(Date.parse(now) - days * 86_400_000).toISOString();
  const storage = new TrainingStorage();
  const lesson: StoredLesson = {
    id: "training-lesson", contentId: "training-content", contentFingerprint: "sha256:training-content", generationFingerprint: "sha256:training-lesson", schemaVersion: "m2-schema-v1", learnerProfileVersion: "m2-profile-v1", lessonPromptVersion: "m2-prompt-v1", aiProvider: "gemini", model: "synthetic", createdAt: ago(2), lastAccessedAt: ago(2), sourceTruncated: false,
    context: { version: "m9-lesson-context-v1", title: "Synthetic saved training lesson", canonicalUrl: null, contentId: "training-content", contentFingerprint: "sha256:training-content", primaryCategory: "cybersecurity_news", contentType: "article", sourceText: "The team improved its security response after a careful review.", sourceTruncated: false },
    lesson: {
      overview: "A synthetic lesson about a careful security response.",
      keyPhrases: Array.from({ length: 5 }, (_, n) => ({ phrase: `security response ${n}`, meaningSimpleEnglish: "A clear explanation of the security response.", meaningTurkish: "Güvenlik yanıtı", articleContext: "The team improved its security response.", exampleSentence: "The team improved its security response after a careful review.", whyUseful: "This phrase helps explain a practical technical decision." })),
      difficultSentences: Array.from({ length: 3 }, (_, n) => ({ original: `The security team reviewed response procedure number ${n} after the incident.`, simplifiedEnglish: "The team checked its response after the incident.", importantVocabulary: ["response"], languageNote: "A clear past-tense subject and verb describe the action." })),
      readingQuestions: Array.from({ length: 5 }, (_, n) => ({ id: `q-${n}`, type: "multiple_choice", question: "What did the security team review?", options: ["a", "b", "c"].map((id) => ({ id, text: `Response ${id}` })), correctOptionId: "a", explanation: "The source describes a security response review.", skill: "specific_detail" })),
      speaking: { mainTask: "Explain the security response clearly to a colleague.", followUps: ["What did the team review?", "What should the team improve?"], chatGptVoiceInstruction: "Ask one question at a time about the security response and help me explain it clearly." }, writing: { task: "Write 80 to 150 words about the team's security response.", minWords: 80, maxWords: 150 },
    },
  };
  const writing: WritingSession = { id: "training-writing", lessonId: lesson.id, contentId: lesson.contentId, contentFingerprint: lesson.contentFingerprint, task: lesson.lesson.writing.task, minWords: 80, maxWords: 150, firstDraft: "The team review its response after an incident.", initialFeedback: { stage: "initial", overallFeedback: "Check the subject and verb agreement in this draft.", priorityErrors: [], vocabularySuggestions: [], technicalAccuracy: null, revisionFocus: ["Check agreement in the main sentence."] }, revisedDraft: null, revisionFeedback: null, createdAt: ago(2), updatedAt: ago(0.1) };
  const occurrence: ErrorOccurrence = { id: "training-error", writingSessionId: writing.id, attemptNumber: 1, category: "grammar", subcategory: "subject_verb_agreement", patternKey: "grammar.subject_verb_agreement", originalText: "The team review its response.", correctedText: "The team reviews its response.", explanation: "The singular subject needs a singular present-tense verb.", severity: "moderate", confidence: 0.95, createdAt: ago(2), dismissed: false, correctedAt: null };
  const stores = {
    lesson: new LocalLessonStore(storage), writing: new LocalWritingSessionStore(storage), memory: new LocalErrorMemoryStore(storage, () => ago(2)), review: new LocalReviewStore(storage), phrase: new LocalPhraseStore(storage, () => "training-phrase"), vocabulary: new LocalVocabularyReviewStore(storage), listening: new LocalListeningStore(storage), ielts: new LocalIeltsPracticeStore(storage),
  };
  const requireSave = (value: boolean) => { if (!value) throw new Error("Invalid synthetic training fixture"); };
  requireSave(await stores.lesson.save(lesson)); requireSave(await stores.writing.save(writing)); requireSave(await stores.memory.record(occurrence));
  const memory = await stores.memory.snapshot();
  const review = synchronizeReviewItems(memory.patterns, memory.occurrences, [], { now: ago(2), createId: () => "training-review" });
  requireSave(await stores.review.save(review, []));
  if (await stores.phrase.save({ phrase: "critical patch", context: "The team applied a critical patch after the review.", sourceTitle: "Synthetic source", sourceUrl: null, contentId: lesson.contentId, savedAt: ago(1) }) !== "saved") throw new Error("Invalid synthetic phrase");
  requireSave(await stores.vocabulary.save([enrollVocabularyPhrase("training-phrase", ago(1))], []));
  const listening = createListeningSession({ id: "training-listening", lesson, createdAt: ago(0.2) });
  requireSave(await stores.listening.save({ sessions: [listening], attempts: [], shadowingEvents: [], playbackRate: 1 }));
  const reading = trainingReading(ago(0.3)); requireSave(await stores.ielts.saveReading(reading));
  storage.writes = 0;
  return { storage, stores, lesson, writing, occurrence, reading, listening, review, now };
}
