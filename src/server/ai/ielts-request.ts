import "server-only";

import { z } from "zod";
import { ieltsDraftMaximumCharacters, ieltsInitialWritingFeedbackSchema, ieltsReadingSourceProblem, ieltsTask2PromptBank, type IeltsReadingGenerationInput, type IeltsWritingAnalysisInput } from "@/domain/ielts";
import { storedLessonContextSchema } from "@/domain/lesson";
import { buildLessonSource } from "@/domain/lesson";
import { contentFingerprintFor, parseSanitizedLessonContent } from "@/server/lessons/request";

const readingRequestSchema = z.object({ content: z.unknown().optional(), lessonContext: z.unknown().optional() }).strict();
const memorySchema = z.object({ patternKey: z.string().trim().min(3).max(160), status: z.enum(["needs_practice", "improving", "mastered", "returned"]), occurrenceCount: z.number().int().min(1).max(200), recentSeverity: z.enum(["minor", "moderate", "major", "critical"]) }).strict();
const writingRequestSchema = z.object({ stage: z.enum(["initial", "revision"]), sessionId: z.string().trim().min(1).max(120), promptId: z.string().trim().min(1).max(100), draft: z.string().trim().min(1).max(ieltsDraftMaximumCharacters), initialFeedback: z.unknown().optional(), errorMemory: z.array(memorySchema).max(8).default([]) }).strict();

export function parseIeltsReadingRequest(value: unknown): IeltsReadingGenerationInput {
  const request = readingRequestSchema.safeParse(value);
  if (!request.success || (request.data.content === undefined) === (request.data.lessonContext === undefined)) throw new Error("IELTS Reading requires one sanitized source or one saved lesson context.");
  if (request.data.content !== undefined) {
    const content = parseSanitizedLessonContent(request.data.content);
    const source = buildLessonSource(content.title, content.sanitizedText);
    const problem = ieltsReadingSourceProblem(source.text);
    if (problem) throw new Error(problem);
    return { sourceId: content.id, sourceFingerprint: content.contentFingerprint, sourceTitle: content.title, sourceUrl: content.canonicalUrl, sourceText: source.text };
  }
  const context = storedLessonContextSchema.safeParse(request.data.lessonContext);
  if (!context.success) throw new Error("IELTS Reading requires a validated saved lesson context.");
  const problem = ieltsReadingSourceProblem(context.data.sourceText);
  if (problem) throw new Error(problem);
  return { sourceId: context.data.contentId, sourceFingerprint: context.data.contentFingerprint || contentFingerprintFor(context.data.sourceText), sourceTitle: context.data.title, sourceUrl: context.data.canonicalUrl, sourceText: context.data.sourceText };
}

export function parseIeltsWritingRequest(value: unknown): IeltsWritingAnalysisInput {
  const request = writingRequestSchema.safeParse(value);
  if (!request.success) throw new Error("A complete IELTS Writing request is required.");
  const prompt = ieltsTask2PromptBank.find((entry) => entry.id === request.data.promptId);
  if (!prompt) throw new Error("Choose an application-owned Task 2 prompt.");
  const initialFeedback = request.data.initialFeedback === undefined ? undefined : ieltsInitialWritingFeedbackSchema.safeParse(request.data.initialFeedback);
  if (request.data.stage === "revision" && (!initialFeedback || !initialFeedback.success)) throw new Error("Revision feedback requires validated initial feedback.");
  return { stage: request.data.stage, sessionId: request.data.sessionId, prompt, draft: request.data.draft, initialFeedback: initialFeedback?.success ? initialFeedback.data : undefined, errorMemory: request.data.errorMemory };
}
