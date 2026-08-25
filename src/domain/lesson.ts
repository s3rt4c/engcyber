import { z } from "zod";
import { contentCategories } from "@/domain/learning";
import type { Content, ContentType } from "@/domain/models";

export const lessonPromptVersion = "m2-prompt-v1";
export const lessonSchemaVersion = "m2-schema-v1";
export const lessonSourceMaximumCharacters = 12_000;

const phraseSchema = z.object({
  phrase: z.string().trim().min(2).max(120),
  meaningSimpleEnglish: z.string().trim().min(8).max(420),
  meaningTurkish: z.string().trim().min(2).max(420),
  articleContext: z.string().trim().min(4).max(700),
  exampleSentence: z.string().trim().min(8).max(500),
  whyUseful: z.string().trim().min(8).max(420),
});

const difficultSentenceSchema = z.object({
  original: z.string().trim().min(8).max(1_200),
  simplifiedEnglish: z.string().trim().min(8).max(700),
  importantVocabulary: z.array(z.string().trim().min(1).max(100)).min(1).max(6),
  languageNote: z.string().trim().min(8).max(500),
});

const readingQuestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(["multiple_choice", "true_false_not_given", "vocabulary_in_context"]),
  question: z.string().trim().min(8).max(600),
  options: z.array(z.object({ id: z.string().trim().min(1).max(80), text: z.string().trim().min(1).max(320) })).min(3).max(4),
  correctOptionId: z.string().trim().min(1).max(80),
  explanation: z.string().trim().min(8).max(500),
  skill: z.enum(["main_idea", "specific_detail", "inference", "vocabulary_in_context", "cause_effect", "true_false_not_given"]),
}).superRefine((question, context) => {
  if (!question.options.some((option) => option.id === question.correctOptionId)) {
    context.addIssue({ code: "custom", message: "correctOptionId must name an option" });
  }
});

export const lessonDraftSchema = z.object({
  overview: z.string().trim().min(20).max(1_200),
  keyPhrases: z.array(phraseSchema).min(5).max(8),
  difficultSentences: z.array(difficultSentenceSchema).min(3).max(5),
  readingQuestions: z.array(readingQuestionSchema).length(5),
  speaking: z.object({
    mainTask: z.string().trim().min(12).max(700),
    followUps: z.array(z.string().trim().min(8).max(400)).min(2).max(3),
    chatGptVoiceInstruction: z.string().trim().min(30).max(1_000),
  }),
  writing: z.object({
    task: z.string().trim().min(20).max(800),
    minWords: z.number().int().min(80).max(80),
    maxWords: z.number().int().min(150).max(150),
  }),
});

export type LessonDraft = z.infer<typeof lessonDraftSchema>;
export type ReadingQuestion = LessonDraft["readingQuestions"][number];

const persistedHttpUrlSchema = z.string().trim().max(2_000).url().refine((value) => {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch { return false; }
}, "A stored source URL must be a safe HTTP or HTTPS URL.");

const contentTypeValues = ["article", "podcast", "transcript", "write_up", "document", "manual"] as const satisfies readonly ContentType[];

export const storedLessonContextSchema = z.object({
  version: z.literal("m9-lesson-context-v1"),
  title: z.string().trim().min(1).max(500),
  sourceLabel: z.string().trim().min(1).max(240).optional(),
  canonicalUrl: persistedHttpUrlSchema.nullable(),
  contentId: z.string().trim().min(1).max(240),
  contentFingerprint: z.string().trim().min(1).max(200),
  primaryCategory: z.enum(contentCategories.map((category) => category.id) as [Content["primaryCategory"], ...Content["primaryCategory"][]]),
  contentType: z.enum(contentTypeValues),
  sourceText: z.string().trim().min(1).max(lessonSourceMaximumCharacters).refine((value) => !/<\/?[a-z][^>]*>/iu.test(value), "Stored lesson context must not contain markup."),
  sourceTruncated: z.boolean(),
}).strict();

export type StoredLessonContext = z.infer<typeof storedLessonContextSchema>;

export const storedLessonSchema = z.object({
  id: z.string().trim().min(1),
  contentId: z.string().trim().min(1),
  contentFingerprint: z.string().trim().min(1),
  generationFingerprint: z.string().trim().min(1),
  schemaVersion: z.literal(lessonSchemaVersion),
  learnerProfileVersion: z.string().trim().min(1),
  lessonPromptVersion: z.literal(lessonPromptVersion),
  aiProvider: z.enum(["gemini", "openai"]),
  model: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  lastAccessedAt: z.string().datetime(),
  sourceTruncated: z.boolean(),
  context: storedLessonContextSchema.optional(),
  lesson: lessonDraftSchema,
});

export type StoredLesson = z.infer<typeof storedLessonSchema>;

export interface LessonSource {
  readonly text: string;
  readonly sourceTruncated: boolean;
}

export interface GeneratedLesson {
  readonly draft: LessonDraft;
  readonly source: LessonSource;
  readonly model: string;
  readonly usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export interface LessonGenerationIdentity {
  readonly generationFingerprint: string;
  readonly schemaVersion: typeof lessonSchemaVersion;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function selectedParagraphs(paragraphs: readonly string[], budget: number): string[] {
  const middle = Math.floor(paragraphs.length / 2);
  const priority = [...new Set([0, paragraphs.length - 1, middle, 1, paragraphs.length - 2, middle - 1, ...paragraphs.keys()])]
    .filter((index) => index >= 0 && index < paragraphs.length);
  const selected: number[] = [];
  let used = 0;
  for (const index of priority) {
    const paragraph = paragraphs[index];
    if (used + paragraph.length + (selected.length ? 2 : 0) > budget) continue;
    selected.push(index);
    used += paragraph.length + (selected.length > 1 ? 2 : 0);
  }
  return selected.sort((left, right) => left - right).map((index) => paragraphs[index]);
}

export function buildLessonSource(title: string, sanitizedText: string): LessonSource {
  const boundedTitle = normalizeWhitespace(title).slice(0, 500);
  const heading = `Title: ${boundedTitle}\n\n`;
  const paragraphs = sanitizedText.split(/\n{2,}/).map(normalizeWhitespace).filter(Boolean);
  const fullText = `${heading}${paragraphs.join("\n\n")}`;
  if (fullText.length <= lessonSourceMaximumCharacters) return { text: fullText, sourceTruncated: false };
  const selected = selectedParagraphs(paragraphs, lessonSourceMaximumCharacters - heading.length);
  return { text: `${heading}${selected.join("\n\n")}`, sourceTruncated: true };
}

export function createStoredLessonContext(content: Pick<Content, "id" | "title" | "canonicalUrl" | "primaryCategory" | "contentType" | "sanitizedText" | "contentFingerprint">, sourceLabel?: string): StoredLessonContext {
  const source = buildLessonSource(content.title, content.sanitizedText);
  const context = {
    version: "m9-lesson-context-v1" as const,
    title: normalizeWhitespace(content.title).slice(0, 500),
    ...(sourceLabel?.trim() ? { sourceLabel: normalizeWhitespace(sourceLabel).slice(0, 240) } : {}),
    canonicalUrl: content.canonicalUrl,
    contentId: content.id,
    contentFingerprint: content.contentFingerprint,
    primaryCategory: content.primaryCategory,
    contentType: content.contentType,
    sourceText: source.text,
    sourceTruncated: source.sourceTruncated,
  };
  return storedLessonContextSchema.parse(context);
}

export function validateLessonDraft(value: unknown, suppliedLessonSource: string) {
  const parsed = lessonDraftSchema.safeParse(value);
  if (!parsed.success) return parsed;
  const normalizedSource = normalizeWhitespace(suppliedLessonSource);
  if (parsed.data.difficultSentences.some((sentence) => !normalizedSource.includes(normalizeWhitespace(sentence.original)))) {
    return { success: false as const, error: new z.ZodError([{ code: "custom", path: ["difficultSentences"], message: "Each difficult sentence must originate in the supplied lesson source." }]) };
  }
  return parsed;
}

export function gradeReadingQuestion(question: ReadingQuestion, selectedOptionId: string): { correct: boolean; explanation: string } {
  return { correct: selectedOptionId === question.correctOptionId, explanation: question.explanation };
}
